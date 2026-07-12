//! Voice seam: server-side speech-to-text (STT) and text-to-speech (TTS).
//!
//! Both providers are chosen from the environment so the provider key never
//! reaches the mobile bundle (a phone app is trivially decompiled; secrets stay
//! server-side). STT is OFF by default: audio captures are stored as-is unless
//! `COMMONPLACE_STT_PROVIDER` turns it on. TTS defaults to ElevenLabs and can be
//! pointed at a self-hosted Kokoro node with one env var, no client change.
//!
//! Env (real values live in a gitignored .env / keychain, never in code):
//!   COMMONPLACE_STT_PROVIDER = whisper | elevenlabs    (unset = off)
//!   WHISPER_STT_URL     (default http://127.0.0.1:8080/v1/audio/transcriptions)
//!   WHISPER_STT_MODEL   (default whisper-1)
//!   ELEVENLABS_STT_MODEL (default scribe_v1)
//!   COMMONPLACE_TTS_PROVIDER = elevenlabs | kokoro      (default elevenlabs)
//!   ELEVENLABS_API_KEY            -- referenced by name only
//!   ELEVENLABS_TTS_VOICE_ID (default 21m00Tcm4TlvDq8ikWAM, a stock voice)
//!   ELEVENLABS_TTS_MODEL    (default eleven_turbo_v2_5)
//!   KOKORO_TTS_URL   (default http://127.0.0.1:8081/v1/audio/speech)
//!   KOKORO_TTS_VOICE (default bm_george)
//!   KOKORO_TTS_MODEL (default kokoro)

use std::env;
use std::time::Duration;

use serde_json::{json, Value};

const ELEVENLABS_STT_URL: &str = "https://api.elevenlabs.io/v1/speech-to-text";
const ELEVENLABS_TTS_BASE: &str = "https://api.elevenlabs.io/v1/text-to-speech";
const DEFAULT_WHISPER_URL: &str = "http://127.0.0.1:8080/v1/audio/transcriptions";
const DEFAULT_KOKORO_URL: &str = "http://127.0.0.1:8081/v1/audio/speech";
const DEFAULT_ELEVENLABS_VOICE: &str = "21m00Tcm4TlvDq8ikWAM";
const HTTP_TIMEOUT: Duration = Duration::from_secs(30);

/// Synthesized speech bytes plus the mime the client should play them as.
pub struct Speech {
    pub bytes: Vec<u8>,
    pub mime: String,
}

/// Speech-to-text provider resolved from the environment.
pub enum Transcriber {
    Disabled,
    Whisper { url: String, model: String },
    ElevenLabs { key: String, model: String },
}

impl Transcriber {
    pub fn from_env() -> Self {
        match env::var("COMMONPLACE_STT_PROVIDER").ok().as_deref() {
            Some("whisper") => Transcriber::Whisper {
                url: env::var("WHISPER_STT_URL")
                    .unwrap_or_else(|_| DEFAULT_WHISPER_URL.to_string()),
                model: env::var("WHISPER_STT_MODEL").unwrap_or_else(|_| "whisper-1".to_string()),
            },
            Some("elevenlabs") => match env::var("ELEVENLABS_API_KEY") {
                Ok(key) if !key.is_empty() => Transcriber::ElevenLabs {
                    key,
                    model: env::var("ELEVENLABS_STT_MODEL")
                        .unwrap_or_else(|_| "scribe_v1".to_string()),
                },
                _ => Transcriber::Disabled,
            },
            _ => Transcriber::Disabled,
        }
    }

    pub fn is_enabled(&self) -> bool {
        !matches!(self, Transcriber::Disabled)
    }

    /// Transcribe audio bytes to text. `Ok(None)` when disabled or empty result.
    pub async fn transcribe(
        &self,
        bytes: &[u8],
        mime: Option<&str>,
    ) -> Result<Option<String>, String> {
        let name = file_name_for(mime);
        match self {
            Transcriber::Disabled => Ok(None),
            Transcriber::Whisper { url, model } => {
                let form = reqwest::multipart::Form::new()
                    .part("file", audio_part(bytes, name, mime)?)
                    .text("model", model.clone())
                    .text("response_format", "json");
                let resp = client()?
                    .post(url)
                    .multipart(form)
                    .send()
                    .await
                    .map_err(|error| error.to_string())?;
                parse_text_json(resp).await
            }
            Transcriber::ElevenLabs { key, model } => {
                let form = reqwest::multipart::Form::new()
                    .part("file", audio_part(bytes, name, mime)?)
                    .text("model_id", model.clone());
                let resp = client()?
                    .post(ELEVENLABS_STT_URL)
                    .header("xi-api-key", key)
                    .multipart(form)
                    .send()
                    .await
                    .map_err(|error| error.to_string())?;
                parse_text_json(resp).await
            }
        }
    }
}

/// Text-to-speech provider resolved from the environment.
pub enum Voice {
    ElevenLabs {
        key: String,
        voice: String,
        model: String,
    },
    Kokoro {
        url: String,
        voice: String,
        model: String,
    },
}

impl Voice {
    /// Resolve the configured provider. Errs when ElevenLabs is selected but no
    /// key is present, so the `/tts` route fails loud instead of silently.
    pub fn from_env() -> Result<Self, String> {
        match env::var("COMMONPLACE_TTS_PROVIDER")
            .ok()
            .as_deref()
            .unwrap_or("elevenlabs")
        {
            "kokoro" => Ok(Voice::Kokoro {
                url: env::var("KOKORO_TTS_URL").unwrap_or_else(|_| DEFAULT_KOKORO_URL.to_string()),
                voice: env::var("KOKORO_TTS_VOICE").unwrap_or_else(|_| "bm_george".to_string()),
                model: env::var("KOKORO_TTS_MODEL").unwrap_or_else(|_| "kokoro".to_string()),
            }),
            _ => {
                let key = env::var("ELEVENLABS_API_KEY")
                    .map_err(|_| "ELEVENLABS_API_KEY is not set".to_string())?;
                if key.is_empty() {
                    return Err("ELEVENLABS_API_KEY is empty".to_string());
                }
                Ok(Voice::ElevenLabs {
                    key,
                    voice: env::var("ELEVENLABS_TTS_VOICE_ID")
                        .unwrap_or_else(|_| DEFAULT_ELEVENLABS_VOICE.to_string()),
                    model: env::var("ELEVENLABS_TTS_MODEL")
                        .unwrap_or_else(|_| "eleven_turbo_v2_5".to_string()),
                })
            }
        }
    }

    pub async fn synthesize(
        &self,
        text: &str,
        voice_override: Option<&str>,
    ) -> Result<Speech, String> {
        match self {
            Voice::ElevenLabs { key, voice, model } => {
                let voice_id = voice_override.unwrap_or(voice);
                let resp = client()?
                    .post(format!("{ELEVENLABS_TTS_BASE}/{voice_id}"))
                    .header("xi-api-key", key)
                    .json(&elevenlabs_tts_body(text, model))
                    .send()
                    .await
                    .map_err(|error| error.to_string())?;
                collect_audio(resp).await
            }
            Voice::Kokoro { url, voice, model } => {
                let voice_name = voice_override.unwrap_or(voice);
                let resp = client()?
                    .post(url)
                    .json(&kokoro_tts_body(text, voice_name, model))
                    .send()
                    .await
                    .map_err(|error| error.to_string())?;
                collect_audio(resp).await
            }
        }
    }
}

fn client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(HTTP_TIMEOUT)
        .build()
        .map_err(|error| error.to_string())
}

fn audio_part(
    bytes: &[u8],
    name: &'static str,
    mime: Option<&str>,
) -> Result<reqwest::multipart::Part, String> {
    let part = reqwest::multipart::Part::bytes(bytes.to_vec()).file_name(name);
    match mime {
        Some(mime) => part.mime_str(mime).map_err(|error| error.to_string()),
        None => Ok(part),
    }
}

/// A filename with an extension the STT services accept, derived from the mime.
fn file_name_for(mime: Option<&str>) -> &'static str {
    match mime {
        Some(mime) if mime.contains("wav") => "audio.wav",
        Some(mime) if mime.contains("mp3") || mime.contains("mpeg") => "audio.mp3",
        Some(mime) if mime.contains("webm") => "audio.webm",
        Some(mime) if mime.contains("m4a") || mime.contains("mp4") || mime.contains("aac") => {
            "audio.m4a"
        }
        // expo-audio HIGH_QUALITY records m4a on iOS; safe default.
        _ => "audio.m4a",
    }
}

fn elevenlabs_tts_body(text: &str, model: &str) -> Value {
    json!({ "text": text, "model_id": model })
}

fn kokoro_tts_body(input: &str, voice: &str, model: &str) -> Value {
    json!({ "model": model, "input": input, "voice": voice, "response_format": "mp3" })
}

async fn parse_text_json(resp: reqwest::Response) -> Result<Option<String>, String> {
    let status = resp.status();
    let body = resp.text().await.map_err(|error| error.to_string())?;
    if !status.is_success() {
        return Err(format!(
            "transcription HTTP {status}: {}",
            truncate(&body, 200)
        ));
    }
    let value: Value = serde_json::from_str(&body).map_err(|error| error.to_string())?;
    let text = value
        .get("text")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .trim()
        .to_string();
    Ok((!text.is_empty()).then_some(text))
}

async fn collect_audio(resp: reqwest::Response) -> Result<Speech, String> {
    let status = resp.status();
    let mime = resp
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .map(str::to_string);
    let bytes = resp.bytes().await.map_err(|error| error.to_string())?;
    if !status.is_success() {
        return Err(format!(
            "tts HTTP {status}: {}",
            truncate(&String::from_utf8_lossy(&bytes), 200)
        ));
    }
    let mime = mime
        .filter(|mime| mime.starts_with("audio/"))
        .unwrap_or_else(|| "audio/mpeg".to_string());
    Ok(Speech {
        bytes: bytes.to_vec(),
        mime,
    })
}

fn truncate(text: &str, max: usize) -> String {
    let mut chars = text.chars();
    let truncated: String = chars.by_ref().take(max).collect();
    if chars.next().is_some() {
        format!("{truncated}...")
    } else {
        text.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn file_name_tracks_mime_extension() {
        assert_eq!(file_name_for(Some("audio/wav")), "audio.wav");
        assert_eq!(file_name_for(Some("audio/mpeg")), "audio.mp3");
        assert_eq!(file_name_for(Some("audio/m4a")), "audio.m4a");
        assert_eq!(file_name_for(Some("audio/webm")), "audio.webm");
        // Unknown / absent mime falls back to the iOS expo-audio default.
        assert_eq!(file_name_for(None), "audio.m4a");
        assert_eq!(file_name_for(Some("application/octet-stream")), "audio.m4a");
    }

    #[test]
    fn tts_bodies_match_provider_wire_shapes() {
        let el = elevenlabs_tts_body("hello", "eleven_turbo_v2_5");
        assert_eq!(el["text"], "hello");
        assert_eq!(el["model_id"], "eleven_turbo_v2_5");

        let ko = kokoro_tts_body("hello", "bm_george", "kokoro");
        assert_eq!(ko["input"], "hello");
        assert_eq!(ko["voice"], "bm_george");
        assert_eq!(ko["model"], "kokoro");
        assert_eq!(ko["response_format"], "mp3");
    }

    #[test]
    fn truncate_bounds_error_snippets() {
        assert_eq!(truncate("short", 200), "short");
        assert_eq!(truncate("abcdef", 3), "abc...");
        assert_eq!(truncate("ééé", 2), "éé...");
    }
}
