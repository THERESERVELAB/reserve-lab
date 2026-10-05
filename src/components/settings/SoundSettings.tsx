"use client";

import { useState, useSyncExternalStore } from "react";

import {
  canPlayThroughSilent,
  logSoundPlayed,
  logSoundStatus,
  playLogSound,
  unlockLogSound,
  type LogSoundStatus,
} from "@/components/ui/reserve/log-moment/log-sound-engine";
import { ReserveButton } from "@/components/ui/reserve";
import { uiSoundCue } from "@/lib/ui/log-sound";
import { useLogSoundStore } from "@/lib/ui/log-sound-store";

import { SettingRow, SwitchControl } from "./SettingsControls";

/* ════════════════════════════════════════════════════════════════════════
   SOUND SETTINGS — on/off, a test, and the silent switch.

   The test plays one chord and reports what the browser did, in plain words,
   so a member who hears nothing knows whether it is the page, the browser or
   the phone. "Play when my phone is on silent" exists only where Safari's
   audio session does (iPhone, iOS 16.4+); it is on, because a house that
   cannot be heard reads as broken, and the member can hand the silent switch
   back the call whenever they want their own music left alone.
   ════════════════════════════════════════════════════════════════════════ */

const RESULT: Record<LogSoundStatus, string> = {
  running: "Sound is playing from this page. Hear nothing? Turn the media volume up with the side buttons while this page is open — the volume Reserve uses is the one set while it is playing.",
  suspended: "Your browser is still holding sound back. Tap Test sound once more.",
  interrupted: "Your phone paused sound (a call or the lock screen). Tap Test sound once more.",
  closed: "Sound stopped on this page. Reload it and tap Test sound.",
  unsupported: "This browser cannot play sound from web pages.",
};

const noopSubscribe = () => () => {};

export function SoundSettings() {
  const enabled = useLogSoundStore((s) => s.enabled);
  const setEnabled = useLogSoundStore((s) => s.setEnabled);
  const throughSilent = useLogSoundStore((s) => s.throughSilent);
  const setThroughSilent = useLogSoundStore((s) => s.setThroughSilent);
  const silentAvailable = useSyncExternalStore(noopSubscribe, canPlayThroughSilent, () => false);
  const [result, setResult] = useState<{ status: LogSoundStatus; played: number } | null>(null);

  const test = () => {
    /* This tap is the gesture: unlock inside it, then play. */
    unlockLogSound();
    const before = logSoundPlayed();
    playLogSound(uiSoundCue("room", "apex"));
    window.setTimeout(() => setResult({ status: logSoundStatus(), played: logSoundPlayed() - before }), 350);
  };

  return (
    <>
      <SettingRow label="Sound" description="Quiet tones as you move through Reserve, and when a log lands. Saved on this device.">
        <SwitchControl label="Sound" checked={enabled} onChange={setEnabled} />
      </SettingRow>
      <SettingRow
        label="Test sound"
        description={
          <span role="status" aria-live="polite" data-settings="sound-result">
            {result
              ? `${RESULT[result.status]}${result.played > 0 ? "" : " Nothing left this page on that tap."}`
              : "Plays one chord and tells you whether this page can make sound."}
          </span>
        }
      >
        {enabled ? (
          <ReserveButton tier="secondary" size="sm" onClick={test}>
            Test sound
          </ReserveButton>
        ) : (
          <ReserveButton tier="secondary" size="sm" disabled disabledReason="Turn Sound on first.">
            Test sound
          </ReserveButton>
        )}
      </SettingRow>
      {silentAvailable && (
        <SettingRow
          label="Play when my phone is on silent"
          description="iPhone, on by default. Turn it off to let the silent switch mute Reserve — music from other apps may pause while Reserve is open."
        >
          <SwitchControl label="Play when my phone is on silent" checked={throughSilent} disabled={!enabled} disabledReason="Turn Sound on first." onChange={setThroughSilent} />
        </SettingRow>
      )}
    </>
  );
}
