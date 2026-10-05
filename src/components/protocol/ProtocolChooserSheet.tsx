"use client";

/* ════════════════════════════════════════════════════════════════════════
   PERSONAL COMMAND · THE PROTOCOL CHOOSER

   What used to be the bottom 6,000px of Personal Command — 17 goal chips,
   9 activity chips, the women's architecture cards, three muscle-focus chip
   clouds, the recommended cards and the full library — as one stepped sheet:

     Goal → Activities → Focus → Protocol → confirm

   Nothing is written until the member runs a protocol or saves their
   priorities. A changed chooser is a form: an outside click does nothing,
   and Escape, the X or a drag asks before discarding (FormCloseGuard).
   ════════════════════════════════════════════════════════════════════════ */

import { Check } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { ReserveBottomSheet, ReserveButton, ReserveSelect, useDirtySnapshot } from "@/components/ui/reserve";
import { useAthleteDashboardStore } from "@/lib/athlete-store";
import { protocolLegFrequency } from "@/lib/training/split-blueprints";
import { musclePriorityLabel, MUSCLE_PRIORITIES, type MusclePriority, type WomensTrack } from "@/lib/physique/types";
import { familyArchitectureName, familyForCategory, resolveFocusArchitecture, WOMENS_TRACKS } from "@/lib/protocol/architecture";
import {
  CATEGORY_LABEL,
  EVENT_TYPE_LABEL,
  PROTOCOL_LIBRARY,
  getProtocol,
  planDeadline,
  recommendProtocols,
  type EventType,
  type ProtocolCategory,
} from "@/lib/protocol/library";
import {
  adjacentChooserStep,
  CHOOSER_STEPS,
  showsWomensArchitecture,
  type ChooserStep,
} from "@/lib/protocol/personal-command";
import { ACTIVITY_STACKS, SPORT_OPTIONS, type ActivityStack, type SportType } from "@/lib/training/activity-stack";
import {
  ALL_FACILITY_AMENITIES,
  AMENITY_GROUP_LABEL,
  FACILITY_AMENITY_LABEL,
  amenitiesByGroup,
  amenitiesForEnvironment,
  type AmenityGroup,
  type FacilityAmenity,
} from "@/lib/training/facilities";
import { findActivePriorityOption, getPriorityOptionSet, priorityOptionMatches, type PriorityOption } from "@/lib/training/priority-options";

const WOMENS_TRACK_ORDER: WomensTrack[] = ["runway", "glute-quad", "lean-recomp", "glute-upper", "athletic-model", "lifestyle-shape", "signature-shape", "hybrid-pilates", "sport-strength"];
const EVENT_TYPES: EventType[] = ["none", "vacation", "beach-trip", "wedding", "photoshoot", "birthday", "competition", "milestone"];

type CategoryFilter = { id: string; label: string; match: (c: ProtocolCategory) => boolean };
const CATEGORY_FILTERS: CategoryFilter[] = [
  { id: "all", label: "All protocols", match: () => true },
  { id: "transformation", label: "Transformation", match: (c) => c === "transformation" },
  { id: "shred", label: "Shred", match: (c) => c === "shred-cut" || c === "vacation-prep" },
  { id: "recomp", label: "Recomp", match: (c) => c === "recomp" },
  { id: "build", label: "Build", match: (c) => c === "lean-bulk" || c === "classic-physique" },
  { id: "advanced", label: "Advanced", match: (c) => c === "premium-advanced" || c === "athletic-performance" },
  { id: "reserve-athlete", label: "Reserve Athlete", match: (c) => c === "reserve-athlete" },
  { id: "women", label: "Women", match: (c) => c === "womens-performance" },
  { id: "home", label: "Home", match: (c) => c === "at-home" },
  { id: "lifestyle", label: "Lifestyle", match: (c) => c === "lifestyle-reset" || c === "fertility-lifestyle" || c === "pregnancy-lifestyle" },
  { id: "log-only", label: "Log-only", match: (c) => c === "enhanced-log-only" },
];

type Draft = {
  primary: MusclePriority | null;
  secondary: MusclePriority[];
  support: MusclePriority[];
  track: WomensTrack | null;
  stack: ActivityStack;
  sport: SportType | null;
  protocolId: string | null;
  duration: number | null;
  eventName: string;
  eventType: EventType;
  eventDate: string;
  amenities: FacilityAmenity[];
};

export function ProtocolChooserSheet({
  open,
  onClose,
  startStep,
  startProtocolId,
}: {
  open: boolean;
  onClose: () => void;
  startStep: ChooserStep;
  startProtocolId: string | null;
}) {
  /* One session per opening: the draft starts from the member's saved state each time. */
  return open ? <ChooserBody onDone={onClose} startStep={startStep} startProtocolId={startProtocolId} /> : null;
}

function ChooserBody({
  onDone,
  startStep,
  startProtocolId,
}: {
  onDone: () => void;
  startStep: ChooserStep;
  startProtocolId: string | null;
}) {
  const focus = useAthleteDashboardStore((s) => s.physiqueCommand.focus);
  const weakPoints = useAthleteDashboardStore((s) => s.physiqueCommand.weakPoints);
  const womensEnabled = useAthleteDashboardStore((s) => s.womens.enabled);
  const genderIdentity = useAthleteDashboardStore((s) => s.profile.coachingProfile?.genderIdentity);
  const sex = useAthleteDashboardStore((s) => s.setupProfile.sex);
  const profileGoal = useAthleteDashboardStore((s) => s.profile.goal);
  const profilePath = useAthleteDashboardStore((s) => s.modulePreferences.profilePath);
  const activeProtocol = useAthleteDashboardStore((s) => s.activeProtocol);
  const activityStack = useAthleteDashboardStore((s) => s.activityStack);
  const activitySport = useAthleteDashboardStore((s) => s.activitySport);
  const userTrainingProfile = useAthleteDashboardStore((s) => s.userTrainingProfile);
  const storedFacilities = useAthleteDashboardStore((s) => s.reserveAthleteFacilities);
  const setPhysiqueFocus = useAthleteDashboardStore((s) => s.setPhysiqueFocus);
  const setActivityStack = useAthleteDashboardStore((s) => s.setActivityStack);
  const setReserveAthleteFacilities = useAthleteDashboardStore((s) => s.setReserveAthleteFacilities);
  const selectProtocol = useAthleteDashboardStore((s) => s.selectProtocol);

  const female = showsWomensArchitecture({ genderIdentity, sex });

  const [step, setStep] = useState<ChooserStep>(startStep);
  const [category, setCategory] = useState("all");
  const [draft, setDraft] = useState<Draft>(() => {
    const def = startProtocolId ? getProtocol(startProtocolId) : null;
    return {
      primary: focus?.primary ?? null,
      secondary: focus?.secondary ?? [],
      support: focus?.support ?? [],
      track: female ? (focus?.track ?? null) : null,
      stack: activityStack,
      sport: activitySport,
      protocolId: def?.id ?? null,
      duration: def?.durationOptions[0] ?? null,
      eventName: activeProtocol?.eventName ?? "",
      eventType: activeProtocol?.eventType ?? "none",
      eventDate: activeProtocol?.eventDate ?? "",
      amenities: storedFacilities.length ? storedFacilities : amenitiesForEnvironment(userTrainingProfile.gymEnvironment),
    };
  });
  const patch = useCallback((p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p })), []);
  /* Computed in the same render as the change, so an outside click right after a choice already sees it. */
  const dirty = useDirtySnapshot(draft);

  const selection = { primary: draft.primary, secondary: draft.secondary, support: draft.support, track: draft.track };
  const { options: goalOptions } = useMemo(
    () =>
      getPriorityOptionSet({
        genderIdentity,
        womensEnabled: female && womensEnabled,
        profilePath: female ? profilePath : profilePath === "womens-performance" ? null : profilePath,
        protocolCategory: female ? (activeProtocol?.category ?? null) : null,
        womensTrack: female ? draft.track : null,
      }),
    [genderIdentity, female, womensEnabled, profilePath, activeProtocol?.category, draft.track],
  );
  const activeGoal = findActivePriorityOption(goalOptions, selection);
  const preview = resolveFocusArchitecture({ ...selection, updatedAt: null }, { womensActive: female && womensEnabled });

  const deadline = useMemo(() => planDeadline(draft.eventDate || null), [draft.eventDate]);
  const recommended = recommendProtocols(
        {
          goal: [profileGoal, weakPoints.join(" "), activeGoal?.label ?? "", draft.eventType !== "none" ? "cut shred lean out vacation" : ""].filter(Boolean).join(" "),
          daysToDeadline: deadline.daysRemaining,
          gymEnvironment: userTrainingProfile.gymEnvironment,
          trainingLevel: userTrainingProfile.trainingLevel,
          hasWeakPoints: weakPoints.length > 0,
          womensPath: female,
          genderIdentity,
        },
        3,
  );
  const filter = CATEGORY_FILTERS.find((f) => f.id === category) ?? CATEGORY_FILTERS[0];
  const recommendedIds = new Set(recommended.map((p) => p.id));
  const library = PROTOCOL_LIBRARY.filter((p) => !recommendedIds.has(p.id) && filter.match(p.category) && (female || p.category !== "womens-performance"));

  const chosen = draft.protocolId ? getProtocol(draft.protocolId) : null;

  function pickGoal(o: PriorityOption) {
    if (priorityOptionMatches(o, selection)) {
      patch({ primary: null, secondary: [], support: [], track: null });
    } else if (o.track) {
      patch({ track: female ? o.track : null, primary: null, secondary: [], support: [] });
    } else {
      patch({ track: null, primary: o.primary ?? null, secondary: o.secondary ?? [], support: o.support ?? [] });
    }
  }

  function pickProtocol(id: string) {
    const def = getProtocol(id);
    patch({ protocolId: id, duration: def?.durationOptions[0] ?? null });
    setStep("confirm");
  }

  const focusChanged =
    draft.primary !== (focus?.primary ?? null) ||
    draft.secondary.join() !== (focus?.secondary ?? []).join() ||
    draft.support.join() !== (focus?.support ?? []).join() ||
    draft.track !== (female ? (focus?.track ?? null) : null);
  const stackChanged = draft.stack !== activityStack || draft.sport !== activitySport;

  function applyPriorities() {
    if (focusChanged) setPhysiqueFocus({ primary: draft.primary, secondary: draft.secondary, support: draft.support, track: draft.track });
    if (stackChanged) setActivityStack(draft.stack, draft.sport);
  }

  function run() {
    if (!chosen) return;
    applyPriorities();
    if (chosen.category === "reserve-athlete") setReserveAthleteFacilities(draft.amenities);
    selectProtocol(chosen, {
      durationWeeks: chosen.durationOptions.length === 0 ? undefined : (draft.duration ?? undefined),
      eventName: draft.eventName.trim() || null,
      eventType: draft.eventType !== "none" ? draft.eventType : null,
      eventDate: draft.eventDate || null,
    });
    onDone();
  }

  const sportStack = draft.stack === "gym-sports" || draft.stack === "gym-pilates-sports" || draft.stack === "full-hybrid";
  const back = adjacentChooserStep(step, "back");
  const next = adjacentChooserStep(step, "next");

  return (
    <ReserveBottomSheet open onClose={onDone} title="Choose Your Protocol" dirty={dirty}>
    <div data-protocol="chooser">
      {/* Steps: where the member is, and a way to any step. */}
      <ol className="-mx-1 mb-4 flex flex-wrap gap-1 border-b border-white/[0.06] pb-2" aria-label="Chooser steps">
        {CHOOSER_STEPS.map((s, i) => {
          const current = s.step === step || (step === "confirm" && s.step === "protocol");
          return (
            <li key={s.step}>
              <button
                type="button"
                onClick={() => setStep(s.step)}
                aria-current={current ? "step" : undefined}
                className={`min-h-[44px] px-2.5 font-mono text-[10px] uppercase tracking-[0.16em] transition-colors ${current ? "text-[#e8c87a]" : "text-white/50 hover:text-white/80"}`}
              >
                <span className="sr-only">Step {i + 1}: </span>
                {s.label}
              </button>
            </li>
          );
        })}
      </ol>

      {step === "goal" && (
        <fieldset>
          <legend className="text-[13px] text-white/70">What are you building? Reserve sets the priorities underneath.</legend>
          <div role="radiogroup" aria-label="Goal" className="mt-2 divide-y divide-white/[0.06]">
            {goalOptions.map((o) => (
              <OptionRow
                key={o.id}
                checked={priorityOptionMatches(o, selection)}
                title={o.label}
                detail={o.description}
                onClick={() => pickGoal(o)}
              />
            ))}
          </div>
        </fieldset>
      )}

      {step === "activities" && (
        <fieldset>
          <legend className="text-[13px] text-white/70">What does your week include outside the gym?</legend>
          <div role="radiogroup" aria-label="Activities" className="mt-2 divide-y divide-white/[0.06]">
            {ACTIVITY_STACKS.map((s) => (
              <OptionRow key={s.key} checked={draft.stack === s.key} title={s.label} detail={s.blurb} onClick={() => patch({ stack: s.key })} />
            ))}
          </div>
          {sportStack && (
            <div className="mt-3">
              <ReserveSelect
                label="Sport"
                value={draft.sport ?? "none"}
                options={[{ value: "none", label: "Not set" }, ...SPORT_OPTIONS.map((sp) => ({ value: sp.key, label: sp.label }))]}
                onChange={(v) => patch({ sport: v === "none" ? null : (v as SportType) })}
              />
            </div>
          )}
        </fieldset>
      )}

      {step === "focus" && (
        <div>
          {female && (
            <fieldset className="mb-4">
              <legend className="text-[13px] text-white/70">Women&apos;s physique architecture</legend>
              <div role="radiogroup" aria-label="Women's physique architecture" className="mt-2 divide-y divide-white/[0.06]">
                {WOMENS_TRACK_ORDER.map((key) => {
                  const t = WOMENS_TRACKS[key];
                  return (
                    <OptionRow
                      key={key}
                      checked={draft.track === key}
                      title={t.name}
                      detail={t.desireHook}
                      onClick={() => patch(draft.track === key ? { track: null } : { track: key, primary: null, secondary: [], support: [] })}
                    />
                  );
                })}
              </div>
            </fieldset>
          )}
          <ReserveSelect
            label="Primary focus"
            value={draft.primary ?? "none"}
            options={[{ value: "none", label: "Balanced · no single focus" }, ...MUSCLE_PRIORITIES.map((m) => ({ value: m.id, label: m.label }))]}
            onChange={(v) =>
              patch({
                track: null,
                primary: v === "none" ? null : (v as MusclePriority),
                secondary: draft.secondary.filter((m) => m !== v),
                support: draft.support.filter((m) => m !== v),
              })
            }
          />
          <div className="mt-4 border-l-2 border-[#d5b15f]/40 pl-3">
            <p className="text-[14px] font-semibold text-[#f2eee6]">{activeGoal?.previewTitle ?? preview.architectureName}</p>
            <p className="mt-1 text-[12px] leading-[1.5] text-white/65">{activeGoal?.previewExplanation ?? preview.weeklyBias}</p>
            {(draft.secondary.length > 0 || draft.support.length > 0) && !draft.track && (
              <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-white/50">
                {[...draft.secondary, ...draft.support].map(musclePriorityLabel).join(" · ")}
              </p>
            )}
          </div>
        </div>
      )}

      {step === "protocol" && (
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/55">Recommended for you</p>
          <div role="radiogroup" aria-label="Recommended protocols" className="mt-1 divide-y divide-white/[0.06]">
            {recommended.map((p) => (
              <OptionRow
                key={p.id}
                data-chooser-protocol={p.name}
                checked={draft.protocolId === p.id}
                title={p.name}
                detail={`${p.trainingDays} days a week · ${CATEGORY_LABEL[p.category]}`}
                onClick={() => pickProtocol(p.id)}
              />
            ))}
          </div>
          <div className="mt-4">
            <ReserveSelect
              label="Browse the library"
              value={category}
              options={CATEGORY_FILTERS.filter((f) => female || f.id !== "women").map((f) => ({ value: f.id, label: f.label }))}
              onChange={setCategory}
            />
          </div>
          <div role="radiogroup" aria-label="Protocol library" className="mt-1 divide-y divide-white/[0.06]">
            {library.length === 0 ? (
              <p className="py-3 text-[12.5px] text-white/60">Every protocol in this group is already recommended above.</p>
            ) : (
              library.map((p) => (
                <OptionRow
                  key={p.id}
                  data-chooser-protocol={p.name}
                  checked={draft.protocolId === p.id}
                  title={p.name}
                  detail={`${p.trainingDays} days a week · ${CATEGORY_LABEL[p.category]}`}
                  onClick={() => pickProtocol(p.id)}
                />
              ))
            )}
          </div>
        </div>
      )}

      {step === "confirm" && chosen && (
        <ConfirmStep
          draft={draft}
          patch={patch}
          name={chosen.name}
          tagline={chosen.tagline}
          architecture={chosen.womensTrack ? WOMENS_TRACKS[chosen.womensTrack].name : familyArchitectureName(familyForCategory(chosen.category))}
          cadence={`${chosen.trainingDays} training · ${protocolLegFrequency(chosen.id, chosen.category)} · ${chosen.cardioDays} cardio · ${chosen.mobilityDays} mobility`}
          durationOptions={chosen.durationOptions}
          athlete={chosen.category === "reserve-athlete"}
          safetyNote={chosen.safetyNote}
          deadlineLabel={deadline.weeksRemaining != null ? `${deadline.weeksRemaining} weeks · ${deadline.urgencyLabel}` : null}
        />
      )}

      <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-white/[0.06] pt-4">
        {back && (
          <ReserveButton tier="quiet" size="sm" onClick={() => setStep(back)}>
            Back
          </ReserveButton>
        )}
        {step !== "confirm" && step !== "protocol" && (focusChanged || stackChanged) && (
          <ReserveButton
            tier="quiet"
            size="sm"
            onClick={() => {
              applyPriorities();
              onDone();
            }}
          >
            Save Priorities
          </ReserveButton>
        )}
        <span className="flex-1" />
        {step === "confirm" && chosen ? (
          <ReserveButton tier="primary" size="md" onClick={run}>
            Run This Protocol
          </ReserveButton>
        ) : next ? (
          <ReserveButton tier="secondary" size="md" onClick={() => setStep(next)}>
            Next · {CHOOSER_STEPS.find((s) => s.step === next)?.label}
          </ReserveButton>
        ) : null}
      </div>
    </div>
    </ReserveBottomSheet>
  );
}

function OptionRow({
  checked,
  title,
  detail,
  onClick,
  ...rest
}: {
  checked: boolean;
  title: string;
  detail?: string;
  onClick: () => void;
  "data-chooser-protocol"?: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onClick}
      {...rest}
      className="flex min-h-[48px] w-full items-center gap-3 py-2.5 text-left transition-colors hover:bg-white/[0.02]"
    >
      <span
        aria-hidden="true"
        className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border ${checked ? "border-[#e8c87a] bg-[#e8c87a]/15 text-[#e8c87a]" : "border-white/25"}`}
      >
        {checked && <Check size={12} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block text-[13.5px] font-semibold ${checked ? "text-[#f2eee6]" : "text-white/85"}`}>{title}</span>
        {detail && <span className="mt-0.5 block text-[12px] leading-snug text-white/55">{detail}</span>}
      </span>
    </button>
  );
}

function ConfirmStep({
  draft,
  patch,
  name,
  tagline,
  architecture,
  cadence,
  durationOptions,
  athlete,
  safetyNote,
  deadlineLabel,
}: {
  draft: Draft;
  patch: (p: Partial<Draft>) => void;
  name: string;
  tagline: string;
  architecture: string;
  cadence: string;
  durationOptions: number[];
  athlete: boolean;
  safetyNote?: string;
  deadlineLabel: string | null;
}) {
  const amenityGroups = amenitiesByGroup(ALL_FACILITY_AMENITIES);
  const field =
    "mt-1.5 min-h-[44px] w-full rounded-lg border border-white/[0.1] bg-black/30 px-3 py-2 text-[16px] text-[#f2eee6] outline-none placeholder:text-white/30 focus:border-white/[0.25]";
  return (
    <div>
      <p className="text-[18px] font-bold leading-tight text-[#f2eee6]">{name}</p>
      <p className="mt-1 text-[12.5px] leading-[1.5] text-white/65">{tagline}</p>
      <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-white/55">{architecture} · {cadence}</p>

      {durationOptions.length > 0 && (
        <div className="mt-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/55">Block length</p>
          <div role="radiogroup" aria-label="Block length" className="mt-1.5 flex flex-wrap gap-2">
            {durationOptions.map((w) => {
              const on = draft.duration === w;
              return (
                <button
                  key={w}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => patch({ duration: w })}
                  className={`min-h-[44px] rounded-lg border px-3 text-[13px] font-semibold transition-colors ${on ? "border-[#e8c87a]/60 text-[#e8c87a]" : "border-white/[0.1] text-white/65 hover:text-white/85"}`}
                >
                  {w} weeks
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block min-w-0">
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/55">Target date</span>
          <input type="date" value={draft.eventDate} onChange={(e) => patch({ eventDate: e.target.value })} className={field} />
        </label>
        <label className="block min-w-0">
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/55">Event name</span>
          <input type="text" value={draft.eventName} placeholder="Optional" onChange={(e) => patch({ eventName: e.target.value })} className={field} />
        </label>
      </div>
      <div className="mt-3">
        <ReserveSelect
          label="Event type"
          value={draft.eventType}
          options={EVENT_TYPES.map((t) => ({ value: t, label: EVENT_TYPE_LABEL[t] }))}
          onChange={(v) => patch({ eventType: v as EventType })}
        />
      </div>
      {deadlineLabel && <p className="mt-2 text-[12px] text-white/60">{deadlineLabel}</p>}

      {athlete && (
        <div className="mt-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/55">What you can reach</p>
          {(Object.keys(amenityGroups) as AmenityGroup[]).map((g) =>
            amenityGroups[g].length === 0 ? null : (
              <div key={g} className="mt-2">
                <p className="text-[11px] text-white/50">{AMENITY_GROUP_LABEL[g]}</p>
                <div className="divide-y divide-white/[0.06]">
                  {amenityGroups[g].map((a) => {
                    const on = draft.amenities.includes(a);
                    return (
                      <button
                        key={a}
                        type="button"
                        role="checkbox"
                        aria-checked={on}
                        onClick={() => patch({ amenities: on ? draft.amenities.filter((x) => x !== a) : [...draft.amenities, a] })}
                        className="flex min-h-[44px] w-full items-center gap-3 text-left text-[13px] text-white/80"
                      >
                        <span aria-hidden="true" className={`grid h-4 w-4 place-items-center rounded border ${on ? "border-[#e8c87a] text-[#e8c87a]" : "border-white/25"}`}>
                          {on && <Check size={11} />}
                        </span>
                        {FACILITY_AMENITY_LABEL[a]}
                      </button>
                    );
                  })}
                </div>
              </div>
            ),
          )}
        </div>
      )}

      {safetyNote && <p className="mt-4 text-[11.5px] leading-[1.5] text-white/55">{safetyNote}</p>}
      <p className="mt-3 text-[11px] text-white/45">Timeline-aware organization only. No guaranteed outcomes.</p>
    </div>
  );
}
