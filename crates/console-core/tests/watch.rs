use std::collections::BTreeSet;

use commonplace_console_core::watch::{WatchBuffer, WatchConfig, WatchFilter, WatchInspector};
use commonplace_console_core::{fixture_snapshot, FixtureDoor, StandingFiring, WatchRequest};

mod watch {
    use super::*;

    #[test]
    fn scripted_events_arrive_in_source_order_with_rate() {
        let mut buffer = WatchBuffer::new(
            WatchConfig {
                capacity: 8,
                rate_window_ms: 2_000,
            },
            WatchFilter::default(),
        )
        .expect("watch buffer");
        buffer.set_active(true);
        buffer.push(firing(1, 0, "alpha"));
        buffer.push(firing(2, 500, "alpha"));
        buffer.push(firing(3, 1_000, "alpha"));

        let snapshot = buffer.snapshot(1_000);
        assert_eq!(
            snapshot
                .events
                .iter()
                .map(|event| event.sequence)
                .collect::<Vec<_>>(),
            [1, 2, 3]
        );
        assert_eq!(snapshot.stats.events_per_second, 1.5);
        assert_eq!(snapshot.stats.last_sequence, Some(3));
        assert_eq!(snapshot.stats.out_of_order, 0);
        assert!(snapshot.stats.active);
    }

    #[test]
    fn burst_holds_ring_bound_and_counts_drops() {
        let mut buffer = WatchBuffer::new(
            WatchConfig {
                capacity: 3,
                rate_window_ms: 1_000,
            },
            WatchFilter::default(),
        )
        .expect("watch buffer");
        for sequence in 1..=100 {
            buffer.push(firing(sequence, 1_000, "alpha"));
        }
        let snapshot = buffer.snapshot(1_000);
        assert_eq!(snapshot.events.len(), 3);
        assert_eq!(
            snapshot
                .events
                .iter()
                .map(|event| event.sequence)
                .collect::<Vec<_>>(),
            [98, 99, 100]
        );
        assert_eq!(snapshot.stats.dropped, 97);
        assert_eq!(snapshot.stats.events_per_second, 100.0);
    }

    #[test]
    fn rate_window_keeps_recent_events_across_second_boundaries() {
        let mut buffer = WatchBuffer::new(
            WatchConfig {
                capacity: 8,
                rate_window_ms: 1_000,
            },
            WatchFilter::default(),
        )
        .expect("watch buffer");
        buffer.push(firing(1, 1_999, "alpha"));

        assert_eq!(buffer.snapshot(2_499).stats.events_per_second, 1.0);
        assert_eq!(buffer.snapshot(3_000).stats.events_per_second, 0.0);
    }

    #[test]
    fn pause_resume_filter_and_order_detection_are_explicit() {
        let mut buffer = WatchBuffer::new(
            WatchConfig::default(),
            WatchFilter {
                query_ids: BTreeSet::from(["alpha".into()]),
                matched_id: Some("golden:keep".into()),
            },
        )
        .expect("watch buffer");
        buffer.push(firing(2, 1_000, "beta"));
        buffer.push(firing(3, 2_000, "alpha"));
        buffer.pause();
        buffer.push(firing(4, 3_000, "alpha"));
        buffer.resume();
        buffer.push(firing(2, 4_000, "alpha"));

        let snapshot = buffer.snapshot(4_000);
        assert!(snapshot.events.is_empty());
        assert_eq!(snapshot.stats.filtered, 3);
        assert_eq!(snapshot.stats.paused, 1);
        assert_eq!(snapshot.stats.out_of_order, 1);
    }

    #[test]
    fn inspector_uses_caller_request_and_releases_subscription() {
        let door = FixtureDoor::default();
        {
            let inspector = WatchInspector::attach(
                &door,
                WatchRequest {
                    query_id: "standing:people-updated".into(),
                    from_sequence: 2,
                },
                WatchConfig {
                    capacity: 2,
                    rate_window_ms: 60_000,
                },
                WatchFilter::default(),
            )
            .expect("attach inspector");
            assert_eq!(door.subscription_count(), 1);
            let snapshot = inspector.snapshot(1_784_627_100_000).expect("snapshot");
            assert_eq!(snapshot.events.len(), 2);
            assert_eq!(snapshot.events[0].sequence, 2);
            assert_eq!(snapshot.events[1].sequence, 3);
        }
        assert_eq!(door.subscription_count(), 0);
    }

    #[test]
    fn empty_stream_and_explicit_stop_are_safe() {
        let door = FixtureDoor::from_snapshot({
            let mut snapshot = fixture_snapshot();
            snapshot.firings.clear();
            snapshot
        });
        let mut inspector = WatchInspector::attach(
            &door,
            WatchRequest {
                query_id: "standing:people-updated".into(),
                from_sequence: 0,
            },
            WatchConfig::default(),
            WatchFilter::default(),
        )
        .expect("attach empty inspector");
        assert!(inspector.snapshot(0).expect("snapshot").events.is_empty());
        inspector.stop().expect("stop");
        inspector.stop().expect("idempotent stop");
        assert_eq!(door.subscription_count(), 0);
        assert!(
            !inspector
                .snapshot(0)
                .expect("stopped snapshot")
                .stats
                .active
        );
    }

    #[test]
    fn scripted_live_mutations_flow_after_attach() {
        let door = FixtureDoor::from_snapshot({
            let mut snapshot = fixture_snapshot();
            snapshot.firings.clear();
            snapshot
        });
        let inspector = WatchInspector::attach(
            &door,
            WatchRequest {
                query_id: "standing:people-updated".into(),
                from_sequence: 10,
            },
            WatchConfig::default(),
            WatchFilter::default(),
        )
        .expect("attach live inspector");

        assert_eq!(
            door.emit_firing(firing(9, 9_000, "standing:people-updated")),
            0
        );
        for sequence in 10..=12 {
            assert_eq!(
                door.emit_firing(firing(
                    sequence,
                    sequence as i64 * 1_000,
                    "standing:people-updated",
                )),
                1
            );
        }
        assert_eq!(
            inspector
                .snapshot(12_000)
                .expect("live snapshot")
                .events
                .iter()
                .map(|event| event.sequence)
                .collect::<Vec<_>>(),
            [10, 11, 12]
        );

        drop(inspector);
        assert_eq!(door.subscription_count(), 0);
        assert_eq!(
            door.emit_firing(firing(13, 13_000, "standing:people-updated")),
            0
        );
    }

    fn firing(sequence: u64, occurred_at_ms: i64, query_id: &str) -> StandingFiring {
        StandingFiring {
            query_id: query_id.into(),
            sequence,
            occurred_at_ms,
            matched_ids: vec!["golden:other".into()],
            receipt_id: format!("receipt:{query_id}:{sequence}"),
        }
    }
}
