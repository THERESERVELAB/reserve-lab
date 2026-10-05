import type { LogMomentPlan, LogMomentTier, LogMomentTone } from "@/lib/ui/log-moment";

/* ════════════════════════════════════════════════════════════════════════
   LOG SOUND — what a member's log sounds like, as data.

   The room already answers a log with light (log-moment). Sound rides the
   same beats: a tone at impact, when the row presses, and one at arrival,
   when the light lands. Everything is synthesised from a handful of sine and
   triangle voices, so there are no audio files, no downloads and nothing to
   license.

   The register (owner direction 2026-09-19): a luxury car door, a watch
   haptic, a quiet rank-up. Heavy and soft at impact; a warm chord at
   arrival; a short rise for a milestone. Never a beep, never a buzz, never
   louder than a whisper next to the room.

   Pure: no Web Audio here. The engine turns a cue into oscillators.
   ════════════════════════════════════════════════════════════════════════ */

export type SoundVoice = {
  wave: "sine" | "triangle";
  /** Hz at the start. */
  freq: number;
  /** Hz it glides to over the voice, when set. */
  glideTo?: number;
  /** Peak gain, 0–1, before the master. */
  gain: number;
  /** Seconds. */
  attack: number;
  /** Seconds the peak holds before the release. */
  hold: number;
  /** Seconds to silence. */
  release: number;
  /** Seconds after the cue starts. */
  delay: number;
};

export type SoundCue = {
  name: "tick" | "thump" | "chord" | "rise" | "clear" | "ui-tap" | "ui-select" | "ui-toggle-on" | "ui-toggle-off" | "ui-open" | "ui-close" | "ui-room";
  voices: SoundVoice[];
};

export type LogSoundPlan = { impact: SoundCue | null; arrival: SoundCue | null };

/** The whole set, below the room. Loud enough for a phone speaker held at
    arm's length; the compressor upstream keeps several cues at once clean. */
export const LOG_SOUND_MASTER_GAIN = 0.9;

const v = (partial: Partial<SoundVoice> & Pick<SoundVoice, "freq" | "gain">): SoundVoice => ({
  wave: "sine",
  attack: 0.008,
  hold: 0,
  release: 0.25,
  delay: 0,
  ...partial,
});

/* Notes, in Hz. The set sits in B major, the room's warm key. */
const B3 = 246.94;
const E5 = 659.25;
const GS5 = 830.61;
const B5 = 987.77;
const E6 = 1318.51;
const FS6 = 1479.98;

/** A weight landing: felt more than heard. A luxury door closing. */
const thump = (weight: number): SoundVoice[] => [
  v({ freq: 92, glideTo: 54, gain: 0.34 * weight, attack: 0.004, release: 0.17 }),
  v({ wave: "triangle", freq: 2100, gain: 0.035 * weight, attack: 0.001, release: 0.028 }),
];

/** A watch click: one clean tick with a little body under it. */
const tick = (): SoundVoice[] => [
  v({ freq: 1760, gain: 0.1, attack: 0.002, release: 0.065 }),
  v({ freq: 118, glideTo: 74, gain: 0.2, attack: 0.004, release: 0.085 }),
];

/** A warm chord landing with the light: the fifth, a bed under it. */
const chord = (): SoundVoice[] => [
  v({ freq: B5, gain: 0.11, attack: 0.012, release: 0.95 }),
  v({ freq: FS6, gain: 0.055, attack: 0.014, release: 0.8, delay: 0.01 }),
  v({ freq: B3, gain: 0.08, attack: 0.02, release: 0.6 }),
];

/** A short rise for a milestone: three notes up, a fourth on the day's biggest, with a swell beneath. */
const rise = (intensity: number): SoundVoice[] => {
  const notes = intensity >= 1.7 ? [E5, GS5, B5, E6] : [E5, GS5, B5];
  const voices: SoundVoice[] = notes.flatMap((freq, i) => [
    v({ freq, gain: 0.1, attack: 0.012, release: 0.85, delay: i * 0.095 }),
    /* A shimmer an octave up, quiet. */
    v({ freq: freq * 2, gain: 0.03, attack: 0.012, release: 0.5, delay: i * 0.095 }),
  ]);
  voices.push(v({ freq: 61.7, gain: 0.16 * Math.min(intensity, 1.7), attack: 0.09, hold: 0.1, release: 0.7 }));
  return voices;
};

/** Undo: two soft notes stepping down. Quiet; nothing was lost, only cleared. */
const stepDown = (): SoundVoice[] => [
  v({ freq: 880, gain: 0.06, attack: 0.008, release: 0.22 }),
  v({ freq: E5, gain: 0.06, attack: 0.008, release: 0.3, delay: 0.11 }),
];

/**
 * The cues for a moment. A null cue is silence at that beat. Nothing plays
 * for a plan that draws nothing (a hidden tab, the ambient pause): sound
 * follows the same switch as motion, and a member who asked the room to be
 * still gets a still room.
 */
export function planLogSound(
  moment: { tier: LogMomentTier; tone: LogMomentTone; milestone: { intensity: number } | null },
  plan: Pick<LogMomentPlan, "visible" | "impact" | "boom" | "intensity">,
): LogSoundPlan {
  if (!plan.visible) return { impact: null, arrival: null };
  if (moment.tone === "clear") return { impact: { name: "clear", voices: stepDown() }, arrival: null };
  const milestone = moment.milestone !== null;
  if (moment.tier === "mark" && !milestone) return { impact: { name: "tick", voices: tick() }, arrival: null };
  /* Reduced motion draws no beats: the log still lands as one sound, at once. */
  if (!plan.impact) {
    return {
      impact: milestone ? { name: "rise", voices: rise(moment.milestone?.intensity ?? 1.4) } : { name: "chord", voices: chord() },
      arrival: null,
    };
  }
  const weight = plan.boom ? 1 : 0.7;
  return {
    impact: { name: "thump", voices: thump(weight) },
    arrival: milestone ? { name: "rise", voices: rise(plan.intensity) } : { name: "chord", voices: chord() },
  };
}

/* ─── The interface's own voice ───────────────────────────────────────────
   Owner direction 2026-09-19: the water tick gave the room life; carry it
   through everything the member touches. One family, all quieter than a
   log: a log is an event, a tap is a touch. */

export type UiSoundKind = "tap" | "select" | "toggle-on" | "toggle-off" | "open" | "close" | "room";

/** Interface sounds sit under the logs: the water tick is the ceiling. */
export const UI_SOUND_SCALE = 0.55;

const scaled = (voices: SoundVoice[], by: number) => voices.map((voice) => ({ ...voice, gain: voice.gain * by }));

/* ─── Rooms have their own key ────────────────────────────────────────────
   Owner direction 2026-09-19: "a different piano sound per room, so it's not
   too repetitive." Arriving in a room plays its chord as a soft piano
   arpeggio; a tap inside it rings on the room's own note. */

export type SoundRoom = "apex" | "training" | "fuel" | "recovery" | "schedule" | "vault" | "clinical" | "studio" | "house";

/** Which room's key a view plays in. Anything unlisted plays the house key. */
export function soundRoomOf(view: string): SoundRoom {
  if (view === "dashboard") return "apex";
  if (view === "training" || view === "mesocycle-planner" || view === "performance-intelligence") return "training";
  if (view === "nutrition") return "fuel";
  if (view === "recovery") return "recovery";
  if (view === "schedule-command") return "schedule";
  if (view === "supplements" || view === "enhanced-monitor" || view === "protocol-command") return "vault";
  if (view === "bloodwork" || view === "biomarker-intelligence") return "clinical";
  if (view === "physique" || view === "progress-photos" || view === "measurements" || view.includes("physique")) return "studio";
  return "house";
}

/** Each room's chord, low to high, in Hz. */
export const ROOM_CHORDS: Record<SoundRoom, readonly number[]> = {
  /* B major add9 — the house key, open and certain. */
  apex: [493.88, 739.99, 1108.73],
  /* D minor — driven, a little dark. */
  training: [293.66, 440.0, 698.46],
  /* F major 7 — warm, a kitchen at dusk. */
  fuel: [349.23, 440.0, 659.25],
  /* E-flat major 9 — soft and low, the lights going down. */
  recovery: [311.13, 392.0, 587.33],
  /* G sus2 — steady, unresolved, the day ahead. */
  schedule: [392.0, 440.0, 587.33],
  /* C-sharp minor — private, measured. */
  vault: [277.18, 415.3, 659.25],
  /* A open fifth — clean, clinical, nothing added. */
  clinical: [440.0, 659.25],
  /* E major 7 — bright, a gallery light. */
  studio: [329.63, 493.88, 622.25],
  house: [493.88, 739.99],
};

/** One piano note: a fast strike, a fundamental that rings, overtones that fade first. */
const pianoNote = (freq: number, gain: number, delay: number, ring = 1.1): SoundVoice[] => [
  v({ freq, gain, attack: 0.003, release: ring, delay }),
  v({ freq: freq * 2, gain: gain * 0.34, attack: 0.002, release: ring * 0.45, delay }),
  v({ wave: "triangle", freq: freq * 3, gain: gain * 0.1, attack: 0.002, release: ring * 0.22, delay }),
];

/** The room's chord, rolled low to high, over a quiet floor. */
const roomArrival = (room: SoundRoom): SoundVoice[] => [
  v({ freq: ROOM_CHORDS[room][0] / 4, gain: 0.09, attack: 0.05, hold: 0.03, release: 0.55 }),
  ...ROOM_CHORDS[room].flatMap((freq, i) => pianoNote(freq, 0.07 - i * 0.012, 0.02 + i * 0.075)),
];

/** A tap rings on the room's root, two octaves up, over the water tick's body. */
const roomTap = (room: SoundRoom): SoundVoice[] => {
  const [, body] = scaled(tick(), UI_SOUND_SCALE);
  return [v({ freq: ROOM_CHORDS[room][0] * 4, gain: 0.055, attack: 0.002, release: 0.07 }), body];
};

/** The cue for an interface interaction, in the key of the room it happens in. */
export function uiSoundCue(kind: UiSoundKind, room: SoundRoom = "house"): SoundCue {
  switch (kind) {
    case "tap":
      /* The water tick, softer, ringing on the room's note. */
      return { name: "ui-tap", voices: roomTap(room) };
    case "select":
      /* A tab: lighter and a touch higher, with only a breath of body. */
      return {
        name: "ui-select",
        voices: [v({ freq: 2093, gain: 0.07, attack: 0.002, release: 0.05 }), v({ freq: 160, glideTo: 110, gain: 0.08, attack: 0.003, release: 0.06 })],
      };
    case "toggle-on":
      return {
        name: "ui-toggle-on",
        voices: [v({ freq: 1318.51, gain: 0.06, attack: 0.002, release: 0.05 }), v({ freq: 1760, gain: 0.06, attack: 0.002, release: 0.07, delay: 0.045 })],
      };
    case "toggle-off":
      return {
        name: "ui-toggle-off",
        voices: [v({ freq: 1760, gain: 0.05, attack: 0.002, release: 0.05 }), v({ freq: 1318.51, gain: 0.05, attack: 0.002, release: 0.07, delay: 0.045 })],
      };
    case "open":
      /* A sheet lifts: a short upward glide over a soft floor. */
      return {
        name: "ui-open",
        voices: [v({ freq: 740, glideTo: 988, gain: 0.05, attack: 0.012, release: 0.16 }), v({ freq: 98, glideTo: 123, gain: 0.1, attack: 0.02, release: 0.14 })],
      };
    case "close":
      /* It settles back down. */
      return {
        name: "ui-close",
        voices: [v({ freq: 988, glideTo: 740, gain: 0.04, attack: 0.008, release: 0.13 }), v({ freq: 110, glideTo: 82, gain: 0.09, attack: 0.01, release: 0.12 })],
      };
    case "room":
      /* A new room arrives: its own chord, rolled on a soft piano. */
      return { name: "ui-room", voices: roomArrival(room) };
  }
}

/** How long a cue sounds, for tests and cleanup. */
export function cueDurationMs(cue: SoundCue): number {
  return Math.round(Math.max(...cue.voices.map((voice) => voice.delay + voice.attack + voice.hold + voice.release)) * 1000);
}
