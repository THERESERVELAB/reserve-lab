"use client";

import { LOG_SOUND_MASTER_GAIN, type SoundCue } from "@/lib/ui/log-sound";

/* ════════════════════════════════════════════════════════════════════════
   LOG SOUND ENGINE — turns a cue into oscillators.

   One AudioContext for the shell, created lazily and only ever from a
   member's own gesture: browsers refuse audio that starts on its own, and so
   does Reserve. `installLogSoundUnlock` listens for the member's gestures
   (press, release, click, key) and unlocks on each, so by the time a log
   lands the context is running — on a phone too, where only the release
   counts. A cue asked for while the context is still resuming waits briefly
   for it instead of being dropped. Every voice is one oscillator through its own gain envelope,
   into a compressor, into the master, so several cues at once never clip. A
   failure anywhere is silent: sound is a courtesy.

   For tests: every cue played is recorded on the root element as
   data-log-sound="<name>", with a running count in data-log-sound-count.
   ════════════════════════════════════════════════════════════════════════ */

type Engine = { ctx: AudioContext; input: AudioNode };

let engine: Engine | null = null;
let played = 0;

function create(): Engine | null {
  if (typeof window === "undefined") return null;
  const Ctx = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  try {
    const ctx = new Ctx({ latencyHint: "interactive" });
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.knee.value = 12;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.12;
    const master = ctx.createGain();
    master.gain.value = LOG_SOUND_MASTER_GAIN;
    compressor.connect(master);
    master.connect(ctx.destination);
    return { ctx, input: compressor };
  } catch {
    return null;
  }
}

/** Create and resume the context from a member's gesture. Safe to call often. */
export function unlockLogSound(): void {
  try {
    /* Claim the audio session first: on an iPhone the session decides whether
       anything is heard at all, and it has to be set before the sound. */
    applyAudioSession();
    engine ??= create();
    if (!engine) return;
    const { ctx } = engine;
    /* iOS also parks a context as "interrupted" (a call, the lock screen). */
    if (ctx.state !== "running") void ctx.resume();
    /* iOS Safari opens the output only once something has actually played
       inside the gesture: one silent sample does it. */
    const buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);
  } catch {
    /* No audio on this device. */
  }
}

/* A phone grants audio on the finger's RELEASE (touchend, click), not on its
   press — pointerdown only counts for a mouse. Listening on press alone left
   every phone silent. Listen on all of them, in the capture phase, and stay
   listening: iOS can suspend the context again after a call or a lock. */
const UNLOCK_EVENTS = ["pointerdown", "touchend", "click", "keydown"] as const;
let listening = false;

export function installLogSoundUnlock(): void {
  if (listening || typeof window === "undefined") return;
  listening = true;
  for (const type of UNLOCK_EVENTS) window.addEventListener(type, unlockLogSound, { capture: true, passive: true });
}

/** What the browser is doing with sound right now, for the Settings test. */
export type LogSoundStatus = "running" | "suspended" | "interrupted" | "closed" | "unsupported";

export function logSoundStatus(): LogSoundStatus {
  if (typeof window === "undefined") return "unsupported";
  const Ctx = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return "unsupported";
  return (engine?.ctx.state as LogSoundStatus | undefined) ?? "suspended";
}

/* Safari's audio session (iOS 16.4+). "playback" is heard through the ring
   /silent switch and rides the media volume; "auto" hands the phone the call,
   and on a phone switched to silent that means nothing is heard. Reserve asks
   for "playback" unless the member turns it off, because a member who cannot
   hear the house has no way to tell a quiet app from a broken one. */
let wantPlayback = true;

function applyAudioSession(): void {
  try {
    const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
    if (session) session.type = wantPlayback ? "playback" : "auto";
  } catch {
    /* Not supported here. */
  }
}

/** The member's choice: play through the silent switch, or leave it to the phone. */
export function setLogSoundThroughSilent(on: boolean): void {
  wantPlayback = on;
  applyAudioSession();
}

/** Whether this browser can play through the silent switch at all. */
export function canPlayThroughSilent(): boolean {
  return typeof navigator !== "undefined" && "audioSession" in navigator;
}

/** How many cues have sounded on this page — the Settings test reads it back. */
export function logSoundPlayed(): number {
  return played;
}

/** A cue asked for before the context finished resuming waits this long for it. */
const RESUME_GRACE_MS = 400;

function mark(name: string) {
  played += 1;
  const root = document.documentElement;
  root.dataset.logSound = name;
  root.dataset.logSoundCount = String(played);
}

/** Play a cue now. Returns false when nothing could sound yet. */
export function playLogSound(cue: SoundCue): boolean {
  try {
    engine ??= create();
    if (!engine) return false;
    const { ctx } = engine;
    if (ctx.state !== "running") {
      /* The tap that asked for this sound is usually the one resuming the
         context: wait for it briefly rather than drop the first sound. */
      const asked = performance.now();
      void ctx
        .resume()
        .then(() => {
          if (ctx.state === "running" && performance.now() - asked <= RESUME_GRACE_MS) schedule(cue);
        })
        .catch(() => undefined);
      return false;
    }
    schedule(cue);
    return true;
  } catch {
    return false;
  }
}

function schedule(cue: SoundCue): void {
  if (!engine) return;
  const { ctx, input } = engine;
  try {
    const t0 = ctx.currentTime + 0.005;
    for (const voice of cue.voices) {
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = voice.wave;
      const start = t0 + voice.delay;
      const releaseAt = start + voice.attack + voice.hold;
      const end = releaseAt + voice.release;
      osc.frequency.setValueAtTime(voice.freq, start);
      if (voice.glideTo) osc.frequency.exponentialRampToValueAtTime(voice.glideTo, start + (end - start) * 0.6);
      env.gain.setValueAtTime(0.0001, start);
      env.gain.linearRampToValueAtTime(voice.gain, start + voice.attack);
      env.gain.setValueAtTime(voice.gain, releaseAt);
      env.gain.exponentialRampToValueAtTime(0.0001, end);
      osc.connect(env);
      env.connect(input);
      osc.start(start);
      osc.stop(end + 0.02);
      osc.onended = () => {
        try {
          osc.disconnect();
          env.disconnect();
        } catch {
          /* already gone */
        }
      };
    }
    mark(cue.name);
  } catch {
    /* Sound is a courtesy. */
  }
}
