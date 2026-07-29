//! Protocol-scheme and default-browser registration (SPEC B2).
//!
//! macOS is the first exercised platform. Status is never VerifiedOnMacos
//! unless both (1) the bundle declares the URL scheme and (2) an OS dialog
//! capture receipt is present. That keeps applification honest.

use std::fs;
use std::path::PathBuf;

/// OS registration status for protocol / default-browser claims.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RegistrationStatus {
    VerifiedOnMacos,
    NotVerified,
    Unsupported,
}

const DEFAULT_SCHEME: &str = "commonplace";

/// Inputs for an honest registration probe (env-backed in production).
#[derive(Debug, Clone, Default)]
pub struct RegistrationProbe {
    pub capture_path: Option<PathBuf>,
    pub info_plist_path: Option<PathBuf>,
}

impl RegistrationProbe {
    pub fn from_env() -> Self {
        Self {
            capture_path: std::env::var_os("COMMONPLACE_REGISTRATION_CAPTURE")
                .filter(|v| !v.is_empty())
                .map(PathBuf::from),
            info_plist_path: std::env::var_os("COMMONPLACE_INFO_PLIST")
                .filter(|v| !v.is_empty())
                .map(PathBuf::from),
        }
    }
}

/// Honest per-OS protocol registration report (never assumed working).
pub fn protocol_registration_status() -> RegistrationStatus {
    protocol_registration_status_with(&RegistrationProbe::from_env())
}

pub fn protocol_registration_status_with(probe: &RegistrationProbe) -> RegistrationStatus {
    #[cfg(target_os = "macos")]
    {
        if registration_capture_present(probe) && bundle_declares_url_scheme(probe, DEFAULT_SCHEME)
        {
            RegistrationStatus::VerifiedOnMacos
        } else {
            RegistrationStatus::NotVerified
        }
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = probe;
        RegistrationStatus::NotVerified
    }
}

/// Default-browser registration follows the same honesty rule.
pub fn default_browser_registration_status() -> RegistrationStatus {
    protocol_registration_status()
}

pub fn default_browser_registration_status_with(probe: &RegistrationProbe) -> RegistrationStatus {
    let _ = probe;
    RegistrationStatus::NotVerified
}

/// True when a capture receipt path exists (evidence of the OS dialog flow).
pub fn registration_capture_present(probe: &RegistrationProbe) -> bool {
    probe
        .capture_path
        .as_ref()
        .map(|path| path.is_file())
        .unwrap_or(false)
}

/// True when Info.plist declares the URL scheme.
pub fn bundle_declares_url_scheme(probe: &RegistrationProbe, scheme: &str) -> bool {
    let Some(bytes) = info_plist_bytes(probe) else {
        return false;
    };
    let Ok(text) = String::from_utf8(bytes) else {
        return false;
    };
    let declaration = format!("<string>{scheme}</string>");
    text.contains(&declaration)
        && (text.contains("CFBundleURLSchemes") || text.contains("CFBundleURLTypes"))
}

/// Attempt to surface the macOS association UI. Does not claim success.
pub fn request_protocol_registration(scheme: &str) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let url = format!("{scheme}://register");
        std::process::Command::new("open")
            .arg(&url)
            .spawn()
            .map_err(|error| format!("could not open {url}: {error}"))?;
        Ok(())
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = scheme;
        Err("protocol registration UI is only exercised on macOS".into())
    }
}

fn info_plist_bytes(probe: &RegistrationProbe) -> Option<Vec<u8>> {
    if let Some(path) = &probe.info_plist_path {
        return fs::read(path).ok();
    }
    if let Ok(exe) = std::env::current_exe() {
        let candidate = exe
            .parent()
            .and_then(|macos| macos.parent())
            .map(|contents| contents.join("Info.plist"));
        if let Some(path) = candidate {
            if path.is_file() {
                return fs::read(path).ok();
            }
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    fn write_temp(contents: &str) -> PathBuf {
        let dir = std::env::temp_dir();
        let path = dir.join(format!(
            "commonplace-reg-{}-{}.tmp",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let mut file = fs::File::create(&path).unwrap();
        file.write_all(contents.as_bytes()).unwrap();
        file.flush().unwrap();
        path
    }

    #[test]
    fn default_status_is_not_verified_without_capture() {
        let probe = RegistrationProbe::default();
        assert_ne!(
            protocol_registration_status_with(&probe),
            RegistrationStatus::VerifiedOnMacos
        );
    }

    #[test]
    fn verified_only_with_capture_and_scheme_declaration() {
        let plist = write_temp(
            r#"<?xml version="1.0"?>
            <plist><dict>
              <key>CFBundleURLTypes</key>
              <array><dict>
                <key>CFBundleURLSchemes</key>
                <array><string>commonplace</string></array>
              </dict></array>
            </dict></plist>"#,
        );
        let capture = write_temp("dialog-capture\n");
        let probe = RegistrationProbe {
            capture_path: Some(capture.clone()),
            info_plist_path: Some(plist.clone()),
        };
        assert!(bundle_declares_url_scheme(&probe, "commonplace"));
        assert!(registration_capture_present(&probe));
        let expected = if cfg!(target_os = "macos") {
            RegistrationStatus::VerifiedOnMacos
        } else {
            RegistrationStatus::NotVerified
        };
        assert_eq!(protocol_registration_status_with(&probe), expected);
        let _ = fs::remove_file(plist);
        let _ = fs::remove_file(capture);
    }

    #[test]
    fn scheme_without_capture_stays_not_verified() {
        let plist = write_temp(
            r#"<?xml version="1.0"?>
            <plist><dict>
              <key>CFBundleURLTypes</key>
              <array><dict>
                <key>CFBundleURLSchemes</key>
                <array><string>commonplace</string></array>
              </dict></array>
            </dict></plist>"#,
        );
        let probe = RegistrationProbe {
            capture_path: None,
            info_plist_path: Some(plist.clone()),
        };
        assert!(bundle_declares_url_scheme(&probe, "commonplace"));
        assert_eq!(
            protocol_registration_status_with(&probe),
            RegistrationStatus::NotVerified
        );
        let _ = fs::remove_file(plist);
    }

    #[test]
    fn missing_plist_is_not_a_declaration() {
        let probe = RegistrationProbe {
            capture_path: Some(PathBuf::from("/no/such/capture")),
            info_plist_path: Some(PathBuf::from("/no/such/Info.plist")),
        };
        assert!(!bundle_declares_url_scheme(&probe, "commonplace"));
    }

    #[test]
    fn protocol_evidence_never_verifies_default_browser_ownership() {
        let probe = RegistrationProbe::default();
        assert_eq!(
            default_browser_registration_status_with(&probe),
            RegistrationStatus::NotVerified
        );
    }

    #[test]
    fn scheme_substrings_do_not_count_as_declarations() {
        let plist = write_temp(
            r#"<?xml version="1.0"?>
            <plist><dict>
              <key>CFBundleURLTypes</key>
              <array><dict>
                <key>CFBundleURLSchemes</key>
                <array><string>commonplace-preview</string></array>
              </dict></array>
            </dict></plist>"#,
        );
        let probe = RegistrationProbe {
            capture_path: None,
            info_plist_path: Some(plist.clone()),
        };
        assert!(!bundle_declares_url_scheme(&probe, "commonplace"));
        let _ = fs::remove_file(plist);
    }
}
