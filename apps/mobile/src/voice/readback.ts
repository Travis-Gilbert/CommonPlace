/**
 * TTS read-back: POST answer text to the node's /tts, play the returned audio.
 *
 * The provider key never touches the app bundle (a phone is trivially
 * decompiled); /tts holds it server-side. ElevenLabs answers today; pointing the
 * server at a self-hosted Kokoro node later is an env swap with no client change.
 */
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { File, Paths } from 'expo-file-system';

import { readInstanceSettings } from '@/api/instance';

let current: AudioPlayer | null = null;

/** Stop any in-flight read-back and release its player. */
export function stopSpeaking(): void {
  try {
    current?.remove();
  } catch {
    // player already gone
  }
  current = null;
}

/**
 * Speak `text` through the configured server voice. Resolves once playback has
 * started; throws if the node is unreachable or TTS is unconfigured (the caller
 * decides whether to surface that or stay quiet).
 */
export async function speak(text: string, voice?: string): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) return;
  stopSpeaking();

  const settings = await readInstanceSettings();
  const res = await fetch(`${settings.url.replace(/\/$/, '')}/tts`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': settings.apiKey },
    body: JSON.stringify(voice ? { text: trimmed, voice } : { text: trimmed }),
  });
  if (!res.ok) throw new Error(`TTS HTTP ${res.status}`);

  // expo-audio plays from a uri, not a buffer: stash the mp3 in the cache dir.
  const bytes = new Uint8Array(await res.arrayBuffer());
  const file = new File(Paths.cache, `readback-${Date.now()}.mp3`);
  file.write(bytes);

  // Read-back should be audible even with the ringer switch on silent.
  await setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
  current = createAudioPlayer(file.uri);
  current.play();
}
