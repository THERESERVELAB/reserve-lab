/* ────────────────────────────────────────────────────────────────────────────
   RECOVERY COMMAND V2 — ENGINE

   Deterministic, behavioral-only computation of Recovery Reserve, Recovery
   Debt, momentum, intelligence, the next best action, and Recovery Suite
   recommendations. No medical interpretation — these are summaries of the
   member's own logged lifestyle data.
   ──────────────────────────────────────────────────────────────────────── */

import {
  RECOVERY_CLASS_META,
  STRESS_LOAD_META,
  localDateKey,
  type MomentumState,
  type RecoveryAction,
  type RecoveryClass,
  type RecoveryCommandState,
  type RecoveryDebt,
  type RecoveryInsight,
  type RecoverySuiteTool,
  type RecoveryTimelineRow,
  type StressLoadLevel,
} from "./types";
import { loggedDays } from "./log-rank";

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((s, n) => s + n, 0) / nums.length;
}

function clamp(n: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, n));
}

function lastN<T extends { date: string }>(rows: T[], n: number): T[] {
  return [...rows].sort((a, b) => a.date.localeCompare(b.date)).slice(-n);
}

/** A reserve is read only from at least this many kinds of log. One answer is not a reserve. */
export const RESERVE_MIN_INPUTS = 2;

/** Until the record spans this many days, the reserve is an early read: shown, never coloured as a verdict. */
export const RESERVE_CALIBRATION_DAYS = 3;

/** Shown in place of a class while the record is still short. */
const EARLY_READ = { label: "Early Read", color: "#8ea0b8" } as const;

/**
 * How much of today's water a member could reasonably have in by now: none
 * expected before 7 AM, all of it by 9 PM. Floored so first thing in the
 * morning never reads as on target by default.
 */
export function hydrationPace(now: Date): number {
  const hours = now.getHours() + now.getMinutes() / 60;
  return Math.min(1, Math.max(0.15, (hours - 7) / 14));
}

/** Local day key for a day key offset by whole days. */
function shiftDay(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  return localDateKey(new Date(y, m - 1, d + days));
}

function daysBetween(fromKey: string, toKey: string): number {
  const [y1, m1, d1] = fromKey.split("-").map(Number);
  const [y2, m2, d2] = toKey.split("-").map(Number);
  return Math.round((new Date(y2, m2 - 1, d2).getTime() - new Date(y1, m1 - 1, d1).getTime()) / 86_400_000);
}

export type RecoveryInputKind = "sleep" | "water" | "mobility" | "check-in";

/** Each input's weight in the Recovery Reserve, before re-weighting over what was logged. */
export const RESERVE_WEIGHTS: Record<RecoveryInputKind, number> = { sleep: 0.34, water: 0.22, mobility: 0.16, "check-in": 0.28 };

export type RecoverySnapshot = {
  /** Enough evidence to read a Recovery Reserve (RESERVE_MIN_INPUTS kinds of log). */
  hasData: boolean;
  /** Any recovery log at all. The screen stops asking for a first log once this is true. */
  hasLogs: boolean;
  /** "none" — nothing logged; "limited" — logs exist, too few kinds for a reserve. */
  evidence: "none" | "limited" | "sufficient";
  /** Distinct days with any recovery log. */
  daysLogged: number;
  /** A reserve can be read, but the record is under RESERVE_CALIBRATION_DAYS days: an early read, not a verdict. */
  calibrating: boolean;
  /** The kinds of log the reserve reads, and the ones the member has not logged. */
  inputsLogged: RecoveryInputKind[];
  inputsMissing: RecoveryInputKind[];
  reserve: number; // 0–100; 0 whenever hasData is false — never read it without hasData
  reserveClass: RecoveryClass;
  reserveColor: string;
  reserveLabel: string;
  momentum: MomentumState;
  // Sleep
  sleepLastNight: number | null;
  sleepAvg7: number;
  sleepConsistency: "strong" | "variable" | "data-limited";
  sleepImpact: "supporting" | "limiting" | "neutral";
  // Hydration
  hydrationTodayOz: number;
  hydrationTargetOz: number;
  hydrationAdherence: number; // %
  hydrationStatus: "on-target" | "behind-pace" | "data-limited";
  // Mobility
  mobilityThisWeek: number;
  mobilityWeeklyTarget: number;
  mobilityStreak: number;
  // Stress
  stressLoad: StressLoadLevel;
  stressLoadLabel: string;
  stressLoadColor: string;
  stressIncreasing: string[];
  stressReducing: string[];
  // Debt
  debt: RecoveryDebt;
  // Intelligence
  helping: RecoveryInsight[];
  hurting: RecoveryInsight[];
  opportunity: RecoveryInsight | null;
  // Action
  nextAction: RecoveryAction;
};

function classifyReserve(score: number, hasData: boolean): RecoveryClass {
  if (!hasData) return "data-limited";
  if (score >= 90) return "optimal";
  if (score >= 78) return "strong";
  if (score >= 62) return "stable";
  if (score >= 45) return "watch";
  return "recovery-limited";
}

function classifyStress(level: number, hasData: boolean): StressLoadLevel {
  if (!hasData) return "data-limited";
  if (level <= 1.8) return "low";
  if (level <= 2.8) return "moderate";
  if (level <= 3.6) return "elevated";
  return "high";
}

/** Today in the member's own time zone. */
function todayISO(now: Date = new Date()): string {
  return localDateKey(now);
}

export function buildRecoverySnapshot(state: RecoveryCommandState, now: Date = new Date()): RecoverySnapshot {
  /* Each input counts only when the member has logged it. A missing input is
     left out of the reserve, never scored as 0% — and never given a neutral
     stand-in value. */
  const logged: Record<RecoveryInputKind, boolean> = {
    sleep: state.sleepLogs.length > 0,
    water: state.hydrationLogs.length > 0,
    mobility: state.mobilityLogs.length > 0,
    "check-in": state.stressCheckIns.length > 0,
  };
  const inputKinds = Object.keys(logged) as RecoveryInputKind[];
  const inputsLogged = inputKinds.filter((kind) => logged[kind]);
  const inputsMissing = inputKinds.filter((kind) => !logged[kind]);
  const hasLogs = inputsLogged.length > 0;
  const hasData = inputsLogged.length >= RESERVE_MIN_INPUTS;
  const evidence: RecoverySnapshot["evidence"] = !hasLogs ? "none" : hasData ? "sufficient" : "limited";

  const today = todayISO(now);
  const allDays = [...loggedDays(state)].sort();
  const daysLogged = allDays.length;
  const calibrating = hasData && daysLogged < RESERVE_CALIBRATION_DAYS;

  /* Sleep */
  const sleep7 = lastN(state.sleepLogs, 7);
  const sleepAvg7 = avg(sleep7.map((s) => s.hours));
  const sleepLastNight = sleep7.length ? sleep7[sleep7.length - 1].hours : null;
  const sleepStdHigh = sleep7.length >= 3 && Math.max(...sleep7.map((s) => s.hours)) - Math.min(...sleep7.map((s) => s.hours)) > 1.6;
  const sleepConsistency: RecoverySnapshot["sleepConsistency"] = sleep7.length < 3 ? "data-limited" : sleepStdHigh ? "variable" : "strong";
  const sleepAdherence = state.sleepTargetHours > 0 ? clamp((sleepAvg7 / state.sleepTargetHours) * 100) : 0;
  const sleepImpact: RecoverySnapshot["sleepImpact"] = sleep7.length < 3 ? "neutral" : sleepAdherence >= 92 ? "supporting" : sleepAdherence < 80 ? "limiting" : "neutral";

  /* Hydration — water is logged a glass at a time, so it is read per DAY: the
     day's glasses summed, never each glass judged against the whole target.
     A finished day is read against the target; today, still under way, is
     read against how much of the day has gone. */
  const target = state.hydrationTargetOz;
  const pace = hydrationPace(now);
  const ozByDay = new Map<string, number>();
  for (const h of state.hydrationLogs) ozByDay.set(h.date, (ozByDay.get(h.date) ?? 0) + h.oz);
  const todayHydration = ozByDay.get(today) ?? 0;
  const hydDays = [...ozByDay.keys()].filter((d) => d <= today).sort().slice(-7);
  const dayShare = (day: string) => {
    const oz = ozByDay.get(day) ?? 0;
    return day === today ? Math.min(1, oz / (target * pace)) : Math.min(1, oz / target);
  };
  const hydrationAdherence = target > 0 && hydDays.length ? clamp(avg(hydDays.map(dayShare)) * 100) : 0;
  const hydrationStatus: RecoverySnapshot["hydrationStatus"] = hydDays.length === 0 ? "data-limited"
    : todayHydration >= target * 0.85 * pace ? "on-target" : "behind-pace";

  /* Mobility — the weekly target counts only the days the member has been
     keeping a record, so day one of logging is not judged as a whole week missed. */
  const weekStartISO = shiftDay(today, -6);
  const mobilityWeek = state.mobilityLogs.filter((m) => m.date >= weekStartISO && m.date <= today);
  const mobilityThisWeek = mobilityWeek.length;
  const firstDay = allDays[0] ?? today;
  const daysTracked = Math.min(7, Math.max(1, daysBetween(firstDay, today) + 1));
  const mobilityTargetSoFar = Math.max(1, Math.ceil((state.mobilityWeeklyTarget * daysTracked) / 7));
  // streak: consecutive days back from today with a mobility log
  let mobilityStreak = 0;
  for (let i = 0; i < 14; i += 1) {
    const d = new Date(now); d.setDate(d.getDate() - i);
    const iso = localDateKey(d);
    if (state.mobilityLogs.some((m) => m.date === iso)) mobilityStreak += 1;
    else if (i > 0) break;
  }
  const mobilityAdherence = state.mobilityWeeklyTarget > 0 ? clamp((mobilityThisWeek / mobilityTargetSoFar) * 100) : 0;

  /* Stress */
  const stress7 = lastN(state.stressCheckIns, 7);
  const stressAvg = avg(stress7.map((s) => s.stress));
  const stressLoad = classifyStress(stressAvg, stress7.length > 0);
  const stressScore = stress7.length ? clamp(100 - (stressAvg - 1) * 22) : null;

  /* Recovery Reserve — weighted behavioral composite over the logged inputs
     only, re-weighted so the weights of what was logged sum to 1. */
  const parts: Array<{ weight: number; value: number | null }> = [
    { weight: RESERVE_WEIGHTS.sleep, value: logged.sleep ? sleepAdherence : null },
    { weight: RESERVE_WEIGHTS.water, value: logged.water ? hydrationAdherence : null },
    { weight: RESERVE_WEIGHTS.mobility, value: logged.mobility ? mobilityAdherence : null },
    { weight: RESERVE_WEIGHTS["check-in"], value: stressScore },
  ];
  const counted = parts.filter((part): part is { weight: number; value: number } => part.value !== null);
  const countedWeight = counted.reduce((sum, part) => sum + part.weight, 0);
  const reserveRaw = countedWeight > 0 ? counted.reduce((sum, part) => sum + part.weight * part.value, 0) / countedWeight : 0;
  const reserve = hasData ? Math.round(clamp(reserveRaw)) : 0;
  const reserveClass = classifyReserve(reserve, hasData);
  /* A short record reads as an early read: the number stands, the verdict colour waits. */
  const reserveMeta = calibrating ? EARLY_READ : RECOVERY_CLASS_META[reserveClass];

  /* Momentum — compare first vs second half of the sleep+hydration window */
  let momentum: MomentumState = "data-limited";
  if (sleep7.length >= 4) {
    const half = Math.floor(sleep7.length / 2);
    const early = avg(sleep7.slice(0, half).map((s) => s.hours));
    const late = avg(sleep7.slice(half).map((s) => s.hours));
    momentum = late - early > 0.25 ? "improving" : late - early < -0.25 ? "slipping" : "stable";
  }

  /* Recovery Debt */
  /* Unlogged inputs carry no debt: null means "not logged", never "zero". */
  const sleepDebtHours = logged.sleep ? Number(sleep7.reduce((s, l) => s + (l.hours - state.sleepTargetHours), 0).toFixed(1)) : null;
  /* Missed means a finished day that fell short — today is still under way. */
  const hydrationMissed = hydDays.filter((d) => d !== today && (ozByDay.get(d) ?? 0) < target * 0.85).length;
  const mobilityMissed = logged.mobility ? Math.max(0, mobilityTargetSoFar - mobilityThisWeek) : null;
  const trainingFatigue: RecoveryDebt["trainingFatigue"] = !hasData || calibrating ? "unknown" : reserve < 55 ? "high" : reserve < 72 ? "elevated" : "low";
  const sleepShort = (hours: number) => sleepDebtHours !== null && sleepDebtHours < hours;
  const mobilityShort = (sessions: number) => mobilityMissed !== null && mobilityMissed >= sessions;
  const debtPoints = (sleepShort(-2) ? 1 : 0) + (hydrationMissed >= 2 ? 1 : 0) + (mobilityShort(2) ? 1 : 0) + (stressLoad === "elevated" || stressLoad === "high" ? 1 : 0);
  const overall: RecoveryDebt["overall"] = debtPoints >= 3 ? "accumulating" : debtPoints >= 1 ? "building" : "clear";
  const debt: RecoveryDebt = { sleepDebtHours, hydrationMissed, mobilityMissed, stressDebt: stressLoad, trainingFatigue, overall };

  /* Stress drivers */
  const stressIncreasing: string[] = [];
  const stressReducing: string[] = [];
  if (sleepShort(-1.5)) stressIncreasing.push("Sleep below target");
  if (hydrationMissed >= 2) stressIncreasing.push("Hydration gaps");
  if (mobilityShort(2)) stressIncreasing.push("Missed mobility");
  if (trainingFatigue === "elevated" || trainingFatigue === "high") stressIncreasing.push("Training load elevated");
  if (sleepConsistency === "strong") stressReducing.push("Consistent sleep window");
  if (hydrationStatus === "on-target") stressReducing.push("Hydration on target");
  if (mobilityThisWeek >= 3) stressReducing.push("Mobility adherence");
  if (stressReducing.length === 0) stressReducing.push("Log a downshift to build this");

  /* Intelligence */
  const helping: RecoveryInsight[] = [];
  if (sleepConsistency === "strong") helping.push({ id: "h-sleep", label: "Consistent sleep", detail: `Sleep is holding near your ${state.sleepTargetHours}h target.`, source: "Sleep Command" });
  if (hydrationAdherence >= 80) helping.push({ id: "h-hyd", label: "Hydration adherence", detail: "Hydration is tracking well across the week.", source: "Hydration Command" });
  if (mobilityThisWeek >= 3) helping.push({ id: "h-mob", label: "Mobility adherence", detail: `${mobilityThisWeek} mobility sessions logged this week.`, source: "Mobility Command" });
  if (stressLoad === "low" || stressLoad === "moderate") helping.push({ id: "h-stress", label: "Stress load controlled", detail: "Stress check-ins are in a manageable range.", source: "Stress Load" });

  const hurting: RecoveryInsight[] = [];
  if (sleepDebtHours !== null && sleepDebtHours < -1.5) hurting.push({ id: "x-sleep", label: "Sleep debt building", detail: `About ${Math.abs(sleepDebtHours)}h short of target across the week.`, source: "Sleep Command" });
  if (hydrationMissed >= 2) hurting.push({ id: "x-hyd", label: "Hydration missed", detail: `${hydrationMissed} days below your hydration target.`, source: "Hydration Command" });
  if (mobilityMissed !== null && mobilityMissed >= 2) hurting.push({ id: "x-mob", label: "Mobility skipped", detail: `${mobilityMissed} sessions short of your weekly target.`, source: "Mobility Command" });
  if (stressLoad === "elevated" || stressLoad === "high") hurting.push({ id: "x-stress", label: "Stress load elevated", detail: "Recent check-ins point to a higher stress load.", source: "Stress Load" });

  /* Opportunity + Next best action — biggest single bottleneck */
  let opportunity: RecoveryInsight | null = null;
  let nextAction: RecoveryAction;
  if (!hasLogs) {
    nextAction = { id: "first-checkin", label: "Complete Recovery Check-In", reason: "Log sleep, hydration, and stress to activate Recovery Reserve.", tone: "primary" };
  } else if (sleepShort(-2)) {
    opportunity = { id: "op-sleep", label: "Protect sleep window", detail: "Sleep is the largest recovery lever right now.", source: "Sleep Command" };
    nextAction = { id: "protect-sleep", label: "Protect Sleep Window", reason: "Sleep debt is the biggest limiter on your reserve.", tone: "primary" };
  } else if (hydrationStatus === "behind-pace") {
    opportunity = { id: "op-hyd", label: "Complete hydration target", detail: `${Math.max(0, state.hydrationTargetOz - todayHydration)} oz left today.`, source: "Hydration Command" };
    nextAction = { id: "finish-hydration", label: "Finish Hydration Target", reason: `You're ${Math.max(0, state.hydrationTargetOz - todayHydration)} oz behind pace today.`, tone: "primary" };
  } else if (mobilityShort(2)) {
    opportunity = { id: "op-mob", label: "Complete mobility reset", detail: "A short reset closes the weekly mobility gap.", source: "Mobility Command" };
    /* The button logs a finished reset, so the title never says "start". */
    nextAction = { id: "mobility-reset", label: "Close the Mobility Gap", reason: "Mobility sessions are behind your weekly target. Log a reset once it is done.", tone: "primary" };
  } else if (stressLoad === "elevated" || stressLoad === "high") {
    opportunity = { id: "op-stress", label: "Downshift the nervous system", detail: "A walk or breathwork lowers today's stress load.", source: "Stress Load" };
    nextAction = { id: "downshift", label: "Take a 20-Minute Walk", reason: "Stress load is elevated — a downshift helps recovery.", tone: "primary" };
  } else if (!hasData) {
    /* One kind of log is not a reserve. Say so, and name what reads it. */
    nextAction = {
      id: "hold",
      label: "Add One More Kind of Log",
      reason: `Recovery Reserve reads at least ${RESERVE_MIN_INPUTS} of sleep, water, mobility and check-ins. Logged so far: ${inputsLogged.join(", ")}.`,
      tone: "primary",
    };
  } else {
    opportunity = { id: "op-hold", label: "Hold the standard", detail: "Recovery inputs are in a good place — keep the streak.", source: "Recovery Reserve" };
    nextAction = { id: "hold", label: "Complete Recovery Check-In", reason: "Reserve is strong. Log today to keep momentum.", tone: "complete" };
  }

  return {
    hasData,
    hasLogs,
    evidence,
    daysLogged,
    calibrating,
    inputsLogged,
    inputsMissing,
    reserve,
    reserveClass,
    reserveColor: reserveMeta.color,
    reserveLabel: reserveMeta.label,
    momentum,
    sleepLastNight,
    sleepAvg7: Number(sleepAvg7.toFixed(1)),
    sleepConsistency,
    sleepImpact,
    hydrationTodayOz: todayHydration,
    hydrationTargetOz: state.hydrationTargetOz,
    hydrationAdherence: Math.round(hydrationAdherence),
    hydrationStatus,
    mobilityThisWeek,
    mobilityWeeklyTarget: state.mobilityWeeklyTarget,
    mobilityStreak,
    stressLoad,
    stressLoadLabel: STRESS_LOAD_META[stressLoad].label,
    stressLoadColor: STRESS_LOAD_META[stressLoad].color,
    stressIncreasing,
    stressReducing,
    debt,
    helping,
    hurting,
    opportunity,
    nextAction,
  };
}

/* ─── Recovery Suite V2 — classify tools by context ─────────────────────── */

export function buildRecoverySuite(
  snapshot: RecoverySnapshot,
  state: RecoveryCommandState,
  now: Date = new Date(),
): RecoverySuiteTool[] {
  const hour = now.getHours();
  const evening = hour >= 18 || hour < 5;
  const completed = (id: string) => state.suiteDate === todayISO(now) && state.suiteCompletedToday.includes(id);
  const lowReserve = snapshot.hasData && snapshot.reserve < 62;
  const mobilityBehind = snapshot.debt.mobilityMissed !== null && snapshot.debt.mobilityMissed >= 1;
  const sleepDebtBuilding = snapshot.debt.sleepDebtHours !== null && snapshot.debt.sleepDebtHours < -1.5;

  const tools: Array<Omit<RecoverySuiteTool, "completed">> = [
    {
      id: "mobility-reset",
      name: "Mobility Reset",
      durationLabel: "8–12 min",
      recommendation: mobilityBehind ? "recommended" : "optional",
      reason: mobilityBehind ? "Behind on weekly mobility — a reset closes the gap." : "Gentle joint flow if you have time.",
    },
    {
      id: "walking",
      name: "Walking",
      durationLabel: "15–25 min",
      recommendation: snapshot.stressLoad === "elevated" || snapshot.stressLoad === "high" ? "recommended" : "optional",
      reason: snapshot.stressLoad === "elevated" || snapshot.stressLoad === "high" ? "A walk lowers today's stress load." : "Easy steps support recovery.",
    },
    {
      id: "breathwork",
      name: "Breathwork",
      durationLabel: "5–8 min",
      recommendation: evening && lowReserve ? "recommended" : "optional",
      reason: evening ? "Evening downshift before sleep." : "Quick nervous-system downshift.",
    },
    {
      id: "sauna",
      name: "Sauna",
      durationLabel: "15–20 min",
      recommendation: snapshot.hydrationStatus === "behind-pace" ? "not-needed" : lowReserve ? "optional" : "optional",
      reason: snapshot.hydrationStatus === "behind-pace" ? "Hydrate first — skip heat while behind on fluids." : "Optional heat block if hydrated.",
    },
    {
      id: "stretching",
      name: "Stretching",
      durationLabel: "8–10 min",
      recommendation: "optional",
      reason: "Light static work — keep it gentle after heavy lifting.",
    },
    {
      id: "hydration",
      name: "Hydration",
      durationLabel: "now",
      recommendation: snapshot.hydrationStatus === "behind-pace" ? "recommended" : "optional",
      reason: snapshot.hydrationStatus === "behind-pace" ? `${Math.max(0, snapshot.hydrationTargetOz - snapshot.hydrationTodayOz)} oz left today.` : "Top up fluids steadily.",
    },
    {
      id: "recovery-nutrition",
      name: "Recovery Nutrition",
      durationLabel: "post-session",
      recommendation: "optional",
      reason: "Protein anchor + carbs in the recovery window.",
    },
    {
      id: "sleep-protection",
      name: "Sleep Protection",
      durationLabel: "tonight",
      recommendation: evening || sleepDebtBuilding ? "recommended" : "optional",
      reason: sleepDebtBuilding ? "Sleep debt is building — protect tonight's window." : "Honor your wind-down and sleep window.",
    },
  ];

  return tools.map((t) => ({ ...t, completed: completed(t.id) }));
}

/* ─── Timeline rows ─────────────────────────────────────────────────────── */

export function buildRecoveryTimeline(state: RecoveryCommandState, snapshot: RecoverySnapshot): RecoveryTimelineRow[] {
  return [
    {
      label: "Today",
      sleep: snapshot.sleepLastNight !== null ? `${snapshot.sleepLastNight}h` : "—",
      hydration: snapshot.hydrationTodayOz > 0 ? `${snapshot.hydrationTodayOz} oz` : "—",
      mobility: state.mobilityLogs.some((m) => m.date === localDateKey()) ? "Logged" : "—",
      stress: snapshot.stressLoadLabel,
      recovery: snapshot.hasData ? `${snapshot.reserve}` : "—",
    },
    {
      label: "This Week",
      sleep: snapshot.sleepLastNight !== null ? `${snapshot.sleepAvg7}h avg` : "—",
      hydration: snapshot.hydrationStatus !== "data-limited" ? `${snapshot.hydrationAdherence}% adherence` : "—",
      mobility: `${snapshot.mobilityThisWeek} / ${snapshot.mobilityWeeklyTarget}`,
      stress: snapshot.stressLoadLabel,
      recovery: snapshot.hasData ? `${snapshot.reserve}` : "—",
    },
    {
      label: "Momentum",
      sleep: snapshot.sleepConsistency === "strong" ? "Strong" : snapshot.sleepConsistency === "variable" ? "Variable" : "—",
      hydration: snapshot.hydrationStatus === "on-target" ? "On Target" : snapshot.hydrationStatus === "behind-pace" ? "Behind" : "—",
      mobility: snapshot.mobilityStreak > 0 ? `${snapshot.mobilityStreak}-day streak` : "—",
      stress: snapshot.stressLoadLabel,
      recovery: snapshot.momentum === "improving" ? "Improving" : snapshot.momentum === "slipping" ? "Slipping" : snapshot.momentum === "stable" ? "Stable" : "—",
    },
  ];
}
