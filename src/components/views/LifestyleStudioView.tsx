"use client";

/* ════════════════════════════════════════════════════════════════════════
   BUILD STUDIO — build your player, build your lifestyle.

   A Plan screen (program redesign spec): the hero states what the member has
   actually built, gives three real readouts, and carries exactly one gold
   action that moves them into the editor that is already on the page.

   The member-controlled construction surface: the weekly lifestyle schedule
   builder (any activity, any rotation, versioned), Reserve's schedule
   intelligence (exposure, audit, week variants, planned-vs-actual), and the
   custom workout builder with ranked movement recommendations that launch as
   real immutable Reserve sessions.

   MEMBER DEFINES THE LIFESTYLE → RESERVE ANALYZES, RANKS, EXPLAINS →
   MEMBER DECIDES → RESERVE REMEMBERS. Nothing here is ever silently
   overwritten by an engine, and the hero's action never creates or activates
   anything by itself — it puts the member in front of the control that does.
   ════════════════════════════════════════════════════════════════════════ */

import { ArrowRight, Hammer } from "lucide-react";
import { useState } from "react";

import { GlassPanel } from "@/components/ui/GlassPanel";
import { ReserveButton } from "@/components/ui/reserve";
import { useAthleteDashboardStore } from "@/lib/athlete-store";
import { RESERVE, alpha } from "@/lib/design/tokens";
import {
  resolveLifestylePrimaryAction,
  type LifestylePrimaryAction,
} from "@/lib/lifestyle/primary-action";

import { ViewShell } from "./ViewShell";
import { focusBuildStudio } from "./lifestyle/builder-anchors";
import { ProgramCommandPanel } from "./lifestyle/ProgramCommandPanel";
import { ScheduleBuilderPanel } from "./lifestyle/ScheduleBuilderPanel";
import { ScheduleIntelligencePanel } from "./lifestyle/ScheduleIntelligencePanel";
import { WorkoutBuilderPanel } from "./lifestyle/WorkoutBuilderPanel";

/** A readout with no surface of its own — a row in the hero, never a tile. */
function Read({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="font-mono text-[9px] uppercase tracking-[0.22em] text-white/50">{label}</dt>
      <dd className="mt-1.5 text-[13px] font-semibold leading-snug text-[#f2eee6]">{value}</dd>
    </div>
  );
}

export function LifestyleStudioView() {
  const schedules = useAthleteDashboardStore((s) => s.lifestyleSchedules);
  const activeId = useAthleteDashboardStore((s) => s.activeLifestyleScheduleId);
  const templates = useAthleteDashboardStore((s) => s.customWorkoutTemplates);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  /* Derive the selection during render (no effect): the member's explicit
     pick wins; otherwise the active schedule, else the most recent one. */
  const effectiveSelectedId =
    selectedId && schedules.some((s) => s.id === selectedId)
      ? selectedId
      : (schedules.find((s) => s.id === activeId) ?? schedules[schedules.length - 1])?.id ?? null;

  const analyzed = schedules.find((s) => s.id === effectiveSelectedId) ?? null;

  const live = schedules.filter((s) => s.status !== "archived");
  const activeSchedule = schedules.find((s) => s.id === activeId) ?? null;
  const liveTemplates = templates.filter((t) => t.status !== "archived");

  const plan = resolveLifestylePrimaryAction({
    scheduleCount: live.length,
    activeScheduleName: activeSchedule?.name ?? null,
    activityCount: activeSchedule?.activities.length ?? 0,
    sessionCount: liveTemplates.length,
  });

  function run(action: LifestylePrimaryAction) {
    switch (action.kind) {
      case "build-week":
      case "activate-week":
        focusBuildStudio("week");
        break;
      case "build-session":
        focusBuildStudio("sessions");
        break;
      case "review-week":
        focusBuildStudio(analyzed ? "intelligence" : "week");
        break;
    }
  }

  return (
    <ViewShell
      label="Build Your Player"
      title="Build Studio"
      icon={Hammer}
      accentColor={RESERVE.gold}
      roomHero
      command="Build the week you actually live, and the sessions that run inside it."
      disclaimer="Organizational support built from your own configuration and logs. Estimates are labeled. No medical advice or dosing guidance."
    >
      {/* ── HERO ─────────────────────────────────────────────────────── */}
      <GlassPanel accent={RESERVE.gold} noPad phone="flush" className="md:overflow-hidden">
        <section aria-label="What you have built" data-lifestyle="hero" className="relative pb-5 pt-4 md:p-6 lg:px-8 lg:py-6">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -inset-x-3 inset-y-0 max-md:[mask-image:linear-gradient(180deg,#000_55%,transparent)] md:inset-x-0"
            style={{
              background: `radial-gradient(110% 90% at 0% 15%, ${alpha(RESERVE.gold, 0.085)}, transparent 55%), radial-gradient(80% 70% at 100% 100%, ${alpha(RESERVE.steel, 0.045)}, transparent 60%)`,
            }}
          />

          <div className="relative grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)] lg:items-end lg:gap-12">
            <div className="min-w-0">
              <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-white/50">
                Build status · {live.length > 0 ? "Member built" : "Nothing built yet"}
              </p>
              <h2
                data-room-statement
                className="mt-2.5 font-display text-[28px] font-black uppercase leading-[0.95] tracking-[-0.02em] text-[#f2eee6] [hyphens:none] sm:text-[34px] lg:text-[42px]"
              >
                {plan.statement}
              </h2>
            </div>

            <div className="min-w-0">
              <dl className="grid grid-cols-3 gap-4">
                <Read label="Weeks" value={String(live.length)} />
                <Read label="Active" value={activeSchedule?.name ?? "None"} />
                <Read label="Sessions" value={String(liveTemplates.length)} />
              </dl>

              <p data-lifestyle="action-title" className="mt-4 text-[14px] font-semibold leading-snug text-[#f2eee6] [text-wrap:balance]">
                {plan.title}
              </p>
              <p className="mt-1 max-w-[56ch] text-[12.5px] leading-[1.5] text-white/60">{plan.reason}</p>
              {/* The screen's one gold action (Bible §11). It moves focus into a
                  real editor; it never creates or activates anything itself. */}
              <div data-lifestyle="primary-action" className="mt-3 min-w-0 max-sm:w-full sm:inline-block">
                <ReserveButton tier="primary" size="md" fullWidth iconAfter={ArrowRight} onClick={() => run(plan.primary)}>
                  {plan.primary.label}
                </ReserveButton>
              </div>
            </div>
          </div>
        </section>
      </GlassPanel>

      {/* Everything below the hero is a row until the member asks for it. The
          gold action opens the right editor in place and focuses it. */}
      <ProgramCommandPanel
        liveScheduleCount={live.length}
        weekCanvas={<ScheduleBuilderPanel selectedId={effectiveSelectedId} onSelect={setSelectedId} />}
        sessionsCanvas={<WorkoutBuilderPanel />}
        intelligence={analyzed ? <ScheduleIntelligencePanel schedule={analyzed} /> : undefined}
      />
    </ViewShell>
  );
}
