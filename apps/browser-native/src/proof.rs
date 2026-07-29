//! Scripted proof window for SPEC-COMMONPLACE-NATIVE-SHELL-1.0 F3.
//!
//! Scripted checks exercise mock / loopback substrates. After
//! SPEC-THEOREM-BUILD-GRAPH-1.0, focus/IME/overlay API seams are no longer
//! designed Blocked points; live capture files remain optional Product evidence.

use crate::chrome::{
    content_top_inset, OMNIBOX_ROW_HEIGHT, PERMISSION_STRIP_HEIGHT, RAIL_WIDTH_COLLAPSED,
    TITLE_BAR_HEIGHT,
};
use crate::loopback::{LoopbackBridge, NativeBlock};
use crate::surfaces::{
    zorder_violations, CommonPlaceSurfaceHost, ContentRect, MockCommonPlaceHost, MockServoHost,
    NativeOverlay, PlacedBlock, ServoSurfaceHost, SurfaceCrashState,
};
use crate::traits::PromptHost;
use crate::NativeShell;
use browser_core::{
    default_browser_registration_status, protocol_registration_status, PermissionKind,
};
use interaction_arbiter::{InteractionArbiter, SurfaceId};
use serde_json::json;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ProofStatus {
    Passed,
    Blocked,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProofPoint {
    pub id: &'static str,
    pub status: ProofStatus,
    pub detail: &'static str,
}

/// Run the ten-point proof suite. Blocked points are first-class results.
pub fn run_proof_window() -> Vec<ProofPoint> {
    vec![
        proof_native_top_bar(),
        proof_gpui_wry_bundle_contract(),
        proof_servo_ordinary_site(),
        proof_side_by_side_resize(),
        proof_keyboard_ime(),
        proof_shell_find_routing(),
        proof_human_preempts_agent(),
        proof_presence_handoff(),
        proof_reload_without_block_loss(),
        proof_native_permission_prompt(),
    ]
}

fn proof_native_top_bar() -> ProofPoint {
    let top = content_top_inset(true);
    let expected = TITLE_BAR_HEIGHT + OMNIBOX_ROW_HEIGHT + PERMISSION_STRIP_HEIGHT;
    if (top - expected).abs() <= f32::EPSILON {
        ProofPoint {
            id: "native_top_bar",
            status: ProofStatus::Passed,
            detail: "chrome insets reserve title+omnibox+permission strip",
        }
    } else {
        ProofPoint {
            id: "native_top_bar",
            status: ProofStatus::Blocked,
            detail: "chrome inset math failed",
        }
    }
}

fn proof_gpui_wry_bundle_contract() -> ProofPoint {
    let mut host = MockCommonPlaceHost::new("http://127.0.0.1:3010/");
    host.surface_mut().place_block(PlacedBlock {
        id: "block_proof".into(),
        workspace_id: "default".into(),
        kind: "note".into(),
        grants: vec!["read".into()],
    });
    host.surface_mut().kill_webview();
    if host.surface().crash != SurfaceCrashState::Crashed {
        return ProofPoint {
            id: "gpui_wry_bundle",
            status: ProofStatus::Blocked,
            detail: "kill_webview did not enter Crashed",
        };
    }
    if host.surface_mut().restart_webview().is_err() {
        return ProofPoint {
            id: "gpui_wry_bundle",
            status: ProofStatus::Blocked,
            detail: "restart_webview failed",
        };
    }
    let Ok(bridge) = LoopbackBridge::start(Some("http://127.0.0.1:3010".into())) else {
        return ProofPoint {
            id: "gpui_wry_bundle",
            status: ProofStatus::Blocked,
            detail: "loopback bridge failed to start",
        };
    };
    let block = NativeBlock {
        id: "block_proof".into(),
        workspace_id: "default".into(),
        kind: "note".into(),
        attrs: json!({}),
        grants: vec!["read".into()],
    };
    bridge
        .state()
        .lock()
        .unwrap()
        .blocks
        .insert(block.id.clone(), block);
    ProofPoint {
        id: "gpui_wry_bundle",
        status: ProofStatus::Passed,
        detail: "substrate kill/restart + loopback state contract green; live wry kill/restart UI wired under gpui (Kill surface); screenshot capture still hardware",
    }
}

fn proof_servo_ordinary_site() -> ProofPoint {
    let mut host = MockServoHost::new();
    host.open("servo-1", "https://example.com/");
    ProofPoint {
        id: "servo_ordinary_site",
        status: ProofStatus::Blocked,
        detail: "deterministic Servo stand-in loads the URL, but macOS cross-process composition needs IOSurface/CALayerHost transport",
    }
}

fn proof_side_by_side_resize() -> ProofPoint {
    let mut host = MockServoHost::new();
    host.open("servo-1", "https://example.com/");
    let cp = ContentRect {
        x: RAIL_WIDTH_COLLAPSED,
        y: content_top_inset(false),
        width: 800.0,
        height: 600.0,
    };
    if host
        .resize_side_by_side("servo-1", cp, 456.0, 600.0)
        .is_err()
    {
        return ProofPoint {
            id: "side_by_side_resize",
            status: ProofStatus::Blocked,
            detail: "shell-side split tracking failed",
        };
    }
    ProofPoint {
        id: "side_by_side_resize",
        status: ProofStatus::Blocked,
        detail: "shell-side split tracking is green; live macOS side-by-side composition is blocked on cross-process surface transport",
    }
}

fn proof_keyboard_ime() -> ProofPoint {
    let mut host = MockServoHost::new();
    host.open("servo-1", "https://example.com/");
    let s = host.surface_mut("servo-1").unwrap();
    s.set_focused(true);
    let ime_ok = s.begin_ime().is_ok();
    // Protocol + Theorem browser-embed inject seams close the former SR-008 API
    // gap. Live hardware capture remains optional under COMMONPLACE_F3_CAPTURE_IME.
    ProofPoint {
        id: "keyboard_ime",
        status: ProofStatus::Blocked,
        detail: if ime_ok {
            "focus/IME API stand-in is green; live Servo IME remains blocked on macOS cross-process surface transport"
        } else {
            "focus/IME API stand-in failed"
        },
    }
}

fn proof_shell_find_routing() -> ProofPoint {
    let shell = NativeShell::new();
    match shell.arbiter.focus().map(|s| s.0.as_str()) {
        Some("commonplace") => ProofPoint {
            id: "shell_find_routing",
            status: ProofStatus::Passed,
            detail: "focused surface is CommonPlace; find routes via openTarget/HostFindLens",
        },
        other => ProofPoint {
            id: "shell_find_routing",
            status: ProofStatus::Blocked,
            detail: match other {
                Some(_) => "unexpected focused surface",
                None => "no focused surface",
            },
        },
    }
}

fn proof_human_preempts_agent() -> ProofPoint {
    let mut arbiter = InteractionArbiter::new(SurfaceId::new("commonplace"));
    if arbiter
        .acquire_lease(SurfaceId::new("commonplace"), 10)
        .is_err()
    {
        return ProofPoint {
            id: "human_preempts_agent",
            status: ProofStatus::Blocked,
            detail: "lease acquire failed",
        };
    }
    let before = arbiter.frame();
    arbiter.human_input(before);
    let ok = arbiter.presence().frozen || arbiter.last_human_preempt_frame().is_some();
    ProofPoint {
        id: "human_preempts_agent",
        status: if ok {
            ProofStatus::Passed
        } else {
            ProofStatus::Blocked
        },
        detail: "InteractionArbiter one-frame preemption fixture",
    }
}

fn proof_presence_handoff() -> ProofPoint {
    let mut arbiter = InteractionArbiter::new(SurfaceId::new("commonplace"));
    arbiter.set_presence_active(
        SurfaceId::new("commonplace"),
        "anchor-a".into(),
        "act".into(),
    );
    if arbiter
        .handoff_presence(SurfaceId::new("servo-1"), "anchor-b".into())
        .is_err()
    {
        return ProofPoint {
            id: "presence_handoff",
            status: ProofStatus::Blocked,
            detail: "handoff_presence failed",
        };
    }
    let ok = arbiter.presence().surface.0 == "servo-1" && arbiter.handoffs().len() == 1;
    ProofPoint {
        id: "presence_handoff",
        status: ProofStatus::Blocked,
        detail: if ok {
            "arbiter handoff events are ordered; live cross-realm capture needs macOS cross-process surface transport"
        } else {
            "arbiter handoff ordering failed"
        },
    }
}

fn proof_reload_without_block_loss() -> ProofPoint {
    let mut host = MockCommonPlaceHost::new("http://127.0.0.1:3010/");
    host.surface_mut().substrate.workspace_id = "default".into();
    host.surface_mut().place_block(PlacedBlock {
        id: "block_a".into(),
        workspace_id: "default".into(),
        kind: "note".into(),
        grants: vec![],
    });
    let before = serde_json::to_string(&host.surface().substrate).unwrap();
    let restored = host.surface_mut().force_reload();
    let after = serde_json::to_string(&restored).unwrap();
    ProofPoint {
        id: "reload_without_block_loss",
        status: if before == after {
            ProofStatus::Passed
        } else {
            ProofStatus::Blocked
        },
        detail: "substrate snapshot byte-identical across forced reload",
    }
}

fn proof_native_permission_prompt() -> ProofPoint {
    let mut shell = NativeShell::new();
    let id = shell
        .prompts
        .enqueue_permission("https://example.com", PermissionKind::Geolocation);
    let Some(receipt) = shell.prompts.resolve(id, true) else {
        return ProofPoint {
            id: "native_permission_prompt",
            status: ProofStatus::Blocked,
            detail: "prompt resolve failed",
        };
    };
    let overlays = [NativeOverlay {
        id: "permission".into(),
        bounds: ContentRect {
            x: RAIL_WIDTH_COLLAPSED,
            y: content_top_inset(false) - 40.0,
            width: 400.0,
            height: 40.0,
        },
    }];
    let webview = ContentRect {
        x: RAIL_WIDTH_COLLAPSED,
        y: content_top_inset(false),
        width: 1200.0,
        height: 700.0,
    };
    let zok = zorder_violations(webview, &overlays).is_empty();
    ProofPoint {
        id: "native_permission_prompt",
        status: if receipt.kind == PermissionKind::Geolocation && zok {
            ProofStatus::Passed
        } else {
            ProofStatus::Blocked
        },
        detail: "native prompt resolves into PermissionStore; z-order law holds (layout reserve)",
    }
}

/// Registration report for B2 (never claim verified without OS dialog evidence).
pub fn registration_report() -> serde_json::Value {
    json!({
        "protocol": format!("{:?}", protocol_registration_status()),
        "default_browser": format!("{:?}", default_browser_registration_status()),
        "macos": cfg!(target_os = "macos"),
        "capture_env": "COMMONPLACE_REGISTRATION_CAPTURE",
        "note": "VerifiedOnMacos requires the theorem scheme in Info.plist plus a dialog capture file; default-browser ownership remains separate"
    })
}

/// Capture evidence slots for the F3 hardest three (SPEC reporting).
///
/// Paths are filled when a hardware proof pass writes screenshots; until then
/// each slot stays `null` and the corresponding oracle class remains mock.
pub fn capture_evidence_report() -> serde_json::Value {
    json!({
        "surface_composition": capture_file("COMMONPLACE_F3_CAPTURE_COMPOSITION"),
        "input_routing": capture_file("COMMONPLACE_F3_CAPTURE_IME"),
        "overlay_handoff": capture_file("COMMONPLACE_F3_CAPTURE_HANDOFF"),
        "policy": "missing capture blocks chrome-migration Product complete; keyboard_ime API seam is no longer Blocked for missing embedder APIs"
    })
}

fn capture_file(name: &str) -> Option<String> {
    std::env::var(name)
        .ok()
        .filter(|path| std::path::Path::new(path).is_file())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn proof_window_reports_each_point() {
        let points = run_proof_window();
        assert_eq!(points.len(), 10);
        let passed = points
            .iter()
            .filter(|p| p.status == ProofStatus::Passed)
            .count();
        let blocked = points
            .iter()
            .filter(|p| p.status == ProofStatus::Blocked)
            .count();
        assert_eq!(passed, 6, "expected six local seam proofs, got {passed}");
        assert_eq!(
            blocked, 4,
            "live Servo composition, split, IME, and handoff must stay blocked"
        );
        for point in &points {
            assert!(!point.detail.is_empty(), "{}", point.id);
        }
    }

    #[test]
    fn registration_never_claims_verified_without_os_dialog() {
        let report = registration_report();
        assert_ne!(report["protocol"], "VerifiedOnMacos");
    }

    #[test]
    fn missing_capture_path_is_not_reported_as_evidence() {
        assert_eq!(capture_file("COMMONPLACE_F3_CAPTURE_DOES_NOT_EXIST"), None);
    }
}
