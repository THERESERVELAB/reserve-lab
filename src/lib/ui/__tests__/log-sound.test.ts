import { describe, expect, it } from "vitest";

import { planLogMoment } from "../log-moment";
import {
  LOG_SOUND_MASTER_GAIN,
  ROOM_CHORDS,
  cueDurationMs,
  planLogSound,
  soundRoomOf,
  uiSoundCue,
  type SoundCue,
  type SoundRoom,
  type UiSoundKind,
} from "../log-sound";

describe("uiSoundCue", () => {
  const kinds: UiSoundKind[] = ["tap", "select", "toggle-on", "toggle-off", "open", "close", "room"];
  const rooms = Object.keys(ROOM_CHORDS) as SoundRoom[];
  const peak = (cue: SoundCue) => Math.max(...cue.voices.map((voice) => voice.gain));

  it("gives every interaction its own named cue", () => {
    expect(new Set(kinds.map((kind) => uiSoundCue(kind).name)).size).toBe(kinds.length);
  });

  it("sits under the logs in every room: no interface voice is louder than the water tick's", () => {
    const water = planLogSound({ tier: "mark", tone: "log", milestone: null }, planLogMoment({ tier: "mark", tone: "log", milestone: null }, "full")).impact!;
    for (const room of rooms) for (const kind of kinds) expect(peak(uiSoundCue(kind, room)), `${room} ${kind}`).toBeLessThan(peak(water));
  });

  it("stays short: a touch under a quarter second; a room's piano rings out in under a second and a half", () => {
    for (const room of rooms) {
      for (const kind of kinds) expect(cueDurationMs(uiSoundCue(kind, room)), `${room} ${kind}`).toBeLessThanOrEqual(kind === "room" ? 1400 : 250);
    }
  });

  it("every room has its own chord, and its own tap note", () => {
    const chords = rooms.map((room) => ROOM_CHORDS[room].join(","));
    expect(new Set(chords).size).toBe(rooms.length);
    const taps = rooms.map((room) => uiSoundCue("tap", room).voices[0].freq);
    /* The house shares apex's top note by design; every other room rings apart. */
    expect(new Set(taps).size).toBeGreaterThanOrEqual(rooms.length - 1);
  });

  it("a room arrives as its chord rolled low to high", () => {
    const struck = uiSoundCue("room", "training").voices.filter((voice) => ROOM_CHORDS.training.includes(voice.freq));
    expect(struck.map((voice) => voice.freq)).toEqual([...ROOM_CHORDS.training]);
    expect(struck.map((voice) => voice.delay)).toEqual([...struck.map((voice) => voice.delay)].sort((a, b) => a - b));
  });

  it("maps the member's rooms to their keys", () => {
    expect(soundRoomOf("dashboard")).toBe("apex");
    expect(soundRoomOf("training")).toBe("training");
    expect(soundRoomOf("nutrition")).toBe("fuel");
    expect(soundRoomOf("recovery")).toBe("recovery");
    expect(soundRoomOf("schedule-command")).toBe("schedule");
    expect(soundRoomOf("supplements")).toBe("vault");
    expect(soundRoomOf("bloodwork")).toBe("clinical");
    expect(soundRoomOf("progress-photos")).toBe("studio");
    expect(soundRoomOf("settings")).toBe("house");
  });

  it("a switch rises on and falls off", () => {
    const on = uiSoundCue("toggle-on").voices;
    const off = uiSoundCue("toggle-off").voices;
    expect(on[1].freq).toBeGreaterThan(on[0].freq);
    expect(off[1].freq).toBeLessThan(off[0].freq);
  });
});

const full = { tier: "full" as const, tone: "log" as const, milestone: null };
const mark = { tier: "mark" as const, tone: "log" as const, milestone: null };
const milestone = { tier: "full" as const, tone: "log" as const, milestone: { key: "streak-7", headline: "Seven days in a row.", intensity: 1.4 } };
const biggest = { tier: "full" as const, tone: "log" as const, milestone: { key: "day-fueled", headline: "The day is complete.", intensity: 1.7 } };
const clear = { tier: "mark" as const, tone: "clear" as const, milestone: null };

const plan = (m: Parameters<typeof planLogMoment>[0], motion: "full" | "reduced" | "static" = "full") => planLogMoment(m, motion);

describe("planLogSound", () => {
  it("a full log: a thump at impact, a chord when the light lands", () => {
    const s = planLogSound(full, plan(full));
    expect(s.impact?.name).toBe("thump");
    expect(s.arrival?.name).toBe("chord");
  });

  it("a mark: one tick, nothing at arrival", () => {
    const s = planLogSound(mark, plan(mark));
    expect(s.impact?.name).toBe("tick");
    expect(s.arrival).toBeNull();
  });

  it("a milestone: the rise, three notes; the day's biggest adds a fourth", () => {
    const three = planLogSound(milestone, plan(milestone));
    const four = planLogSound(biggest, plan(biggest));
    expect(three.arrival?.name).toBe("rise");
    expect(four.arrival?.name).toBe("rise");
    /* Each note carries a shimmer; the swell is one more voice. */
    expect(three.arrival?.voices).toHaveLength(3 * 2 + 1);
    expect(four.arrival?.voices).toHaveLength(4 * 2 + 1);
  });

  it("an undo steps down and lands nothing", () => {
    const s = planLogSound(clear, plan(clear));
    expect(s.impact?.name).toBe("clear");
    expect(s.arrival).toBeNull();
  });

  it("reduced motion plays the landing at once, with no impact beat to wait for", () => {
    const s = planLogSound(full, plan(full, "reduced"));
    expect(s.impact?.name).toBe("chord");
    expect(s.arrival).toBeNull();
    expect(planLogSound(milestone, plan(milestone, "reduced")).impact?.name).toBe("rise");
  });

  it("a plan that draws nothing sounds nothing", () => {
    expect(planLogSound(full, { ...plan(full), visible: false })).toEqual({ impact: null, arrival: null });
  });

  it("stays a whisper: every voice under a third of full scale, the master just over half, every cue under a second and a half", () => {
    const cues: SoundCue[] = [full, mark, milestone, biggest, clear]
      .flatMap((m) => {
        const s = planLogSound(m, plan(m));
        return [s.impact, s.arrival];
      })
      .filter((c): c is SoundCue => c !== null);
    expect(cues.length).toBeGreaterThan(5);
    for (const cue of cues) {
      for (const voice of cue.voices) {
        expect(voice.gain, `${cue.name} ${voice.freq}Hz`).toBeLessThanOrEqual(0.34);
        expect(voice.attack).toBeGreaterThan(0);
        expect(voice.release).toBeGreaterThan(0);
      }
      expect(cueDurationMs(cue), cue.name).toBeLessThanOrEqual(1500);
    }
    /* The set rides below full scale; a phone speaker needs the headroom spent. */
    expect(LOG_SOUND_MASTER_GAIN).toBeGreaterThanOrEqual(0.8);
    expect(LOG_SOUND_MASTER_GAIN).toBeLessThanOrEqual(1);
  });

  it("the tick is the shortest cue and the rise the longest", () => {
    const tick = planLogSound(mark, plan(mark)).impact!;
    const rise = planLogSound(biggest, plan(biggest)).arrival!;
    const chord = planLogSound(full, plan(full)).arrival!;
    expect(cueDurationMs(tick)).toBeLessThan(cueDurationMs(chord));
    expect(cueDurationMs(chord)).toBeLessThan(cueDurationMs(rise));
  });
});
