//! Deterministic graph force simulation shared by native and web realms.
//!
//! The integrator uses velocity Verlet. Many-body repulsion uses a Barnes-Hut
//! quadtree, while link and centering forces follow the d3-force behavior
//! model. All ordering, seeding, and floating-point operations are explicit.

use std::collections::{BTreeMap, BTreeSet};

use serde::{Deserialize, Serialize};
use thiserror::Error;

use crate::model::{GraphSlice, NodeId};

const MAX_TREE_DEPTH: u8 = 32;
const MIN_HALF_SIZE: f64 = 1.0e-9;
const SOFTENING_SQUARED: f64 = 1.0e-4;

#[derive(Clone, Copy, Debug, PartialEq, Serialize, Deserialize)]
pub struct ForceSimConfig {
    pub time_step: f64,
    pub damping: f64,
    pub repulsion: f64,
    pub theta: f64,
    pub link_strength: f64,
    pub link_distance: f64,
    pub centering: f64,
    pub settle_speed: f64,
    pub settle_acceleration: f64,
    pub settle_steps: u16,
}

impl Default for ForceSimConfig {
    fn default() -> Self {
        Self {
            time_step: 0.25,
            damping: 0.88,
            repulsion: 1_200.0,
            theta: 0.9,
            link_strength: 0.035,
            link_distance: 84.0,
            centering: 0.006,
            settle_speed: 0.025,
            settle_acceleration: 0.025,
            settle_steps: 24,
        }
    }
}

impl ForceSimConfig {
    fn validate(&self) -> Result<(), SimError> {
        let finite = [
            self.time_step,
            self.damping,
            self.repulsion,
            self.theta,
            self.link_strength,
            self.link_distance,
            self.centering,
            self.settle_speed,
            self.settle_acceleration,
        ]
        .into_iter()
        .all(f64::is_finite);
        if !finite {
            return Err(SimError::NonFiniteInput);
        }
        if self.time_step <= 0.0
            || !(0.0..=1.0).contains(&self.damping)
            || self.repulsion < 0.0
            || self.theta <= 0.0
            || self.link_strength < 0.0
            || self.link_distance < 0.0
            || self.centering < 0.0
            || self.settle_speed < 0.0
            || self.settle_acceleration < 0.0
            || self.settle_steps == 0
        {
            return Err(SimError::InvalidConfig);
        }
        Ok(())
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SimBackend {
    CpuBarnesHut,
    #[cfg(feature = "gpu")]
    SharedDeviceCpuFallback,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct NodePos {
    pub id: NodeId,
    pub x: f64,
    pub y: f64,
    pub vx: f64,
    pub vy: f64,
    pub pinned: bool,
}

#[derive(Clone, Debug, Error, Eq, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum SimError {
    #[error("graph contains duplicate node id {id}")]
    DuplicateNode { id: NodeId },
    #[error("graph edge {edge_id} references missing node {node_id}")]
    MissingNode { edge_id: String, node_id: NodeId },
    #[error("graph or configuration contains a non-finite number")]
    NonFiniteInput,
    #[error("force simulation configuration is outside supported bounds")]
    InvalidConfig,
    #[error("node {id} was not found")]
    NodeNotFound { id: NodeId },
}

#[derive(Clone, Debug)]
pub struct ForceSim {
    config: ForceSimConfig,
    positions: Vec<NodePos>,
    edges: Vec<(usize, usize, f64)>,
    node_indexes: BTreeMap<NodeId, usize>,
    accelerations: Vec<(f64, f64)>,
    stable_steps: u16,
    steps: u64,
    backend: SimBackend,
}

impl ForceSim {
    pub fn new(slice: &GraphSlice, seed: u64) -> Self {
        Self::try_new(slice, seed).expect("ForceSim::new requires a valid graph slice")
    }

    pub fn try_new(slice: &GraphSlice, seed: u64) -> Result<Self, SimError> {
        Self::with_config(slice, seed, ForceSimConfig::default())
    }

    pub fn with_config(
        slice: &GraphSlice,
        seed: u64,
        config: ForceSimConfig,
    ) -> Result<Self, SimError> {
        config.validate()?;

        let mut seen = BTreeSet::new();
        let mut node_indexes = BTreeMap::new();
        let radius = ((slice.nodes.len().max(1) as f64).sqrt() * 34.0).max(24.0);
        let mut positions = Vec::with_capacity(slice.nodes.len());
        let mut nodes = slice.nodes.iter().collect::<Vec<_>>();
        nodes.sort_by(|left, right| left.id.cmp(&right.id));
        for (index, node) in nodes.into_iter().enumerate() {
            if !seen.insert(node.id.clone()) {
                return Err(SimError::DuplicateNode {
                    id: node.id.clone(),
                });
            }
            node_indexes.insert(node.id.clone(), index);
            let mut random = SplitMix64::new(seed ^ stable_id_hash(&node.id));
            let angle = random.unit() * std::f64::consts::TAU;
            let distance = radius * (0.35 + random.unit() * 0.65);
            positions.push(NodePos {
                id: node.id.clone(),
                x: angle.cos() * distance,
                y: angle.sin() * distance,
                vx: 0.0,
                vy: 0.0,
                pinned: false,
            });
        }

        let mut edges = Vec::with_capacity(slice.edges.len());
        for edge in &slice.edges {
            if !edge.weight.is_finite() {
                return Err(SimError::NonFiniteInput);
            }
            let source =
                node_indexes
                    .get(&edge.source)
                    .copied()
                    .ok_or_else(|| SimError::MissingNode {
                        edge_id: edge.id.clone(),
                        node_id: edge.source.clone(),
                    })?;
            let target =
                node_indexes
                    .get(&edge.target)
                    .copied()
                    .ok_or_else(|| SimError::MissingNode {
                        edge_id: edge.id.clone(),
                        node_id: edge.target.clone(),
                    })?;
            edges.push((source, target, edge.weight.max(0.0), edge.id.clone()));
        }
        edges.sort_by(|left, right| {
            (left.0, left.1, &left.3)
                .cmp(&(right.0, right.1, &right.3))
                .then_with(|| left.2.total_cmp(&right.2))
        });
        let edges = edges
            .into_iter()
            .map(|(source, target, weight, _)| (source, target, weight))
            .collect();

        let backend = if cfg!(feature = "gpu") {
            #[cfg(feature = "gpu")]
            {
                SimBackend::SharedDeviceCpuFallback
            }
            #[cfg(not(feature = "gpu"))]
            {
                SimBackend::CpuBarnesHut
            }
        } else {
            SimBackend::CpuBarnesHut
        };

        let mut simulation = Self {
            config,
            accelerations: vec![(0.0, 0.0); positions.len()],
            positions,
            edges,
            node_indexes,
            stable_steps: 0,
            steps: 0,
            backend,
        };
        simulation.accelerations = simulation.compute_accelerations();
        Ok(simulation)
    }

    pub fn backend(&self) -> SimBackend {
        self.backend
    }

    pub fn positions(&self) -> &[NodePos] {
        &self.positions
    }

    pub fn step_count(&self) -> u64 {
        self.steps
    }

    pub fn set_pinned(
        &mut self,
        id: &NodeId,
        position: Option<(f64, f64)>,
    ) -> Result<(), SimError> {
        let index = self
            .node_indexes
            .get(id)
            .copied()
            .ok_or_else(|| SimError::NodeNotFound { id: id.clone() })?;
        if let Some((x, y)) = position {
            if !x.is_finite() || !y.is_finite() {
                return Err(SimError::NonFiniteInput);
            }
            self.positions[index].x = x;
            self.positions[index].y = y;
            self.positions[index].vx = 0.0;
            self.positions[index].vy = 0.0;
            self.positions[index].pinned = true;
        } else {
            self.positions[index].pinned = false;
        }
        self.accelerations = self.compute_accelerations();
        self.stable_steps = 0;
        Ok(())
    }

    pub fn step(&mut self) -> &[NodePos] {
        if self.positions.is_empty() {
            self.stable_steps = self.config.settle_steps;
            self.steps = self.steps.saturating_add(1);
            return &self.positions;
        }

        let half_dt_squared = 0.5 * self.config.time_step * self.config.time_step;
        for (position, (ax, ay)) in self.positions.iter_mut().zip(&self.accelerations) {
            if position.pinned {
                position.vx = 0.0;
                position.vy = 0.0;
                continue;
            }
            position.x += position.vx * self.config.time_step + ax * half_dt_squared;
            position.y += position.vy * self.config.time_step + ay * half_dt_squared;
        }

        let next_accelerations = self.compute_accelerations();
        let half_dt = 0.5 * self.config.time_step;
        let mut max_speed: f64 = 0.0;
        let mut max_acceleration: f64 = 0.0;
        for ((position, (old_ax, old_ay)), (new_ax, new_ay)) in self
            .positions
            .iter_mut()
            .zip(&self.accelerations)
            .zip(&next_accelerations)
        {
            if !position.pinned {
                position.vx = (position.vx + (old_ax + new_ax) * half_dt) * self.config.damping;
                position.vy = (position.vy + (old_ay + new_ay) * half_dt) * self.config.damping;
            }
            max_speed = max_speed.max(position.vx.hypot(position.vy));
            max_acceleration = max_acceleration.max(new_ax.hypot(*new_ay));
        }
        self.accelerations = next_accelerations;
        self.steps = self.steps.saturating_add(1);

        if max_speed <= self.config.settle_speed
            && max_acceleration <= self.config.settle_acceleration
        {
            self.stable_steps = self.stable_steps.saturating_add(1);
        } else {
            self.stable_steps = 0;
        }
        &self.positions
    }

    pub fn settled(&self) -> bool {
        self.stable_steps >= self.config.settle_steps
    }

    pub fn run_until_settled(&mut self, max_steps: usize) -> &[NodePos] {
        for _ in 0..max_steps {
            if self.settled() {
                break;
            }
            self.step();
        }
        &self.positions
    }

    pub fn frame_fingerprint(&self, precision: f64) -> Result<u64, SimError> {
        if !precision.is_finite() || precision <= 0.0 {
            return Err(SimError::NonFiniteInput);
        }
        let mut hash = 0xcbf2_9ce4_8422_2325_u64;
        for position in &self.positions {
            for byte in position.id.0.as_bytes() {
                hash ^= u64::from(*byte);
                hash = hash.wrapping_mul(0x0000_0100_0000_01b3);
            }
            for value in [position.x, position.y, position.vx, position.vy] {
                let quantized = (value * precision).round() as i64;
                for byte in quantized.to_le_bytes() {
                    hash ^= u64::from(byte);
                    hash = hash.wrapping_mul(0x0000_0100_0000_01b3);
                }
            }
        }
        Ok(hash)
    }

    fn compute_accelerations(&self) -> Vec<(f64, f64)> {
        let mut accelerations = vec![(0.0, 0.0); self.positions.len()];
        if self.positions.is_empty() {
            return accelerations;
        }

        let tree = Quad::from_positions(&self.positions);
        for (index, position) in self.positions.iter().enumerate() {
            if !position.pinned {
                tree.accumulate(
                    index,
                    &self.positions,
                    self.config.theta,
                    self.config.repulsion,
                    &mut accelerations[index],
                );
                accelerations[index].0 -= position.x * self.config.centering;
                accelerations[index].1 -= position.y * self.config.centering;
            }
        }

        for &(source, target, weight) in &self.edges {
            let dx = self.positions[target].x - self.positions[source].x;
            let dy = self.positions[target].y - self.positions[source].y;
            let distance = dx.hypot(dy).max(1.0e-9);
            let magnitude =
                self.config.link_strength * weight * (distance - self.config.link_distance);
            let fx = magnitude * dx / distance;
            let fy = magnitude * dy / distance;
            if !self.positions[source].pinned {
                accelerations[source].0 += fx;
                accelerations[source].1 += fy;
            }
            if !self.positions[target].pinned {
                accelerations[target].0 -= fx;
                accelerations[target].1 -= fy;
            }
        }
        accelerations
    }
}

#[derive(Clone, Debug)]
struct Quad {
    center_x: f64,
    center_y: f64,
    half_size: f64,
    mass: f64,
    mass_x: f64,
    mass_y: f64,
    kind: QuadKind,
}

#[derive(Clone, Debug)]
enum QuadKind {
    Leaf(Vec<usize>),
    Branch([Box<Quad>; 4]),
}

impl Quad {
    fn from_positions(positions: &[NodePos]) -> Self {
        let min_x = positions
            .iter()
            .map(|position| position.x)
            .fold(f64::INFINITY, f64::min);
        let max_x = positions
            .iter()
            .map(|position| position.x)
            .fold(f64::NEG_INFINITY, f64::max);
        let min_y = positions
            .iter()
            .map(|position| position.y)
            .fold(f64::INFINITY, f64::min);
        let max_y = positions
            .iter()
            .map(|position| position.y)
            .fold(f64::NEG_INFINITY, f64::max);
        let center_x = (min_x + max_x) * 0.5;
        let center_y = (min_y + max_y) * 0.5;
        let half_size = ((max_x - min_x).max(max_y - min_y) * 0.5 + 1.0).max(1.0);
        let indexes = (0..positions.len()).collect::<Vec<_>>();
        Self::build(positions, indexes, center_x, center_y, half_size, 0)
    }

    fn build(
        positions: &[NodePos],
        indexes: Vec<usize>,
        center_x: f64,
        center_y: f64,
        half_size: f64,
        depth: u8,
    ) -> Self {
        let mass = indexes.len() as f64;
        let (mass_x, mass_y) = if indexes.is_empty() {
            (center_x, center_y)
        } else {
            let (sum_x, sum_y) = indexes.iter().fold((0.0, 0.0), |acc, index| {
                (acc.0 + positions[*index].x, acc.1 + positions[*index].y)
            });
            (sum_x / mass, sum_y / mass)
        };

        if indexes.len() <= 1 || depth >= MAX_TREE_DEPTH || half_size <= MIN_HALF_SIZE {
            return Self {
                center_x,
                center_y,
                half_size,
                mass,
                mass_x,
                mass_y,
                kind: QuadKind::Leaf(indexes),
            };
        }

        let mut partitions: [Vec<usize>; 4] = std::array::from_fn(|_| Vec::new());
        for index in indexes {
            let right = usize::from(positions[index].x >= center_x);
            let bottom = usize::from(positions[index].y >= center_y);
            partitions[right + bottom * 2].push(index);
        }
        let child_half = half_size * 0.5;
        let children = std::array::from_fn(|quadrant| {
            let right = quadrant % 2 == 1;
            let bottom = quadrant >= 2;
            let child_x = center_x + if right { child_half } else { -child_half };
            let child_y = center_y + if bottom { child_half } else { -child_half };
            Box::new(Self::build(
                positions,
                std::mem::take(&mut partitions[quadrant]),
                child_x,
                child_y,
                child_half,
                depth + 1,
            ))
        });
        Self {
            center_x,
            center_y,
            half_size,
            mass,
            mass_x,
            mass_y,
            kind: QuadKind::Branch(children),
        }
    }

    fn accumulate(
        &self,
        target: usize,
        positions: &[NodePos],
        theta: f64,
        repulsion: f64,
        acceleration: &mut (f64, f64),
    ) {
        if self.mass == 0.0 || repulsion == 0.0 {
            return;
        }
        match &self.kind {
            QuadKind::Leaf(indexes) => {
                for other in indexes {
                    if *other != target {
                        add_repulsion(
                            &positions[target],
                            positions[*other].x,
                            positions[*other].y,
                            1.0,
                            repulsion,
                            acceleration,
                        );
                    }
                }
            }
            QuadKind::Branch(children) => {
                let target_position = &positions[target];
                let contains_target = (target_position.x - self.center_x).abs() <= self.half_size
                    && (target_position.y - self.center_y).abs() <= self.half_size;
                let distance = (target_position.x - self.mass_x)
                    .hypot(target_position.y - self.mass_y)
                    .max(1.0e-9);
                if !contains_target && self.half_size * 2.0 / distance < theta {
                    add_repulsion(
                        target_position,
                        self.mass_x,
                        self.mass_y,
                        self.mass,
                        repulsion,
                        acceleration,
                    );
                } else {
                    for child in children {
                        child.accumulate(target, positions, theta, repulsion, acceleration);
                    }
                }
            }
        }
    }
}

fn add_repulsion(
    target: &NodePos,
    source_x: f64,
    source_y: f64,
    source_mass: f64,
    repulsion: f64,
    acceleration: &mut (f64, f64),
) {
    let dx = target.x - source_x;
    let dy = target.y - source_y;
    let distance_squared = dx * dx + dy * dy + SOFTENING_SQUARED;
    let scale = repulsion * source_mass / (distance_squared * distance_squared.sqrt());
    acceleration.0 += dx * scale;
    acceleration.1 += dy * scale;
}

fn stable_id_hash(id: &NodeId) -> u64 {
    let mut hash = 0xcbf2_9ce4_8422_2325_u64;
    for byte in id.0.as_bytes() {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x0000_0100_0000_01b3);
    }
    hash
}

#[derive(Clone, Copy, Debug)]
struct SplitMix64(u64);

impl SplitMix64 {
    fn new(seed: u64) -> Self {
        Self(seed)
    }

    fn next(&mut self) -> u64 {
        self.0 = self.0.wrapping_add(0x9e37_79b9_7f4a_7c15);
        let mut value = self.0;
        value = (value ^ (value >> 30)).wrapping_mul(0xbf58_476d_1ce4_e5b9);
        value = (value ^ (value >> 27)).wrapping_mul(0x94d0_49bb_1331_11eb);
        value ^ (value >> 31)
    }

    fn unit(&mut self) -> f64 {
        ((self.next() >> 11) as f64) * (1.0 / ((1_u64 << 53) as f64))
    }
}

#[cfg(target_arch = "wasm32")]
#[no_mangle]
pub extern "C" fn commonplace_console_fixture_layout_fingerprint(
    seed_low: u32,
    seed_high: u32,
    steps: u32,
) -> u64 {
    let seed = u64::from(seed_low) | (u64::from(seed_high) << 32);
    let mut simulation = ForceSim::new(&crate::fixture_snapshot().graph, seed);
    for _ in 0..steps {
        simulation.step();
    }
    simulation
        .frame_fingerprint(1_000_000.0)
        .expect("fixed precision is valid")
}

#[cfg(target_arch = "wasm32")]
#[no_mangle]
pub extern "C" fn commonplace_console_fixture_settled_layout_fingerprint(
    seed_low: u32,
    seed_high: u32,
    max_steps: u32,
) -> u64 {
    let seed = u64::from(seed_low) | (u64::from(seed_high) << 32);
    let mut simulation = ForceSim::new(&crate::fixture_snapshot().graph, seed);
    simulation.run_until_settled(max_steps as usize);
    simulation
        .frame_fingerprint(1_000_000.0)
        .expect("fixed precision is valid")
}
