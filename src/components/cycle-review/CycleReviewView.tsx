"use client";

import { ArrowLeft, ClipboardList, Stethoscope } from "lucide-react";
import { useCallback, useRef, useState } from "react";

import { EscalationList } from "@/components/safety/EscalationList";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { ReserveButton, ReserveDisclosure } from "@/components/ui/reserve";
import { BURDENS } from "@/lib/compound-intelligence/burdens";
import { EVIDENCE_GRADE_LABEL } from "@/lib/compound-intelligence/evidence";
import { SYSTEM_STATUS_LABEL, type SystemRow, type SystemStatus } from "@/lib/cycle-review/body-systems";
import { CHECK_IN_BUCKET_LABEL, type CheckInBucket } from "@/lib/cycle-review/check-in";
import { COMPLEXITY_LEVEL_LABEL, COMPLEXITY_REVIEW_LABEL, type ComplexityLevel } from "@/lib/cycle-review/complexity";
import { MARKER_TREND_STATUS_LABEL, type MarkerTrendStatus } from "@/lib/cycle-review/lab-trends";
import { ATTENTION_SEVERITY_LABEL, NOT_ENTERED, type AttentionSeverity } from "@/lib/cycle-review/report";
import { COMPOUND_PURPOSE_LABEL } from "@/lib/cycle-review/types";
import { dateKeyOf } from "@/lib/cycle/cycle-period";
import { RESERVE, alpha } from "@/lib/design/tokens";

import { ClinicianReviewCard } from "./ClinicianReviewCard";
import { CycleCheckInSheet } from "./CycleCheckInSheet";
import { CycleGoalForm } from "./CycleGoalForm";
import { MarkerSparkline } from "./MarkerSparkline";
import { SupportPlanSection } from "./SupportPlanSection";
import { useCycleReview, type CycleReviewModel } from "./useCycleReview";

/* ════════════════════════════════════════════════════════════════════════
   CYCLE REVIEW — given what the member is already doing, how can the plan
   become more deliberate, measurable, goal-aligned and reviewable by a
   clinician? Never "how can it be stronger".

   One dominant region per state:
     no goal        → the goal form
     care needed    → the care panel; the review waits behind a button
     check-in due   → the top card's "Log this week's check-in"
     current        → the reading, then "Bring this to your clinician"
   ════════════════════════════════════════════════════════════════════════ */

const SEVERITY_COLOR: Record<AttentionSeverity, string> = {
  high: RESERVE.red,
  moderate: RESERVE.amber,
  low: "rgba(255,255,255,0.5)",
};

const TREND_COLOR: Record<MarkerTrendStatus, string> = {
  "clinician-review": RESERVE.red,
  "outside-range": RESERVE.amber,
  trend: RESERVE.amber,
  changed: RESERVE.steel,
  "at-baseline": "rgba(255,255,255,0.55)",
  "inside-range": "rgba(255,255,255,0.55)",
  "no-data": "rgba(255,255,255,0.4)",
};

const SYSTEM_COLOR: Record<SystemStatus, string> = {
  "clinician-review": RESERVE.red,
  trend: RESERVE.amber,
  "monitoring-due": "rgba(255,255,255,0.6)",
  incomplete: "rgba(255,255,255,0.6)",
  monitored: "rgba(242,238,230,0.72)",
  "no-load": "rgba(255,255,255,0.38)",
};

const SYSTEM_RANK: Record<SystemStatus, number> = { "clinician-review": 0, trend: 1, "monitoring-due": 2, incomplete: 3, monitored: 4, "no-load": 5 };
const LEVEL_TICKS: Record<ComplexityLevel, number> = { low: 1, moderate: 2, high: 3, "very-high": 4 };
const BUCKET_ORDER: CheckInBucket[] = ["review", "worth-watching", "improved", "stable"];
const ATTENTION_VISIBLE = 6;

function formatDay(key: string | undefined): string {
  if (!key) return "";
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function StatusWord({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span className="font-mono text-[9px] uppercase tracking-[0.18em]" style={{ color }}>
      {children}
    </span>
  );
}

function SectionHead({ whisper, title, accent = RESERVE.steel, children }: { whisper: string; title: string; accent?: string; children?: React.ReactNode }) {
  return (
    <div>
      <p className="type-whisper" style={{ color: alpha(accent, 0.9) }}>{whisper}</p>
      <h3 className="type-section-title mt-1.5" style={{ color: RESERVE.ivory }}>{title}</h3>
      {children}
    </div>
  );
}

function Hairline() {
  return <div aria-hidden="true" className="h-px w-full" style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.08) 20%, rgba(255,255,255,0.08) 80%, transparent)" }} />;
}

export function CycleReviewView({ now, onBack }: { now: Date; onBack: () => void }) {
  const model = useCycleReview(now);
  const [editingGoal, setEditingGoal] = useState(false);
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [showAnyway, setShowAnyway] = useState(false);
  const closeCheckIn = useCallback(() => setCheckInOpen(false), []);
  const clinicianRef = useRef<HTMLDivElement>(null);

  const back = (
    <div>
      <ReserveButton tier="quiet" size="sm" icon={ArrowLeft} onClick={onBack}>
        Back to Cycle &amp; Safety
      </ReserveButton>
    </div>
  );

  if (!model) {
    return (
      <div className="flex flex-col gap-4">
        {back}
        <GlassPanel accent={RESERVE.slate}>
          <p className="text-[13px] text-white/65">Plan a cycle in Cycle &amp; Safety first. The review reads your plan, labs, check-ins and training against it.</p>
        </GlassPanel>
      </div>
    );
  }

  const { review, goalSetup, cycleState, compounds } = model;
  const today = dateKeyOf(now);

  if (!goalSetup || editingGoal) {
    return (
      <div className="flex flex-col gap-4">
        {back}
        <CycleGoalForm cycleId={cycleState.cycle.id} compounds={compounds} initial={goalSetup} onDone={() => setEditingGoal(false)} />
      </div>
    );
  }

  const scrollToClinician = () => {
    const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    clinicianRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  };

  const holdForCare = review.needsCare && !showAnyway;

  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      {back}

      <TopCard
        model={model}
        onCheckIn={() => setCheckInOpen(true)}
        onEditGoal={() => setEditingGoal(true)}
        onClinician={scrollToClinician}
        holdForCare={holdForCare}
      />

      {holdForCare ? (
        <GlassPanel accent={RESERVE.red}>
          <div className="flex flex-col gap-4">
            <SectionHead whisper="Care first" title="Get care before reviewing your cycle" accent={RESERVE.red}>
              <p className="type-supporting mt-1.5 max-w-[600px]">
                Something you reported, or a result the lab marked critical, needs medical attention now. The review is here when you are ready.
              </p>
            </SectionHead>
            {review.careItems.length > 0 ? (
              <EscalationList items={review.careItems} label="What to do now" />
            ) : (
              <p className="text-[13px] text-white/75">Your latest check-in includes a warning sign. Get medical care today — your clinician, urgent care or a telehealth visit — or call 911 if symptoms are severe.</p>
            )}
            <div>
              <ReserveButton tier="quiet" size="sm" onClick={() => setShowAnyway(true)}>
                Show the review anyway
              </ReserveButton>
            </div>
          </div>
        </GlassPanel>
      ) : (
        <>
          <ReadingPanel model={model} />
          <LabTrendsPanel model={model} />
          <SystemsPanel systems={review.systems} />
          <SupportPlanSection support={model.review.support} onClinician={scrollToClinician} />
          <ComplexityPanel model={model} />
          <NutritionPanel model={model} />
          <TrainingPanel model={model} />
          <QuestionsPanel questions={review.questions} />
          <div ref={clinicianRef} className="scroll-mt-4">
            <ClinicianReviewCard model={model} now={now} />
          </div>
        </>
      )}

      <CycleCheckInSheet open={checkInOpen} onClose={closeCheckIn} cycleId={cycleState.cycle.id} today={today} />
    </div>
  );
}

/* ─── Top card ────────────────────────────────────────────────────────── */

function TopCard({
  model,
  onCheckIn,
  onEditGoal,
  onClinician,
  holdForCare,
}: {
  model: CycleReviewModel;
  onCheckIn: () => void;
  onEditGoal: () => void;
  onClinician: () => void;
  holdForCare: boolean;
}) {
  const { review, cycleState } = model;
  const onCycle = cycleState.phase !== "upcoming";

  return (
    <GlassPanel accent={RESERVE.gold}>
      <div className="flex flex-col gap-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="type-whisper" style={{ color: alpha(RESERVE.gold, 0.9) }}>Cycle review · {cycleState.cycle.name}</p>
            <h2 className="type-page-title mt-2" style={{ color: RESERVE.ivory }}>{review.goalLabel}</h2>
            {review.priorityLabels.length > 0 && (
              <p className="type-supporting mt-1.5 max-w-[560px]">Also important: {review.priorityLabels.join(" · ")}</p>
            )}
          </div>
          {onCycle && (
            <p className="tnum shrink-0 text-right">
              <span className="type-whisper block">Week</span>
              <span className="type-metric" style={{ color: RESERVE.gold }}>{cycleState.weekNumber}</span>
              <span className="text-[14px] text-white/45"> / {cycleState.totalWeeks}</span>
            </p>
          )}
        </div>

        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
          <div>
            <dt className="type-whisper">Phase</dt>
            <dd className="mt-1 text-[13.5px] font-semibold" style={{ color: RESERVE.ivory }}>{review.phaseLabel}</dd>
          </div>
          <div>
            <dt className="type-whisper">Last labs</dt>
            <dd className="tnum mt-1 text-[13.5px] font-semibold" style={{ color: review.lastLabDate ? RESERVE.ivory : "rgba(255,255,255,0.5)" }}>
              {review.lastLabDate ? formatDay(review.lastLabDate) : "None logged"}
            </dd>
          </div>
          <div>
            <dt className="type-whisper">Last check-in</dt>
            <dd className="tnum mt-1 text-[13.5px] font-semibold" style={{ color: review.lastCheckInDate ? RESERVE.ivory : "rgba(255,255,255,0.5)" }}>
              {review.lastCheckInDate ? formatDay(review.lastCheckInDate) : "None yet"}
              {review.checkInDue && <span className="ml-2 font-mono text-[9px] uppercase tracking-[0.16em]" style={{ color: RESERVE.amber }}>Due</span>}
            </dd>
          </div>
        </dl>

        <div className="flex flex-wrap items-center gap-2">
          {holdForCare ? null : review.checkInDue ? (
            <ReserveButton tier="primary" icon={ClipboardList} onClick={onCheckIn}>
              Log this week&apos;s check-in
            </ReserveButton>
          ) : (
            <ReserveButton tier="primary" icon={Stethoscope} onClick={onClinician}>
              Bring this to your clinician
            </ReserveButton>
          )}
          {!review.checkInDue && !holdForCare && (
            <ReserveButton tier="secondary" size="sm" onClick={onCheckIn}>
              Log a check-in
            </ReserveButton>
          )}
          <ReserveButton tier="quiet" size="sm" onClick={onEditGoal}>
            Edit goal
          </ReserveButton>
        </div>
      </div>
    </GlassPanel>
  );
}

/* ─── What looks good · What needs attention · Since last week ────────── */

function ReadingPanel({ model }: { model: CycleReviewModel }) {
  const { review } = model;
  const visible = review.attention.slice(0, ATTENTION_VISIBLE);
  const more = review.attention.slice(ATTENTION_VISIBLE);
  const comparison = review.checkIn?.previous ? review.checkIn : null;

  return (
    <GlassPanel>
      <div className="flex flex-col gap-6">
        <section aria-label="What looks good">
          <SectionHead whisper="What looks good" title="Aligned with your goal" accent={RESERVE.green} />
          {review.aligned.length > 0 ? (
            <ul className="mt-3 flex flex-col gap-2">
              {review.aligned.map((line) => (
                <li key={line} className="flex gap-2.5 text-[13px] leading-[1.5] text-white/75">
                  <span aria-hidden="true" className="mt-[7px] h-1 w-1 shrink-0 rounded-full" style={{ background: RESERVE.green }} />
                  {line}
                </li>
              ))}
            </ul>
          ) : (
            <p className="type-supporting mt-3">Nothing to confirm yet. Labs and a weekly check-in build this picture.</p>
          )}
        </section>

        <Hairline />

        <section aria-label="What needs attention">
          <SectionHead whisper="What needs attention" title={review.attention.length ? "Ranked by importance" : "Nothing needs attention"} accent={RESERVE.amber} />
          {review.attention.length > 0 && (
            <ol className="mt-3 flex flex-col">
              {visible.map((item) => (
                <AttentionRow key={item.id} severity={item.severity} title={item.title} detail={item.detail} />
              ))}
            </ol>
          )}
          {more.length > 0 && (
            <ReserveDisclosure summary={`${more.length} more`} accent={RESERVE.slate}>
              <ol className="flex flex-col">
                {more.map((item) => (
                  <AttentionRow key={item.id} severity={item.severity} title={item.title} detail={item.detail} />
                ))}
              </ol>
            </ReserveDisclosure>
          )}
        </section>

        {comparison && (
          <>
            <Hairline />
            <section aria-label="Since last week">
              <SectionHead whisper="Since last week" title="Your check-ins, compared" accent={RESERVE.steel} />
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                {BUCKET_ORDER.map((bucket) => {
                  const items = comparison.changes.filter((c) => c.bucket === bucket);
                  if (items.length === 0) return null;
                  return (
                    <div key={bucket}>
                      <StatusWord color={bucket === "review" ? RESERVE.red : bucket === "worth-watching" ? RESERVE.amber : "rgba(255,255,255,0.55)"}>
                        {CHECK_IN_BUCKET_LABEL[bucket]}
                      </StatusWord>
                      <ul className="mt-1.5 flex flex-col gap-1">
                        {items.map((change) => (
                          <li key={change.id} className="text-[12.5px] leading-[1.5] text-white/70">{change.text}</li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        )}

        {review.gaps.length > 0 && (
          <ReserveDisclosure summary={`Monitoring gaps (${review.gaps.length})`} accent={RESERVE.slate}>
            <ul className="flex flex-col gap-1.5 pb-1">
              {review.gaps.map((gap) => (
                <li key={gap} className="text-[12.5px] leading-[1.5] text-white/65">{gap}</li>
              ))}
            </ul>
          </ReserveDisclosure>
        )}
      </div>
    </GlassPanel>
  );
}

function AttentionRow({ severity, title, detail }: { severity: AttentionSeverity; title: string; detail: string }) {
  return (
    <li className="flex flex-col gap-1 py-2.5 sm:flex-row sm:gap-4">
      <span className="w-[76px] shrink-0 pt-[3px]">
        <StatusWord color={SEVERITY_COLOR[severity]}>{ATTENTION_SEVERITY_LABEL[severity]}</StatusWord>
      </span>
      <div className="min-w-0">
        <p className="type-command" style={{ color: RESERVE.ivory }}>{title}</p>
        <p className="type-supporting mt-0.5 text-[12.5px]">{detail}</p>
      </div>
    </li>
  );
}

/* ─── Lab trends ──────────────────────────────────────────────────────── */

const QUIET_TRENDS: ReadonlySet<MarkerTrendStatus> = new Set(["inside-range", "at-baseline"]);

function LabTrendsPanel({ model }: { model: CycleReviewModel }) {
  const { review } = model;
  const withData = review.trends.filter((t) => t.current);
  const moving = withData.filter((t) => !QUIET_TRENDS.has(t.status));
  const steady = withData.filter((t) => QUIET_TRENDS.has(t.status));
  const missing = review.trends.filter((t) => !t.current);

  return (
    <GlassPanel accent={RESERVE.steel}>
      <section aria-label="Lab trends" className="flex flex-col gap-4">
        <SectionHead whisper="Lab trends" title="Your labs across this cycle">
          <p className="type-supporting mt-1.5 max-w-[620px] text-[12.5px]">
            Ranges and flags are the ones printed on your reports. Dashed line: cycle start. Short tick: compound added or paused. Timing only — no cause is implied.
          </p>
        </SectionHead>

        {withData.length === 0 ? (
          <p className="text-[13px] text-white/65">No labs logged yet. Upload a lab report in Bloodwork to see your results against this cycle.</p>
        ) : moving.length === 0 ? (
          <p className="text-[13px] text-white/65">No marker has moved beyond your baseline or outside your lab&apos;s range.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-white/[0.05]">
            {moving.map((trend) => (
              <li key={trend.key} className="flex flex-col gap-1.5 py-3">
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-semibold" style={{ color: RESERVE.ivory }}>{trend.label}</p>
                    <StatusWord color={TREND_COLOR[trend.status]}>{MARKER_TREND_STATUS_LABEL[trend.status]}</StatusWord>
                  </div>
                  <MarkerSparkline trend={trend} events={review.timeline} color={TREND_COLOR[trend.status]} />
                  <p className="tnum w-[84px] shrink-0 text-right">
                    <span className="text-[17px] font-bold" style={{ color: RESERVE.ivory }}>{trend.current!.valueText}</span>
                    {trend.unit && <span className="ml-1 text-[10.5px] text-white/45">{trend.unit}</span>}
                    {trend.baseline && trend.baseline !== trend.current && (
                      <span className="block text-[11px] text-white/45">from {trend.baseline.valueText}</span>
                    )}
                  </p>
                </div>
                <p className="type-supporting text-[12px]">{trend.reason}</p>
              </li>
            ))}
          </ul>
        )}

        <div>
          <p className="type-whisper">Cycle timeline</p>
          <ol className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5">
            {review.timeline.map((event) => (
              <li key={`${event.kind}-${event.date}-${event.label}`} className="text-[12px] text-white/65">
                <span className="tnum mr-1.5 text-white/40">{formatDay(event.date)}</span>
                {event.label}
              </li>
            ))}
          </ol>
        </div>

        {steady.length > 0 && (
          <ReserveDisclosure summary={`${steady.length} steady or inside your lab's range`} accent={RESERVE.slate}>
            <ul className="flex flex-col gap-1.5 pb-1">
              {steady.map((trend) => (
                <li key={trend.key} className="flex flex-wrap items-baseline gap-x-2 text-[12.5px] text-white/65">
                  <span style={{ color: RESERVE.ivory }}>{trend.label}</span>
                  <span className="tnum">{trend.current!.valueText}{trend.unit ? ` ${trend.unit}` : ""}</span>
                  <span className="text-white/45">· {formatDay(trend.current!.date)} · {MARKER_TREND_STATUS_LABEL[trend.status].toLowerCase()}</span>
                </li>
              ))}
            </ul>
          </ReserveDisclosure>
        )}
        {missing.length > 0 && (
          <ReserveDisclosure summary={`${missing.length} not in your logged labs`} accent={RESERVE.slate}>
            <p className="pb-1 text-[12.5px] leading-[1.6] text-white/60">Evidence needed: {missing.map((t) => t.label).join(", ")}.</p>
          </ReserveDisclosure>
        )}
      </section>
    </GlassPanel>
  );
}

/* ─── Body systems ────────────────────────────────────────────────────── */

function SystemsPanel({ systems }: { systems: SystemRow[] }) {
  const loaded = systems.filter((s) => s.status !== "no-load").sort((a, b) => SYSTEM_RANK[a.status] - SYSTEM_RANK[b.status]);
  const unloaded = systems.filter((s) => s.status === "no-load");

  return (
    <GlassPanel>
      <section aria-label="Body systems" className="flex flex-col gap-3">
        <SectionHead whisper="Body systems" title="Where monitoring stands" />
        <ul className="flex flex-col divide-y divide-white/[0.05]">
          {loaded.map((row) => (
            <li key={row.system} className="flex flex-col gap-0.5 py-2.5 sm:flex-row sm:gap-4">
              <p className="shrink-0 text-[13.5px] font-semibold sm:w-[150px]" style={{ color: RESERVE.ivory }}>{row.label}</p>
              <div className="min-w-0 flex-1">
                <StatusWord color={SYSTEM_COLOR[row.status]}>{SYSTEM_STATUS_LABEL[row.status]}</StatusWord>
                <p className="type-supporting mt-0.5 text-[12.5px]">{row.detail}</p>
                {(row.status === "clinician-review" || row.status === "trend") && row.compoundNames.length > 0 && (
                  <p className="mt-0.5 text-[11.5px] text-white/40">Commonly watched for {row.compoundNames.join(", ")}</p>
                )}
              </div>
            </li>
          ))}
        </ul>
        {unloaded.length > 0 && (
          <p className="text-[12px] text-white/45">No known load from this plan: {unloaded.map((s) => s.label).join(", ")}.</p>
        )}
      </section>
    </GlassPanel>
  );
}

/* ─── Cycle complexity ────────────────────────────────────────────────── */

function ComplexityPanel({ model }: { model: CycleReviewModel }) {
  const { complexity } = model.review;
  const ticks = LEVEL_TICKS[complexity.level];
  const purposes = model.goalSetup?.compoundPurposes ?? {};

  return (
    <GlassPanel>
      <section aria-label="Cycle complexity" className="flex flex-col gap-5">
        <div>
          <p className="type-whisper" style={{ color: alpha(RESERVE.slate, 0.95) }}>Cycle complexity</p>
          <div className="mt-2 flex flex-wrap items-center gap-4">
            <p className="text-[26px] font-extrabold leading-none" style={{ color: RESERVE.ivory }}>{COMPLEXITY_LEVEL_LABEL[complexity.level]}</p>
            <span aria-hidden="true" className="flex gap-1">
              {[1, 2, 3, 4].map((i) => (
                <span key={i} className="h-1.5 w-5 rounded-full" style={{ background: i <= ticks ? "rgba(242,238,230,0.75)" : "rgba(255,255,255,0.1)" }} />
              ))}
            </span>
            <StatusWord color={complexity.review.state === "review-soon" ? RESERVE.red : complexity.review.state === "worth-reviewing" ? RESERVE.amber : "rgba(255,255,255,0.55)"}>
              {COMPLEXITY_REVIEW_LABEL[complexity.review.state]}
            </StatusWord>
          </div>
          <p className="type-supporting mt-2 max-w-[620px] text-[12.5px]">
            Not a quality score. It reflects how many compounds and shared loads the plan carries, how long it runs, what monitoring is missing and what has moved.
          </p>
        </div>

        {complexity.overlaps.length > 0 && (
          <div>
            <p className="type-whisper">Potential overlap</p>
            <OverlapList overlaps={complexity.overlaps.slice(0, OVERLAPS_VISIBLE)} />
            {complexity.overlaps.length > OVERLAPS_VISIBLE && (
              <ReserveDisclosure summary={`${complexity.overlaps.length - OVERLAPS_VISIBLE} more shared loads`} accent={RESERVE.slate}>
                <OverlapList overlaps={complexity.overlaps.slice(OVERLAPS_VISIBLE)} />
              </ReserveDisclosure>
            )}
            <p className="mt-2 text-[12px] leading-[1.5] text-white/50">
              Overlap does not automatically mean something must be removed. It raises the importance of monitoring and clinician review.
            </p>
          </div>
        )}

        {complexity.review.reasons.length > 0 && (
          <div>
            <p className="type-whisper">Complexity review</p>
            <ul className="mt-2 flex flex-col gap-1.5">
              {complexity.review.reasons.map((reason) => (
                <li key={reason} className="text-[13px] leading-[1.5] text-white/75">{reason}</li>
              ))}
            </ul>
          </div>
        )}

        {complexity.priorityConflicts.length > 0 && (
          <div>
            <p className="type-whisper">Against your priorities</p>
            <ul className="mt-2 flex flex-col gap-1.5">
              {complexity.priorityConflicts.map((conflict) => (
                <li key={conflict.priority} className="text-[13px] leading-[1.5] text-white/75">{conflict.text}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-col">
          {complexity.reasons.length > 0 && (
            <ReserveDisclosure summary="Why this band" accent={RESERVE.slate}>
              <ul className="flex flex-col gap-1.5 pb-1">
                {complexity.reasons.map((reason) => (
                  <li key={reason} className="text-[12.5px] leading-[1.5] text-white/65">{reason}</li>
                ))}
              </ul>
            </ReserveDisclosure>
          )}
          <ReserveDisclosure summary="Your plan as entered" accent={RESERVE.slate}>
            <ul className="flex flex-col divide-y divide-white/[0.05] pb-1">
              {model.input.compounds.map((c) => (
                <li key={c.id} className="py-2">
                  <p className="text-[13px] font-semibold" style={{ color: RESERVE.ivory }}>{c.name}</p>
                  <p className="tnum mt-0.5 text-[12px] leading-[1.6] text-white/55">
                    Amount: {c.amount?.trim() ? `${c.amount}${c.unit ? ` ${c.unit}` : ""}` : NOT_ENTERED} · Frequency: {c.frequency?.trim() || NOT_ENTERED} · Route: {c.route || NOT_ENTERED} · Started: {c.startDate ? formatDay(c.startDate) : NOT_ENTERED} · Purpose: {purposes[c.id] ? COMPOUND_PURPOSE_LABEL[purposes[c.id].kind] : NOT_ENTERED}
                  </p>
                </li>
              ))}
            </ul>
          </ReserveDisclosure>
        </div>
      </section>
    </GlassPanel>
  );
}

const OVERLAPS_VISIBLE = 4;

function OverlapList({ overlaps }: { overlaps: CycleReviewModel["review"]["complexity"]["overlaps"] }) {
  return (
    <ul className="mt-2 flex flex-col divide-y divide-white/[0.05]">
      {overlaps.map((overlap) => (
        <li key={overlap.burden} className="py-2.5">
          <p className="text-[13.5px] font-semibold" style={{ color: RESERVE.ivory }}>{BURDENS[overlap.burden].label}</p>
          <p className="mt-0.5 text-[12.5px] text-white/65">
            {overlap.compounds.map((c) => `${c.name} (${EVIDENCE_GRADE_LABEL[c.grade].toLowerCase()})`).join(" · ")}
          </p>
          {overlap.monitoringNote && <p className="type-supporting mt-0.5 text-[12px]">{overlap.monitoringNote}</p>}
        </li>
      ))}
    </ul>
  );
}

/* ─── Nutrition ───────────────────────────────────────────────────────── */

function NutritionPanel({ model }: { model: CycleReviewModel }) {
  const nutrition = model.review.nutrition;
  if (!nutrition) return null;
  const signal = nutrition.phaseMatch === "mismatch" || nutrition.velocity.status === "faster" || nutrition.velocity.status === "slower";

  return (
    <GlassPanel accent={RESERVE.green}>
      <section aria-label="Nutrition" className="flex flex-col gap-3">
        <SectionHead whisper="Nutrition" title={`Fuel for ${nutrition.goalLabel.toLowerCase()}`} accent={RESERVE.green}>
          <p className="mt-1.5 max-w-[620px] text-[13px] leading-[1.55]" style={{ color: nutrition.phaseMatch === "mismatch" ? RESERVE.amber : "rgba(242,238,230,0.72)" }}>
            {nutrition.phaseNote}
          </p>
        </SectionHead>

        {nutrition.glucose && (
          <div className="rounded-[14px] px-3.5 py-3" style={{ background: alpha(RESERVE.steel, 0.06) }}>
            <p className="type-whisper" style={{ color: alpha(RESERVE.steel, 0.9) }}>Blood sugar</p>
            <p className="mt-1 text-[12.5px] leading-[1.55] text-white/75">{nutrition.glucose.text}</p>
          </div>
        )}

        <ReserveDisclosure summary="Targets, focus and weight trend" accent={RESERVE.green} defaultOpen={signal}>
          <div className="flex flex-col gap-4 pb-1">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
              {nutrition.targets.map((target) => (
                <div key={target.label}>
                  <dt className="type-whisper">{target.label}</dt>
                  <dd className="tnum mt-1 text-[14px] font-semibold" style={{ color: RESERVE.ivory }}>{target.value}</dd>
                </div>
              ))}
            </dl>
            <ul className="flex flex-col gap-1.5">
              {nutrition.focus.map((line) => (
                <li key={line} className="text-[12.5px] leading-[1.5] text-white/70">{line}</li>
              ))}
            </ul>
            <p className="text-[12.5px] leading-[1.55]" style={{ color: nutrition.velocity.status === "within" || nutrition.velocity.status === "unknown" ? "rgba(255,255,255,0.65)" : RESERVE.amber }}>
              {nutrition.velocity.text}
            </p>
            <p className="text-[11.5px] text-white/45">Fuel is set by your goal, body composition, training and recovery — never by when a compound is taken.</p>
          </div>
        </ReserveDisclosure>
      </section>
    </GlassPanel>
  );
}

/* ─── Training + recovery ─────────────────────────────────────────────── */

const DIRECTION_WORD = { up: "Higher", down: "Lower", steady: "Steady", unknown: "—" } as const;

function TrainingPanel({ model }: { model: CycleReviewModel }) {
  const training = model.review.training;
  const watching = training.signals.some((s) => s.kind === "worth-watching");

  return (
    <GlassPanel>
      <section aria-label="Training and recovery" className="flex flex-col gap-3">
        <SectionHead whisper="Training + recovery" title="Are you recovering better?" />
        {!training.available ? (
          <p className="text-[13px] text-white/65">{training.windowLabel}</p>
        ) : (
          <>
            {training.signals.length > 0 ? (
              <ul className="flex flex-col gap-1.5">
                {training.signals.map((signal) => (
                  <li key={signal.id} className="text-[13px] leading-[1.55]" style={{ color: signal.kind === "worth-watching" ? RESERVE.amber : "rgba(242,238,230,0.75)" }}>
                    {signal.text}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13px] text-white/65">Not enough logged training, sleep or check-ins yet to compare recovery.</p>
            )}
            <ReserveDisclosure summary="Before the cycle vs the last four weeks" accent={RESERVE.slate} defaultOpen={watching}>
              <div className="overflow-x-auto pb-1">
                <table className="w-full min-w-[320px] text-left">
                  <caption className="sr-only">{training.windowLabel}</caption>
                  <thead>
                    <tr>
                      <th scope="col" className="type-whisper pb-2 font-normal">Signal</th>
                      <th scope="col" className="type-whisper pb-2 text-right font-normal">Before</th>
                      <th scope="col" className="type-whisper pb-2 text-right font-normal">Last 4 wk</th>
                      <th scope="col" className="type-whisper pb-2 text-right font-normal">Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {training.rows.map((row) => (
                      <tr key={row.id}>
                        <th scope="row" className="py-1.5 pr-3 text-[12.5px] font-normal text-white/70">{row.label}</th>
                        <td className="tnum py-1.5 text-right text-[12.5px] text-white/55">{row.before}</td>
                        <td className="tnum py-1.5 text-right text-[12.5px]" style={{ color: RESERVE.ivory }}>{row.during}</td>
                        <td className="py-1.5 text-right text-[11.5px] text-white/50">{DIRECTION_WORD[row.direction]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ReserveDisclosure>
          </>
        )}
      </section>
    </GlassPanel>
  );
}

/* ─── Questions ───────────────────────────────────────────────────────── */

function QuestionsPanel({ questions }: { questions: string[] }) {
  return (
    <GlassPanel accent={RESERVE.steel}>
      <section aria-label="Questions to ask at a visit" className="flex flex-col gap-3">
        <SectionHead whisper="Questions to ask at a visit" title="Built from your own numbers" />
        {questions.length > 0 ? (
          <ol className="flex flex-col gap-2.5">
            {questions.map((question, index) => (
              <li key={question} className="flex gap-3 text-[13px] leading-[1.55] text-white/80">
                <span className="tnum w-5 shrink-0 text-right font-mono text-[11px] text-white/40">{index + 1}</span>
                {question}
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-[13px] text-white/65">No questions yet. Log labs and a weekly check-in to build them.</p>
        )}
      </section>
    </GlassPanel>
  );
}
