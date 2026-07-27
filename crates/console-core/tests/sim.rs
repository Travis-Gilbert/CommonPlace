use std::time::Instant;

use commonplace_console_core::{
    fixture_snapshot, ForceSim, ForceSimConfig, GraphEdge, GraphNode, GraphSlice, NodeId, SimError,
};

mod sim {
    use super::*;

    #[test]
    fn sim_same_seed_produces_byte_equal_frames() {
        let graph = fixture_snapshot().graph;
        let mut left = ForceSim::new(&graph, 0xC0FFEE);
        let mut right = ForceSim::new(&graph, 0xC0FFEE);
        for _ in 0..360 {
            left.step();
            right.step();
        }

        assert_eq!(left.positions(), right.positions());
        assert_eq!(
            serde_json::to_vec(left.positions()).expect("left frame"),
            serde_json::to_vec(right.positions()).expect("right frame")
        );
        assert_eq!(
            left.frame_fingerprint(1_000_000.0).expect("left hash"),
            right.frame_fingerprint(1_000_000.0).expect("right hash")
        );
    }

    #[test]
    fn sim_logical_graph_order_does_not_change_the_frame() {
        let graph = fixture_snapshot().graph;
        let mut permuted = graph.clone();
        permuted.nodes.reverse();
        permuted.edges.rotate_left(1);

        let mut canonical = ForceSim::new(&graph, 0xC0FFEE);
        let mut reordered = ForceSim::new(&permuted, 0xC0FFEE);
        for _ in 0..360 {
            canonical.step();
            reordered.step();
        }

        assert_eq!(canonical.positions(), reordered.positions());
        assert_eq!(
            canonical
                .frame_fingerprint(1_000_000.0)
                .expect("canonical fingerprint"),
            reordered
                .frame_fingerprint(1_000_000.0)
                .expect("reordered fingerprint")
        );
    }

    #[test]
    fn sim_fixture_fingerprint_is_stable() {
        let mut simulation = ForceSim::new(&fixture_snapshot().graph, 0xC0FFEE);
        for _ in 0..360 {
            simulation.step();
        }
        let fingerprint = simulation
            .frame_fingerprint(1_000_000.0)
            .expect("fixture fingerprint");
        assert_eq!(fingerprint, 5_604_591_119_938_928_748);
    }

    #[cfg(feature = "gpu")]
    #[test]
    fn sim_gpu_feature_reports_deterministic_cpu_fallback() {
        use commonplace_console_core::SimBackend;

        let mut simulation = ForceSim::new(&fixture_snapshot().graph, 0xC0FFEE);
        assert_eq!(simulation.backend(), SimBackend::SharedDeviceCpuFallback);
        for _ in 0..360 {
            simulation.step();
        }
        assert_ne!(
            simulation
                .frame_fingerprint(1_000_000.0)
                .expect("fallback fingerprint"),
            0
        );
    }

    #[test]
    fn sim_accepts_empty_singleton_and_disconnected_graphs() {
        let empty = GraphSlice {
            root: NodeId::new("empty"),
            depth: 0,
            nodes: Vec::new(),
            edges: Vec::new(),
        };
        let mut empty_sim = ForceSim::new(&empty, 1);
        assert!(empty_sim.step().is_empty());
        assert!(empty_sim.settled());

        let singleton = graph_with_nodes(1, false);
        let mut singleton_sim = ForceSim::new(&singleton, 2);
        singleton_sim.run_until_settled(2_000);
        assert_eq!(singleton_sim.positions().len(), 1);
        assert!(singleton_sim.positions()[0].x.is_finite());

        let disconnected = graph_with_nodes(8, false);
        let mut disconnected_sim = ForceSim::new(&disconnected, 3);
        disconnected_sim.run_until_settled(2_000);
        assert!(disconnected_sim
            .positions()
            .iter()
            .all(|node| node.x.is_finite() && node.y.is_finite()));
    }

    #[test]
    fn sim_keeps_pinned_nodes_fixed() {
        let graph = fixture_snapshot().graph;
        let mut simulation = ForceSim::new(&graph, 4);
        let pinned = simulation.positions()[0].id.clone();
        simulation
            .set_pinned(&pinned, Some((120.0, -45.0)))
            .expect("pin fixture node");
        for _ in 0..240 {
            simulation.step();
        }
        let position = simulation
            .positions()
            .iter()
            .find(|position| position.id == pinned)
            .expect("pinned position");
        assert_eq!((position.x, position.y), (120.0, -45.0));
        assert_eq!((position.vx, position.vy), (0.0, 0.0));
    }

    #[test]
    fn sim_rejects_non_finite_and_dangling_input() {
        let graph = fixture_snapshot().graph;
        let invalid = ForceSimConfig {
            theta: f64::NAN,
            ..ForceSimConfig::default()
        };
        assert_eq!(
            ForceSim::with_config(&graph, 5, invalid).expect_err("nan theta"),
            SimError::NonFiniteInput
        );

        let mut dangling = graph;
        dangling.edges.push(GraphEdge {
            id: "edge:dangling".into(),
            source: NodeId::new("missing"),
            target: NodeId::new("node:ada"),
            edge_type: "invalid".into(),
            weight: 1.0,
        });
        assert!(matches!(
            ForceSim::try_new(&dangling, 6),
            Err(SimError::MissingNode { .. })
        ));
    }

    #[test]
    fn sim_fixture_reaches_a_stable_layout() {
        let mut simulation = ForceSim::new(&fixture_snapshot().graph, 0xC0FFEE);
        simulation.run_until_settled(4_000);
        assert!(
            simulation.settled(),
            "fixture did not settle after {} steps",
            simulation.step_count()
        );
    }

    #[test]
    #[ignore = "records the 5,000-node step cost for the implementation report"]
    fn sim_benchmark_5000() {
        let graph = graph_with_nodes(5_000, true);
        let mut simulation = ForceSim::new(&graph, 0xC0FFEE);
        let started = Instant::now();
        for _ in 0..10 {
            simulation.step();
        }
        let micros_per_step = started.elapsed().as_micros() / 10;
        eprintln!("force-sim-5000: {micros_per_step} us/step");
        assert!(
            micros_per_step < 500_000,
            "debug step cost exceeded the 500 ms regression ceiling"
        );
        assert!(simulation
            .positions()
            .iter()
            .all(|position| position.x.is_finite()));
    }

    fn graph_with_nodes(count: usize, linked: bool) -> GraphSlice {
        let nodes = (0..count)
            .map(|index| GraphNode {
                id: NodeId::new(format!("node:{index:05}")),
                golden_id: None,
                node_type: "fixture".into(),
                label: format!("Node {index}"),
            })
            .collect::<Vec<_>>();
        let edges = if linked {
            (1..count)
                .map(|index| GraphEdge {
                    id: format!("edge:{index:05}"),
                    source: NodeId::new(format!("node:{:05}", index - 1)),
                    target: NodeId::new(format!("node:{index:05}")),
                    edge_type: "next".into(),
                    weight: 1.0,
                })
                .collect()
        } else {
            Vec::new()
        };
        GraphSlice {
            root: NodeId::new("node:00000"),
            depth: 1,
            nodes,
            edges,
        }
    }
}
