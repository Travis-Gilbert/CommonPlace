//! Bounded, caller-requested standing-query inspection.

use std::collections::{BTreeMap, BTreeSet, VecDeque};
use std::sync::{Arc, Mutex};

use serde::{Deserialize, Serialize};
use thiserror::Error;

use crate::door::{Door, DoorSubscription};
use crate::model::{DoorError, StandingFiring, WatchRequest};

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
pub struct WatchConfig {
    pub capacity: usize,
    pub rate_window_ms: i64,
}

impl Default for WatchConfig {
    fn default() -> Self {
        Self {
            capacity: 256,
            rate_window_ms: 60_000,
        }
    }
}

#[derive(Clone, Debug, Default, Eq, PartialEq, Serialize, Deserialize)]
pub struct WatchFilter {
    #[serde(default)]
    pub query_ids: BTreeSet<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub matched_id: Option<String>,
}

impl WatchFilter {
    fn matches(&self, event: &StandingFiring) -> bool {
        (self.query_ids.is_empty() || self.query_ids.contains(&event.query_id))
            && self
                .matched_id
                .as_ref()
                .map_or(true, |id| event.matched_ids.contains(id))
    }
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct WatchStats {
    pub received: u64,
    pub retained: usize,
    pub dropped: u64,
    pub filtered: u64,
    pub paused: u64,
    pub out_of_order: u64,
    pub events_per_second: f64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub last_sequence: Option<u64>,
    pub active: bool,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct WatchSnapshot {
    pub events: Vec<StandingFiring>,
    pub stats: WatchStats,
}

#[derive(Clone, Debug, Error, Eq, PartialEq)]
pub enum WatchError {
    #[error("watch capacity must be greater than zero")]
    InvalidCapacity,
    #[error("watch rate window must be greater than zero")]
    InvalidRateWindow,
    #[error("watch state lock was poisoned")]
    Poisoned,
    #[error(transparent)]
    Door(#[from] DoorError),
}

#[derive(Clone, Debug)]
pub struct WatchBuffer {
    config: WatchConfig,
    filter: WatchFilter,
    events: VecDeque<StandingFiring>,
    rate_buckets: BTreeMap<i64, u64>,
    latest_rate_ms: Option<i64>,
    last_sequences: BTreeMap<String, u64>,
    received: u64,
    dropped: u64,
    filtered: u64,
    paused_events: u64,
    out_of_order: u64,
    paused: bool,
    active: bool,
}

impl WatchBuffer {
    pub fn new(config: WatchConfig, filter: WatchFilter) -> Result<Self, WatchError> {
        if config.capacity == 0 {
            return Err(WatchError::InvalidCapacity);
        }
        if config.rate_window_ms <= 0 {
            return Err(WatchError::InvalidRateWindow);
        }
        Ok(Self {
            config,
            filter,
            events: VecDeque::new(),
            rate_buckets: BTreeMap::new(),
            latest_rate_ms: None,
            last_sequences: BTreeMap::new(),
            received: 0,
            dropped: 0,
            filtered: 0,
            paused_events: 0,
            out_of_order: 0,
            paused: false,
            active: false,
        })
    }

    pub fn push(&mut self, event: StandingFiring) {
        self.received = self.received.saturating_add(1);
        self.record_rate(event.occurred_at_ms);

        if let Some(previous) = self.last_sequences.get(&event.query_id) {
            if event.sequence <= *previous {
                self.out_of_order = self.out_of_order.saturating_add(1);
            }
        }
        self.last_sequences
            .entry(event.query_id.clone())
            .and_modify(|sequence| *sequence = (*sequence).max(event.sequence))
            .or_insert(event.sequence);

        if self.paused {
            self.paused_events = self.paused_events.saturating_add(1);
            return;
        }
        if !self.filter.matches(&event) {
            self.filtered = self.filtered.saturating_add(1);
            return;
        }
        if self.events.len() == self.config.capacity {
            self.events.pop_front();
            self.dropped = self.dropped.saturating_add(1);
        }
        self.events.push_back(event);
    }

    pub fn pause(&mut self) {
        self.paused = true;
    }

    pub fn resume(&mut self) {
        self.paused = false;
    }

    pub fn set_filter(&mut self, filter: WatchFilter) {
        self.filter = filter;
    }

    pub fn set_active(&mut self, active: bool) {
        self.active = active;
    }

    pub fn snapshot(&self, now_ms: i64) -> WatchSnapshot {
        let cutoff = now_ms.saturating_sub(self.config.rate_window_ms);
        let rate_count = self
            .rate_buckets
            .range(cutoff..=now_ms)
            .map(|(_, count)| count)
            .sum::<u64>();
        let seconds = self.config.rate_window_ms as f64 / 1_000.0;
        WatchSnapshot {
            events: self.events.iter().cloned().collect(),
            stats: WatchStats {
                received: self.received,
                retained: self.events.len(),
                dropped: self.dropped,
                filtered: self.filtered,
                paused: self.paused_events,
                out_of_order: self.out_of_order,
                events_per_second: rate_count as f64 / seconds,
                last_sequence: self.last_sequences.values().copied().max(),
                active: self.active,
            },
        }
    }

    fn record_rate(&mut self, occurred_at_ms: i64) {
        self.rate_buckets
            .entry(occurred_at_ms)
            .and_modify(|count| *count = count.saturating_add(1))
            .or_insert(1);
        let latest = self
            .latest_rate_ms
            .map_or(occurred_at_ms, |latest| latest.max(occurred_at_ms));
        self.latest_rate_ms = Some(latest);
        let cutoff = latest.saturating_sub(self.config.rate_window_ms);
        self.rate_buckets
            .retain(|timestamp, _| *timestamp >= cutoff);
    }
}

pub struct WatchInspector {
    state: Arc<Mutex<WatchBuffer>>,
    subscription: Option<Box<dyn DoorSubscription>>,
}

impl WatchInspector {
    pub fn attach(
        door: &dyn Door,
        request: WatchRequest,
        config: WatchConfig,
        filter: WatchFilter,
    ) -> Result<Self, WatchError> {
        let state = Arc::new(Mutex::new(WatchBuffer::new(config, filter)?));
        let sink_state = Arc::clone(&state);
        let subscription = door.subscribe(
            request,
            Arc::new(move |event| {
                if let Ok(mut state) = sink_state.lock() {
                    state.push(event);
                }
            }),
        )?;
        state
            .lock()
            .map_err(|_| WatchError::Poisoned)?
            .set_active(true);
        Ok(Self {
            state,
            subscription: Some(subscription),
        })
    }

    pub fn pause(&self) -> Result<(), WatchError> {
        self.state.lock().map_err(|_| WatchError::Poisoned)?.pause();
        Ok(())
    }

    pub fn resume(&self) -> Result<(), WatchError> {
        self.state
            .lock()
            .map_err(|_| WatchError::Poisoned)?
            .resume();
        Ok(())
    }

    pub fn set_filter(&self, filter: WatchFilter) -> Result<(), WatchError> {
        self.state
            .lock()
            .map_err(|_| WatchError::Poisoned)?
            .set_filter(filter);
        Ok(())
    }

    pub fn snapshot(&self, now_ms: i64) -> Result<WatchSnapshot, WatchError> {
        Ok(self
            .state
            .lock()
            .map_err(|_| WatchError::Poisoned)?
            .snapshot(now_ms))
    }

    pub fn stop(&mut self) -> Result<(), WatchError> {
        if let Some(mut subscription) = self.subscription.take() {
            subscription.cancel();
        }
        self.state
            .lock()
            .map_err(|_| WatchError::Poisoned)?
            .set_active(false);
        Ok(())
    }
}

impl Drop for WatchInspector {
    fn drop(&mut self) {
        if let Some(mut subscription) = self.subscription.take() {
            subscription.cancel();
        }
        if let Ok(mut state) = self.state.lock() {
            state.set_active(false);
        }
    }
}
