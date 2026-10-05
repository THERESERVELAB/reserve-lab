"use client";

import { ArrowRight, Check, Crown, Flame, Gauge, Moon, PenLine, RefreshCw, Shapes, Sparkles, X } from "lucide-react";
import { useMemo, useState } from "react";

import { GlassPanel } from "@/components/ui/GlassPanel";
import { ReserveButton, ReserveSelect, type ReserveSelectOption } from "@/components/ui/reserve";
import { useAthleteDashboardStore } from "@/lib/athlete-store";
import { useProtocolWeek } from "@/lib/hooks/useProtocolWeek";
import {
  buildSplitRecommendation,
  getSplitSystem,
  type SplitConfidence,
  type SplitSystem,
} from "@/lib/training/split-architect";
import { authoredRestDayIndex, splitPreviewWeek } from "@/lib/training/member-split";
import { getArchitectureForSystem, legFrequencyLabel, type SplitArchitecture } from "@/lib/training/split-architectures";
import { getTrainingWeekPlan } from "@/lib/training/weekly-split";

const C = {
  GOLD: "#d5b15f",
  IVORY: "#f2eee6",
  STEEL: "#5fb7d5",
  GREEN: "#6ee7b7",
  VIOLET: "#a78bfa",
  AMBER: "#e8c87a",
};


/** Leg frequency for a system, read from its authored week. Nothing used to
 *  state this, so the classic bodybuilding split (one leg day) and Crown Five
 *  (three) looked equivalent on the card. */
function LegFrequency({ systemKey, trainingDays, className }: { systemKey: string; trainingDays: number; className?: string }) {
  const arch = getArchitectureForSystem(systemKey, { trainingDaysPerWeek: trainingDays });
  if (!arch) return null;
  return (
    <span className={className ?? "font-mono text-[8px] uppercase tracking-[0.14em] text-white/40"}>
      {legFrequencyLabel(arch)}
    </span>
  );
}

const CONFIDENCE_COLOR: Record<SplitConfidence, string> = { high: C.GREEN, moderate: C.AMBER, calibrating: "#8ea0b8" };
const CONFIDENCE_LABEL: Record<SplitConfidence, string> = { high: "High Confidence", moderate: "Moderate Confidence", calibrating: "Calibrating" };

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const REST_DAY_OPTIONS: ReserveSelectOption<string>[] = WEEKDAYS.map((label, index) => ({ value: String(index), label }));

/** One line on what moving the rest day does to this split. */
function restDayNote(arch: SplitArchitecture): string {
  return arch.week.filter((d) => d.recovery).length > 1
    ? "The rotation turns to meet it, and your other rest days move with it."
    : "The rotation turns to meet it — the order of the days stays the same.";
}

/** The member's rest day. The split's cycle turns to meet it. */
function RestDayRow({ value, onChange, note }: { value: number; onChange: (index: number) => void; note: string }) {
  return (
    <div className="mt-3.5 flex flex-wrap items-end gap-x-4 gap-y-1.5">
      <ReserveSelect
        label="Rest day"
        value={String(value)}
        options={REST_DAY_OPTIONS}
        onChange={(next) => onChange(Number(next))}
        className="w-full max-w-[220px]"
      />
      <p className="pb-2.5 text-[11px] leading-[1.5] text-white/50">{note}</p>
    </div>
  );
}

/** Champagne-gradient display text for split identities. */
function identityGradient(extra?: React.CSSProperties): React.CSSProperties {
  return {
    background: `linear-gradient(120deg, #fff7e6 0%, ${C.IVORY} 40%, ${C.GOLD} 115%)`,
    WebkitBackgroundClip: "text",
    backgroundClip: "text",
    color: "transparent",
    ...extra,
  };
}

/** 7-day command timeline — the week the member trains with this split. */
function WeeklyStructurePreview({ week, caption }: { week: ReturnType<typeof getTrainingWeekPlan>; caption: string }) {
  return (
    <div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {week.map((d) => (
          <div
            key={d.day}
            /* A column separated by a hairline, not a tile inside the panel (components.md rule 1). */
            className="relative min-w-[118px] flex-1 overflow-hidden border-l border-white/[0.06] px-2.5 py-2.5 first:border-l-0"
          >
            {d.isToday && <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#d5b15f]/55 to-transparent" />}
            <div className="flex items-center justify-between">
              <p className="font-mono text-[7px] uppercase tracking-[0.16em]" style={{ color: d.isToday ? C.GOLD : "rgba(255,255,255,0.4)" }}>{d.day}</p>
              {d.recovery ? <Moon size={9} style={{ color: `${C.STEEL}aa` }} /> : d.advanced ? <Flame size={9} style={{ color: C.AMBER }} /> : null}
            </div>
            <p className="mt-1 truncate text-[10.5px] font-black" style={{ color: d.recovery ? `${C.STEEL}cc` : C.IVORY }}>{d.sessionName}</p>
            <p className="mt-0.5 line-clamp-1 text-[8px] leading-[1.4] text-white/38">{d.focus}</p>
            <p className="mt-1 font-mono text-[6.5px] uppercase tracking-[0.12em] text-white/30">
              {d.recovery ? "Restore" : d.durationMin != null ? `${d.durationMin} min${d.advanced ? " · Black" : ""}` : "Flexible"}
            </p>
          </div>
        ))}
      </div>
      <p className="mt-1.5 text-[10.5px] leading-[1.5] text-white/50">{caption}</p>
    </div>
  );
}

/** Clean fact row for the recommendation reason stack. */
function FactRow({ k, v, color }: { k: string; v: string; color: string }) {
  return (
    <div className="flex gap-3 border-t border-white/[0.05] pt-2">
      <span className="w-[96px] shrink-0 pt-px font-mono text-[7px] uppercase leading-[1.6] tracking-[0.14em]" style={{ color }}>{k}</span>
      <span className="text-[11px] leading-[1.5] text-white/60">{v}</span>
    </div>
  );
}

export function SplitArchitectPanel() {
  const profile = useAthleteDashboardStore((s) => s.profile);
  const updateProfile = useAthleteDashboardStore((s) => s.updateProfile);
  const scheduleProfile = useAthleteDashboardStore((s) => s.scheduleProfile);
  const physique = useAthleteDashboardStore((s) => s.physiqueCommand);
  const setupProfile = useAthleteDashboardStore((s) => s.setupProfile);
  const activeProtocol = useAthleteDashboardStore((s) => s.activeProtocol);
  const splitSystem = useAthleteDashboardStore((s) => s.splitSystem);
  /* The Architect used to get no gender signal at all, so a member whose whole
     goal was glutes was recommended an Arnold split. Both of these already sat
     in the store and neither ever reached it. */
  const genderIdentity = useAthleteDashboardStore((s) => s.profile.coachingProfile?.genderIdentity);
  const womensEnabled = useAthleteDashboardStore((s) => s.womens.enabled);
  const setSplitSystem = useAthleteDashboardStore((s) => s.setSplitSystem);
  const setSplitRestDay = useAthleteDashboardStore((s) => s.setSplitRestDay);

  const { week } = useProtocolWeek();
  const trainingDays = setupProfile.trainingDaysPerWeek ?? scheduleProfile.trainingDaysPerWeek;
  /* The rest day being chosen. It starts from the one the member already set,
     and is saved with whichever split they start. */
  const [restDraft, setRestDraft] = useState<number | null>(splitSystem.restDayIndex ?? null);

  const weakPointLabels = useMemo(
    () => (physique.weakPoints ?? []).map((w) => w.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())).slice(0, 4),
    [physique.weakPoints],
  );

  const recommendation = useMemo(
    () =>
      buildSplitRecommendation({
        goal: activeProtocol?.goal ?? profile.goal,
        physiqueArchetype: profile.physiqueArchetype,
        advanced: profile.experienceLevel === "advanced" || profile.persona === "advanced",
        recoveryStrong: profile.fatigueSensitivity !== "high",
        trainingDaysPerWeek: scheduleProfile.trainingDaysPerWeek,
        weakPointLabels,
        hasDeadline: setupProfile.targetTimelineWeeks != null,
        womensPath: genderIdentity === "female" || womensEnabled,
      }),
    [activeProtocol?.goal, profile.goal, profile.physiqueArchetype, profile.experienceLevel, profile.persona, profile.fatigueSensitivity, scheduleProfile.trainingDaysPerWeek, weakPointLabels, setupProfile.targetTimelineWeeks, genderIdentity, womensEnabled],
  );

  const chosen = getSplitSystem(splitSystem.key);
  const customName = profile.trainingStyle?.trim() || "";

  /* Previews show the split being offered or run — turned around the rest day —
     never the member's current program week. */
  const recommendedArch = getArchitectureForSystem(recommendation.recommended.key, { trainingDaysPerWeek: trainingDays });
  const chosenArch = chosen ? getArchitectureForSystem(chosen.key, { trainingDaysPerWeek: trainingDays }) : null;
  const recommendedRestDay = restDraft ?? (recommendedArch ? authoredRestDayIndex(recommendedArch) : null) ?? 6;
  const chosenRestDay = splitSystem.restDayIndex ?? (chosenArch ? authoredRestDayIndex(chosenArch) : null) ?? 6;
  const recommendedPreview = recommendedArch
    ? splitPreviewWeek({ architecture: recommendedArch, restDayIndex: restDraft, musclePriority: physique.weakPoints ?? [] })
    : week;
  const chosenPreview = chosenArch
    ? splitPreviewWeek({ architecture: chosenArch, restDayIndex: splitSystem.restDayIndex, musclePriority: physique.weakPoints ?? [] })
    : week;

  const [choosing, setChoosing] = useState(false);
  const [showDeeper, setShowDeeper] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState("");

  const isChoosing = choosing || !chosen;
  const confidenceColor = CONFIDENCE_COLOR[recommendation.confidence];

  function activate(system: SplitSystem, source: "reserve" | "member") {
    setSplitSystem(system.key, source, restDraft);
    setChoosing(false);
    setShowDeeper(false);
  }
  function saveName() {
    const clean = nameDraft.trim();
    if (!clean) return;
    updateProfile({ trainingStyle: clean });
    // A custom identity without a chosen system runs on the Reserve recommendation.
    if (!chosen) setSplitSystem(recommendation.recommended.key, "reserve", restDraft);
    setRenaming(false);
    setChoosing(false);
    setNameDraft("");
  }
  function clearName() {
    updateProfile({ trainingStyle: "" });
    setRenaming(false);
    setNameDraft("");
  }

  return (
    <GlassPanel accent={C.GOLD} noPad className="overflow-hidden">
      <div className="relative p-5 sm:p-6">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full blur-3xl" style={{ background: `${C.GOLD}10` }} />
        <div className="relative">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Shapes size={14} style={{ color: C.GOLD }} />
              <p className="font-mono text-[8.5px] uppercase tracking-[0.24em]" style={{ color: `${C.GOLD}cc` }}>Split Architect</p>
            </div>
            {chosen && !isChoosing && (
              <button type="button" onClick={() => setChoosing(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.1] px-2.5 py-1.5 font-mono text-[8px] uppercase tracking-[0.14em] text-white/50 transition hover:bg-white/[0.04] hover:text-white/80">
                <RefreshCw size={10} />Change Split
              </button>
            )}
          </div>

          {!isChoosing && chosen ? (
            /* ── ACTIVE SPLIT IDENTITY ─────────────────────────────────────── */
            <div className="mt-3">
              <p className="break-words uppercase text-[clamp(24px,3.2vw,34px)] font-black leading-[0.98] tracking-tight" style={identityGradient({ filter: `drop-shadow(0 4px 22px ${C.GOLD}22)` })}>
                {customName || chosen.name}
              </p>
              <p className="mt-1.5 text-[11px] font-semibold" style={{ color: `${C.GOLD}dd` }}>
                {splitSystem.source === "member" ? "Member Selected" : "Active Architecture"} · {chosen.name}
              </p>
              {chosen.key === recommendation.recommended.key ? (
                <p className="mt-2 max-w-2xl text-[11.5px] leading-[1.55] text-white/55">
                  <span className="font-mono text-[7.5px] uppercase tracking-[0.14em] text-white/35">Why Reserve chose it · </span>
                  {recommendation.reason}
                </p>
              ) : (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <p className="max-w-xl text-[11.5px] leading-[1.55] text-white/55">{chosen.tagline}</p>
                  <button type="button" onClick={() => activate(recommendation.recommended, "reserve")} className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 font-mono text-[7.5px] uppercase tracking-[0.14em] transition hover:bg-white/[0.04]" style={{ borderColor: `${C.GOLD}40`, color: C.GOLD }}>
                    Reserve Match · {recommendation.recommended.name}
                  </button>
                </div>
              )}
              <p className="mt-1.5 max-w-2xl text-[11px] leading-[1.5] text-white/45">
                <span className="font-mono text-[7.5px] uppercase tracking-[0.14em]" style={{ color: `${C.VIOLET}cc` }}>Weak-point emphasis · </span>
                {recommendation.weakPointEmphasis}
              </p>

              {chosenArch && (
                <RestDayRow value={chosenRestDay} onChange={(index) => setSplitRestDay(index)} note={restDayNote(chosenArch)} />
              )}
              <div className="mt-2.5">
                <WeeklyStructurePreview
                  week={chosenPreview}
                  caption={chosenArch ? `Your week with ${chosen.name} — rest on ${WEEKDAYS[chosenRestDay]}.` : "Projected from your current Reserve week."}
                />
              </div>

              {/* Identity naming lane */}
              <div className="mt-3.5">
                {renaming ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      value={nameDraft}
                      onChange={(e) => setNameDraft(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") saveName(); }}
                      placeholder="Name your split — e.g. My Glute Week"
                      maxLength={40}
                      autoFocus
                      className="w-full max-w-[260px] rounded-lg border border-white/[0.12] bg-white/[0.03] px-3 py-2 text-[12px] font-bold text-[#f2eee6] outline-none placeholder:text-white/25 focus:border-[#d5b15f]/50"
                    />
                    <button type="button" onClick={saveName} disabled={!nameDraft.trim()} title={!nameDraft.trim() ? "Type a name first" : "Save split name"} className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[10.5px] font-bold transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40" style={{ borderColor: `${C.GOLD}55`, background: `${C.GOLD}1a`, color: C.AMBER }}>
                      <Check size={11} />Save
                    </button>
                    {customName && (
                      <button type="button" onClick={clearName} title="Remove the custom name — the split system name leads instead" className="inline-flex items-center gap-1 rounded-lg border border-white/[0.1] px-2.5 py-2 text-[10px] font-semibold text-white/50 transition hover:bg-white/[0.04] hover:text-white/75">
                        <X size={10} />Clear Name
                      </button>
                    )}
                    <button type="button" onClick={() => { setRenaming(false); setNameDraft(""); }} className="font-mono text-[8px] uppercase tracking-[0.14em] text-white/35 transition hover:text-white/65">Cancel</button>
                  </div>
                ) : (
                  <button type="button" onClick={() => { setRenaming(true); setNameDraft(customName); }} className="inline-flex items-center gap-1.5 font-mono text-[8px] uppercase tracking-[0.16em] text-white/40 transition hover:text-white/70">
                    <PenLine size={10} />{customName ? "Rename Split" : "Name Your Split"}
                  </button>
                )}
              </div>
            </div>
          ) : (
            /* ── CHOOSE: ONE RECOMMENDATION · TWO ALTERNATIVES · CUSTOM LANE ── */
            <div className="mt-3 flex flex-col gap-3">
              {/* Recommended — the dominant hero card */}
              <div className="relative border-t border-white/[0.06] pt-4">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#d5b15f]/50 to-transparent" />
                <div className="pointer-events-none absolute -right-14 -top-14 h-44 w-44 rounded-full blur-3xl" style={{ background: `${C.GOLD}16` }} />
                <div className="relative">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[8px] uppercase tracking-[0.2em]" style={{ borderColor: `${C.GOLD}45`, background: `${C.GOLD}12`, color: C.GOLD }}>
                      <Crown size={10} />Reserve Match
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full border px-2 py-1 font-mono text-[7.5px] uppercase tracking-[0.16em]" style={{ borderColor: `${confidenceColor}45`, color: confidenceColor }} title={recommendation.confidenceNote}>
                      <Gauge size={9} />{CONFIDENCE_LABEL[recommendation.confidence]}
                    </span>
                  </div>
                  <p className="mt-2.5 break-words uppercase text-[clamp(24px,3.2vw,36px)] font-black leading-[0.98] tracking-tight" style={identityGradient({ filter: `drop-shadow(0 5px 26px ${C.GOLD}26)` })}>
                    {recommendation.recommended.name}
                  </p>
                  <p className="mt-1.5 max-w-2xl text-[12px] leading-[1.55] text-white/60">{recommendation.recommended.tagline}</p>
                  <p className="mt-1.5">
                    <LegFrequency systemKey={recommendation.recommended.key} trainingDays={trainingDays} className="font-mono text-[8.5px] uppercase tracking-[0.16em] text-white/45" />
                  </p>
                  <p className="mt-2.5 max-w-2xl text-[11.5px] leading-[1.55] text-white/55">
                    <span className="font-mono text-[7.5px] uppercase tracking-[0.14em] text-white/35">Why Reserve chose it · </span>
                    {recommendation.reason}
                  </p>
                  {recommendation.rejected.length > 0 && (
                    <p className="mt-1.5 max-w-2xl text-[11px] leading-[1.5] text-white/40">
                      <span className="font-mono text-[7.5px] uppercase tracking-[0.14em] text-white/30">Set aside · </span>
                      {recommendation.rejected.map((r) => `${r.name} — ${r.reason}`).join(" · ")}
                    </p>
                  )}
                  {/* Reason stack */}
                  <div className="mt-3 grid grid-cols-1 gap-x-5 gap-y-2 lg:grid-cols-2">
                    <FactRow k="Weak-Point Emphasis" v={recommendation.weakPointEmphasis} color={C.VIOLET} />
                    <FactRow k="Recovery Demand" v={recommendation.recoveryDemand} color={C.STEEL} />
                    <FactRow k="Schedule Fit" v={recommendation.scheduleFit} color={C.GREEN} />
                    <FactRow k="Designed For" v={recommendation.recommended.designedFor} color={C.GOLD} />
                  </div>
                  {recommendedArch && (
                    <RestDayRow value={recommendedRestDay} onChange={setRestDraft} note={restDayNote(recommendedArch)} />
                  )}
                  <div className="mt-2.5">
                    <WeeklyStructurePreview
                      week={recommendedPreview}
                      caption={recommendedArch ? `Your week with this split — rest on ${WEEKDAYS[recommendedRestDay]}.` : "Projected from your current Reserve week."}
                    />
                  </div>
                  {/* Secondary: Training's one gold action lives in the room hero (Bible §11). */}
                  <div className="mt-4">
                    <ReserveButton tier="secondary" iconAfter={ArrowRight} onClick={() => activate(recommendation.recommended, "reserve")}>
                      Start This Architecture
                    </ReserveButton>
                  </div>
                </div>
              </div>

              {/* Reserve alternatives — quieter comparison cards, never equal to the hero */}
              <div>
                <p className="mb-2 font-mono text-[7.5px] uppercase tracking-[0.2em] text-white/35">Reserve Alternatives</p>
                <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
                  {recommendation.alternatives.map((alt) => (
                    <div key={alt.key} className="flex flex-col border-l border-white/[0.08] pl-3">
                      <p className="text-[13px] font-black uppercase tracking-tight text-[#f2eee6]">{alt.name}</p>
                      <p className="mt-1 flex-1 text-[10.5px] leading-[1.5] text-white/50">{alt.tagline}</p>
                      <LegFrequency systemKey={alt.key} trainingDays={trainingDays} className="mt-1 font-mono text-[8px] uppercase tracking-[0.14em] text-white/40" />
                      <button type="button" onClick={() => activate(alt, "member")} className="mt-2.5 inline-flex w-fit items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-semibold transition hover:bg-white/[0.04]" style={{ borderColor: "rgba(255,255,255,0.14)", color: "rgba(255,255,255,0.65)" }}>
                        Select Instead<ArrowRight size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Custom lane — naming a private program, not filling a setting */}
              <div className="relative border-t border-white/[0.06] pt-4">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#a78bfa]/40 to-transparent" />
                <div className="flex items-center gap-2">
                  <Sparkles size={11} style={{ color: C.VIOLET }} />
                  <p className="font-mono text-[8px] uppercase tracking-[0.2em]" style={{ color: `${C.VIOLET}dd` }}>Custom Split</p>
                </div>
                {/* Live identity preview */}
                <p className="mt-2 min-h-[30px] break-words uppercase text-[clamp(20px,2.6vw,28px)] font-black leading-[0.98] tracking-tight" style={nameDraft.trim() ? identityGradient({ filter: `drop-shadow(0 4px 20px ${C.VIOLET}26)` }) : { color: "rgba(255,255,255,0.18)" }}>
                  {nameDraft.trim() || "Your Split Name"}
                </p>
                <p className="mt-1.5 text-[10.5px] leading-[1.5] text-white/50">This identity leads the Apex hero and Training Command. It runs on the Reserve structure until you change the system.</p>
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") saveName(); }}
                    placeholder="e.g. My Glute Week"
                    maxLength={40}
                    className="w-full max-w-[240px] rounded-lg border border-white/[0.12] bg-white/[0.03] px-3 py-2 text-[12px] font-bold text-[#f2eee6] outline-none placeholder:text-white/25 focus:border-[#a78bfa]/50"
                  />
                  <button type="button" onClick={saveName} disabled={!nameDraft.trim()} title={!nameDraft.trim() ? "Type a name first" : "Create your custom split"} className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[10.5px] font-bold transition hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-40" style={{ borderColor: `${C.VIOLET}50`, color: C.VIOLET }}>
                    <Check size={11} />Create Custom Split
                  </button>
                </div>
              </div>

              {/* Deeper systems — quiet disclosure, never a big menu */}
              <div>
                {showDeeper ? (
                  <div className="space-y-1.5">
                    <div className="divide-y divide-white/[0.05]">
                    {recommendation.deeper.map((sys) => (
                      <div key={sys.key} className="flex items-center justify-between gap-3 py-2">
                        <div className="min-w-0">
                          <p className="text-[11.5px] font-bold text-[#f2eee6]">{sys.name}</p>
                          <p className="truncate text-[9.5px] text-white/40">{sys.tagline}</p>
                          <LegFrequency systemKey={sys.key} trainingDays={trainingDays} />
                        </div>
                        <button type="button" onClick={() => activate(sys, "member")} className="shrink-0 rounded-lg border border-white/[0.12] px-2.5 py-1 text-[9.5px] font-semibold text-white/55 transition hover:bg-white/[0.04]">Select</button>
                      </div>
                    ))}
                    </div>
                    <button type="button" onClick={() => setShowDeeper(false)} className="font-mono text-[7.5px] uppercase tracking-[0.14em] text-white/30 transition hover:text-white/60">Hide</button>
                  </div>
                ) : (
                  recommendation.deeper.length > 0 && (
                    <button type="button" onClick={() => setShowDeeper(true)} className="font-mono text-[7.5px] uppercase tracking-[0.14em] text-white/30 transition hover:text-white/60">
                      View all split systems ({recommendation.deeper.length} more)
                    </button>
                  )
                )}
              </div>

              {chosen && (
                <button type="button" onClick={() => setChoosing(false)} className="w-fit font-mono text-[8px] uppercase tracking-[0.14em] text-white/35 transition hover:text-white/65">← Back to your split</button>
              )}
            </div>
          )}
        </div>
      </div>
    </GlassPanel>
  );
}
