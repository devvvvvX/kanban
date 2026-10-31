export type NotificationSound = "chime" | "bell" | "pop" | "ping" | "subtle" | "alarm";

export interface SoundOption {
  id: NotificationSound;
  name: string;
  description: string;
}

export const NOTIFICATION_SOUNDS: SoundOption[] = [
  { id: "chime", name: "Chime", description: "Gentle dual harmonic chime" },
  { id: "bell", name: "Bell", description: "Classic resonant bell tone" },
  { id: "alarm", name: "Radar Ring", description: "Repeating macOS radar alarm ring" },
  { id: "pop", name: "Pop", description: "Snappy modern tactile click" },
  { id: "ping", name: "Ping", description: "Crisp crystal high ping" },
  { id: "subtle", name: "Subtle Synth", description: "Soft warm harmonic chord" },
];

const SOUND_STORAGE_KEY = "kanban_notification_sound";
const SOUND_ENABLED_STORAGE_KEY = "kanban_notification_sound_enabled";
const CONTINUOUS_RING_STORAGE_KEY = "kanban_continuous_ring_enabled";

const memoryStore = new Map<string, string>();

function safeGetItem(key: string): string | null {
  try {
    if (typeof localStorage !== "undefined") {
      return localStorage.getItem(key);
    }
  } catch {
    // Fall back to memory
  }
  return memoryStore.get(key) ?? null;
}

function safeSetItem(key: string, value: string): void {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(key, value);
    }
  } catch {
    // Fall back to memory
  }
  memoryStore.set(key, value);
}

export function getNotificationSoundEnabled(): boolean {
  const val = safeGetItem(SOUND_ENABLED_STORAGE_KEY);
  return val === null ? true : val === "true";
}

export function setNotificationSoundEnabled(enabled: boolean): void {
  safeSetItem(SOUND_ENABLED_STORAGE_KEY, String(enabled));
}

export function getContinuousRingEnabled(): boolean {
  const val = safeGetItem(CONTINUOUS_RING_STORAGE_KEY);
  return val === null ? true : val === "true";
}

export function setContinuousRingEnabled(enabled: boolean): void {
  safeSetItem(CONTINUOUS_RING_STORAGE_KEY, String(enabled));
}

export function getSelectedNotificationSound(): NotificationSound {
  const val = safeGetItem(SOUND_STORAGE_KEY) as NotificationSound | null;
  if (val && NOTIFICATION_SOUNDS.some((s) => s.id === val)) {
    return val;
  }
  return "chime";
}

export function setSelectedNotificationSound(sound: NotificationSound): void {
  safeSetItem(SOUND_STORAGE_KEY, sound);
}

// Continuous Ring State Engine
let ringIntervalId: any = null;
let isRingingActive = false;
let currentRingingSound: NotificationSound | null = null;

export function isContinuousRingActive(): boolean {
  return isRingingActive;
}

export function getCurrentRingingSound(): NotificationSound | null {
  return currentRingingSound;
}

/**
 * Starts continuous repeating ringing until stopped by stopContinuousRing().
 * Dispatches 'kanban:ring-state-changed' so UI components can reflect live ringing state.
 */
export function startContinuousRing(soundName?: NotificationSound, forcePlay = false): void {
  if (!forcePlay && !getNotificationSoundEnabled()) {
    return;
  }

  const sound = soundName || getSelectedNotificationSound();

  if (isRingingActive && currentRingingSound === sound) {
    return;
  }

  stopContinuousRing();
  isRingingActive = true;
  currentRingingSound = sound;

  // Play initial ring immediately
  playNotificationSound(sound, true);

  // Repeat cadence: 1.5s for alarm/radar, 1.8s for others
  const intervalMs = sound === "alarm" ? 1500 : 1800;
  ringIntervalId = setInterval(() => {
    if (!isRingingActive) {
      if (ringIntervalId) {
        clearInterval(ringIntervalId);
        ringIntervalId = null;
      }
      return;
    }
    playNotificationSound(sound, true);
  }, intervalMs);

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("kanban:ring-state-changed", {
        detail: { ringing: true, sound },
      })
    );
  }
}

/**
 * Stops continuous repeating ringing immediately.
 */
export function stopContinuousRing(): void {
  if (ringIntervalId) {
    clearInterval(ringIntervalId);
    ringIntervalId = null;
  }
  const wasRinging = isRingingActive;
  isRingingActive = false;
  currentRingingSound = null;

  if (wasRinging && typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("kanban:ring-state-changed", {
        detail: { ringing: false },
      })
    );
  }
}

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtx) return null;
  if (!audioCtx || audioCtx.state === "closed") {
    audioCtx = new AudioCtx();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/**
 * Plays the selected notification sound using Web Audio API synthesis.
 * Safe in all environments (browser, Tauri, test).
 */
export function playNotificationSound(soundName?: NotificationSound, forcePlay = false): void {
  if (!forcePlay && !getNotificationSoundEnabled()) {
    return;
  }

  const sound = soundName || getSelectedNotificationSound();
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;

    switch (sound) {
      case "chime": {
        // Dual harmonic chime: D5 (587.33Hz) and A5 (880Hz)
        playTone(ctx, 587.33, now, 0.5, 0.15);
        playTone(ctx, 880, now + 0.08, 0.6, 0.2);
        break;
      }

      case "bell": {
        // Resonant bell: Fundamental 830Hz + harmonic 1660Hz
        playTone(ctx, 830.61, now, 0.8, 0.22, "sine");
        playTone(ctx, 1661.22, now, 0.6, 0.08, "triangle");
        break;
      }

      case "pop": {
        // Tactile snappy pop: pitch sweep downward
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(500, now);
        osc.frequency.exponentialRampToValueAtTime(80, now + 0.08);

        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.09);
        break;
      }

      case "ping": {
        // Crisp high crystal ping: 1200Hz + 2400Hz
        playTone(ctx, 1200, now, 0.35, 0.18, "sine");
        playTone(ctx, 2400, now, 0.25, 0.08, "triangle");
        break;
      }

      case "alarm": {
        // High attention radar alarm cadence:
        playTone(ctx, 987.77, now, 0.12, 0.5, "sine");
        playTone(ctx, 1318.51, now + 0.04, 0.14, 0.6, "sine");
        playTone(ctx, 987.77, now + 0.18, 0.12, 0.5, "sine");
        playTone(ctx, 1318.51, now + 0.22, 0.22, 0.6, "sine");
        break;
      }

      case "subtle": {
        // Warm triad chord: C5 (523Hz), E5 (659Hz), G5 (784Hz)
        playTone(ctx, 523.25, now, 0.5, 0.1, "sine");
        playTone(ctx, 659.25, now + 0.04, 0.55, 0.12, "sine");
        playTone(ctx, 783.99, now + 0.08, 0.6, 0.14, "sine");
        break;
      }

      default: {
        playTone(ctx, 659.25, now, 0.4, 0.15);
      }
    }
  } catch {
    // Ignore audio playback errors (e.g. autoplay restrictions)
  }
}

function playTone(
  ctx: AudioContext,
  freq: number,
  startTime: number,
  duration: number,
  volume: number,
  type: OscillatorType = "sine"
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, startTime);

  gain.gain.setValueAtTime(volume, startTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(startTime);
  osc.stop(startTime + duration + 0.02);
}
