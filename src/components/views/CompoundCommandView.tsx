"use client";

import { dailyAmountLabel, timesPerDay } from "@/lib/enhancement/dose-amount";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Calculator,
  CalendarClock,
  CheckCircle2,
  Clock,
  ChevronDown,
  ClipboardPaste,
  Link2,
  Pause,
  Pencil,
  Pill,
  Play,
  Plus,
  Search,
  Syringe,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useCan, useSafetyToolsVisible } from "@/components/authz/CapabilitiesProvider";
import { CycleBriefPanel } from "@/components/cycle/CycleBriefPanel";
import { DayTimeline, type DayTimelineSlot } from "@/components/cycle/DayTimeline";
import { FieldManualPanel } from "@/components/cycle/FieldManualPanel";
import { PeakModeLauncher } from "@/components/cycle/PeakMode";
import { ScheduleChecks } from "@/components/enhancement/ScheduleChecks";
import { OWNER_MODE_LABEL } from "@/components/authz/OwnerResearchMode";
import { CycleCommandTab } from "@/components/cycle/CycleCommandTab";
import { MemberSupportPlan } from "@/components/cycle-review/MemberSupportPlan";
import { ResearchTab } from "@/components/research/ResearchTab";
import { useClientNow } from "@/components/safety/useClientNow";
import { TimelineTab } from "@/components/timeline/TimelineTab";
import { CommandPanel, Facts, GroupLabel, PlaceNote, ReviewLine, Row, RowList, StatusWord } from "@/components/enhancement/command/CommandRows";
import {
  AddOnGrid,
  HeroCompounds,
  TierChoice,
  TodaySlotSheet,
  type RailItem,
} from "@/components/enhancement/command/TodayDay";
import { useCompoundToday, type TodayRead } from "@/components/enhancement/command/useCompoundToday";
import { clearCompoundEntryRequest, peekCompoundEntryRequest } from "@/lib/compound-command/open-request";
import { formatPlannedExecution } from "@/lib/compound-command/planned-execution";

import { ViewShell } from "./ViewShell";
import { RecordHero } from "./records/RecordHero";
import { DiscardChangesBar, useFormCloseGuard } from "@/components/ui/reserve/FormCloseGuard";
import {
  CompoundAmountSource,
  CompoundInjectionType,
  CompoundRoute,
  CompoundScheduleRule,
  CompoundDoseTiming,
  CompoundScheduleRuleType,
  CompoundSourceType,
  CompoundSupportRelationshipType,
  EnhancementCategory,
  EnhancementDoseSource,
  EnhancementEntry,
  EnhancementFrequencyType,
  EnhancementTimeOfDayPreference,
  InjectionLogRecord,
  useAthleteDashboardStore,
} from "@/lib/athlete-store";
import {
  COMMAND_COPY,
  KEPT_PLACE_NAMES,
  TOOL_LINES,
  TOOL_ORDER,
  compoundPrimaryAction,
  compoundReadouts,
  compoundStatement,
  compoundSupport,
  countsLine,
  opensDoseMath,
  planLine,
  planViewFor,
  primaryTabFor,
  primaryTabs,
  resolvePlace,
  type CommandSlot,
  type CompoundPrimaryTab,
  type CompoundTabKey,
  type CompoundToolKey,
  type PlanView,
  type SupportArrival,
} from "@/lib/compound-command/command-room";
import { LogAddOnsSheet } from "@/components/enhancement/command/LogAddOnsSheet";
import { GiveItATimeSheet } from "@/components/enhancement/command/GiveItATimeSheet";
import { MissedDaySheet } from "@/components/enhancement/command/MissedDaySheet";
import { backdateChoices, missedDay } from "@/lib/compound-command/missed-day";
import { offPlanLine, offPlanToday } from "@/lib/compound-command/off-plan";
import { emptyTodayRead } from "@/lib/compound-command/today-empty";
import { TIER_COPY, todayTierFor, type TodayTier } from "@/lib/compound-command/today-tiers";
import { localDateKey } from "@/lib/dates/local-day";
import { RESERVE } from "@/lib/design/tokens";
import {
  COMPOUND_CATALOG,
  classKeyFromCategory,
  classLabelFor,
} from "@/lib/enhancement/catalog";
import { buildCompoundScheduleLedger, CompoundLedgerStatus, CompoundScheduleLedgerEvent } from "@/lib/enhancement/ledger";
import { parseCompoundIntakeText } from "@/lib/enhancement/intake-parser";
import {
  computeInventory,
  formatDateShort,
  inventoryStatusLabel,
} from "@/lib/enhancement/inventory";
import { vialIdentity, categoryDrawsVial } from "@/lib/enhancement/vial-identity";
import { CompoundVial } from "@/components/enhancement/CompoundVial";
import {
  computeEntryScheduleState,
  getEnhancementDailySchedule,
  resolveScheduleRuleForDate,
  todayDateString,
  weekdayShort,
} from "@/lib/enhancement/schedule";
import { useDoseAnchors } from "@/lib/enhancement/useDoseAnchors";
import { DOSE_TIMING_COPY, DoseTimingEditor } from "@/components/enhancement/command/DoseTimingEditor";
import {
  CALCULATION_ONLY_COPY,
  computeReconstitution,
  reconstitutionInputFromEntry,
} from "@/lib/enhancement/reconstitution";
import {
  getCriticalReviewFlags,
  getLastAdherenceTouch,
  getOptionalReviewNotes,
  getStackStatus,
} from "@/lib/enhancement/status";
import { ReserveBottomSheet, ReserveButton, ReserveDisclosure, ReserveIconButton, ReserveSegmented, ReserveSelect, useReserveSheetClose } from "@/components/ui/reserve";
import { markCompoundLogged } from "@/components/ui/reserve/log-moment/recorders";
import { DoseMathWizard } from "@/components/enhancement/DoseMathWizard";
import type { DoseMathInput, DoseMathResult } from "@/lib/enhancement/dose-math";

/* ────────────────────────────────────────────────────────────────────────────
   TOKENS
   ──────────────────────────────────────────────────────────────────────── */

const ACCENT = "#a78bfa";
const STEEL = "#7dd3ee";
const GOLD = "#d5b15f";
const GREEN = "#79e3b5";
const AMBER = "#e8c87a";
const RED = "#ef7d55";

const SAFETY_LINE =
  "Reserve organizes user-defined reminders around your schedule. It does not prescribe, recommend, approve, or adjust dosing. Ready means schedule-ready, not medical approval.";

/* ─── Dose Math — a sheet opened from Plan, not a place of its own ─────── */
function DoseMathBody() {
  return (
    <div className="flex flex-col gap-4" data-compound="dose-math">
      <p className="max-w-[560px] text-[12px] leading-[1.55] text-white/55">
        Converts between syringe units, mg/mcg, mL and tablet totals from the numbers you entered. Math only.
      </p>
      <DoseMathWizard />
    </div>
  );
}

const FREQUENCY_OPTIONS: Array<{ value: EnhancementFrequencyType; label: string; sub: string }> = [
  { value: "daily", label: "Daily", sub: "Every day" },
  { value: "weekly", label: "Weekly", sub: "Specific day(s)" },
  { value: "specific_days", label: "Specific Days", sub: "Choose weekdays" },
  { value: "training_only", label: "Training Days Only", sub: "Mon · Tue · Thu · Fri" },
  { value: "rest_only", label: "Rest Days Only", sub: "Wed · Sat · Sun" },
  { value: "custom", label: "Custom", sub: "You log manually" },
];

const TIME_OF_DAY_OPTIONS: Array<{ value: EnhancementTimeOfDayPreference; label: string }> = [
  { value: "morning", label: "Morning" },
  { value: "pre_training", label: "Pre-Training" },
  { value: "post_training", label: "Post-Training" },
  { value: "evening", label: "Evening" },
  { value: "bedtime", label: "Bedtime" },
  { value: "custom", label: "Custom" },
  { value: "unspecified", label: "Unspecified" },
];

const SOURCE_TYPE_OPTIONS: Array<{ value: CompoundSourceType; label: string }> = [
  { value: "member_entered", label: "Member-entered" },
  { value: "provider_entered", label: "Provider-entered" },
  { value: "prescription", label: "Prescription" },
  { value: "clinic", label: "Clinic" },
  { value: "other", label: "Other" },
];

const SOURCE_OF_DOSE_OPTIONS: Array<{ value: EnhancementDoseSource; label: string }> = [
  { value: "provider_directed", label: "Provider-directed" },
  { value: "member_entered", label: "Member-entered" },
  { value: "label_directed", label: "Label-directed" },
  { value: "unknown", label: "Unknown" },
];

const ROUTE_OPTIONS: Array<{ value: CompoundRoute; label: string }> = [
  { value: "oral", label: "Oral" },
  { value: "injectable", label: "Injectable" },
  { value: "topical", label: "Topical" },
  { value: "nasal", label: "Nasal" },
  { value: "other", label: "Other" },
];

const INJECTION_TYPE_OPTIONS: Array<{ value: CompoundInjectionType; label: string }> = [
  { value: "subq", label: "SubQ" },
  { value: "im", label: "IM" },
  { value: "other", label: "Other" },
  { value: "none", label: "None" },
];

const INJECTION_SITES = [
  "Right abdomen",
  "Left abdomen",
  "Right thigh",
  "Left thigh",
  "Right glute",
  "Left glute",
  "Right delt",
  "Left delt",
  "Right tricep",
  "Left tricep",
];

const STORAGE_OPTIONS = ["Refrigerated", "Room temperature", "Protected from light", "Travel case", "Clinic stored", "Other"];
const SCHEDULE_RULE_OPTIONS: Array<{ value: CompoundScheduleRuleType; label: string; sub: string }> = [
  { value: "daily", label: "Daily", sub: "Every calendar day" },
  { value: "specific_weekdays", label: "Specific weekdays", sub: "Pick calendar days" },
  { value: "every_x_days", label: "Every X days", sub: "Interval from an anchor date" },
  { value: "every_x_weeks", label: "Every X weeks", sub: "Weekly interval from an anchor date" },
  { value: "training_days_only", label: "Training days only", sub: "Member training days" },
  { value: "rest_days_only", label: "Rest days only", sub: "Non-training days" },
  { value: "all_training_days", label: "All training days", sub: "Matches saved plan" },
  { value: "all_6_training_days", label: "All 6 training days", sub: "Mon through Sat" },
  { value: "upper_body_days", label: "Upper body days", sub: "Upper split tags" },
  { value: "lower_body_days", label: "Lower body days", sub: "Lower split tags" },
  { value: "push_days", label: "Push days", sub: "Push split tags" },
  { value: "pull_days", label: "Pull days", sub: "Pull split tags" },
  { value: "leg_days", label: "Leg days", sub: "Leg split tags" },
  { value: "chest_back_days", label: "Chest/back days", sub: "Chest + back tags" },
  { value: "arm_shoulder_days", label: "Arm/shoulder days", sub: "Arms + shoulders tags" },
  { value: "conditioning_days", label: "Conditioning days", sub: "Conditioning tag" },
  { value: "custom_training_tags", label: "Custom training tags", sub: "Review if no match" },
  { value: "custom_date_sequence", label: "Custom date sequence", sub: "Exact dates" },
  { value: "on_off_cycle", label: "Days on / days off", sub: "Repeats from the anchor date" },
  { value: "manual_only", label: "Manual only", sub: "No schedule" },
];

const SUPPORT_RELATIONSHIPS: CompoundSupportRelationshipType[] = [
  "Lab monitoring support",
  "Tolerance tracking",
  "Side-effect tracking",
  "Recovery support",
  "Sleep/recovery timing",
  "Hydration/electrolyte support",
  "Injection comfort tracking",
  "Inventory pairing",
  "Provider-entered support plan",
  "Member-entered note",
  "Other",
];

const SUPPORT_REASON_TAGS = [
  "Member goal tag",
  "Provider note",
  "Lab marker watch",
  "Symptom watch",
  "Timing coordination",
  "Recovery coordination",
  "Inventory coordination",
  "Adherence coordination",
  "Manual note",
];

const LAB_MARKERS = [
  "Estradiol",
  "Total Testosterone",
  "Free Testosterone",
  "SHBG",
  "Hematocrit",
  "Hemoglobin",
  "Lipids",
  "Liver enzymes",
  "Kidney markers",
  "Fasting glucose",
  "Insulin",
  "IGF-1",
  "Thyroid markers",
  "Blood pressure",
  "Other",
];

const SYMPTOM_WATCHES = [
  "Mood",
  "Sleep",
  "Appetite",
  "Digestion",
  "Water retention",
  "Skin",
  "Injection site reaction",
  "Libido",
  "Energy",
  "Training performance",
  "Recovery",
  "Other",
];

const PICKER_GROUP_LABELS: Partial<Record<string, string>> = {
  peptides_glp1: "GLP-1",
  peptides_dual_agonists: "Dual agonists",
  peptides_triple_agonists: "Triple agonists",
  growth_hormone: "Growth hormone",
  peptides_growth: "Growth / recovery peptides",
  peptides_healing: "Growth / recovery peptides",
  peptides_mitochondrial: "Mitochondrial peptides",
  cellular_nad: "NAD / cellular support",
  hormones_testosterone: "Hormones / Testosterone",
  hormones_other: "Hormones / Other",
  aas: "AAS",
  ancillaries: "Ancillaries / support",
  medications: "Medications",
  supplements: "Supplements",
  vitamins: "Vitamins",
  nootropics: "Nootropics",
  recovery: "Recovery",
  other: "Custom",
};


/* ────────────────────────────────────────────────────────────────────────────
   MAIN VIEW
   ──────────────────────────────────────────────────────────────────────── */

export function CompoundCommandView() {
  const [tab, setTabKey] = useState<CompoundTabKey>("today");
  const [supportArrival, setSupportArrival] = useState<SupportArrival | null>(null);
  const [planView, setPlanView] = useState<PlanView>("compounds");
  const [doseMathOpen, setDoseMathOpen] = useState(false);
  /* Another room (Apex's "Your compounds") may have asked for one entry's sheet or editor. */
  const [openRequest] = useState(peekCompoundEntryRequest);
  useEffect(() => clearCompoundEntryRequest(), []);
  const [sheetEntryId, setSheetEntryId] = useState<string | null>(openRequest?.mode === "details" ? openRequest.entryId : null);
  const [editingId, setEditingId] = useState<string | null>(openRequest?.mode === "edit" ? openRequest.entryId : null);
  const [creating, setCreating] = useState(openRequest?.mode === "edit");
  const [injectionLogFor, setInjectionLogFor] = useState<EnhancementEntry | null>(null);
  /* The dose a site log records: an entry with several dose times logs the one it was opened from. */
  const [injectionPlannedTime, setInjectionPlannedTime] = useState<string | undefined>(undefined);
  const openInjectionLog = useCallback((entry: EnhancementEntry, plannedTime?: string) => {
    setInjectionPlannedTime(plannedTime);
    setInjectionLogFor(entry);
  }, []);
  const [loggedFlash, setLoggedFlash] = useState<string | null>(null);
  /* The one of today's slots whose sheet is open (a hero instrument or a day-rail marker). */
  const [todaySlotId, setTodaySlotId] = useState<string | null>(null);
  const now = useClientNow();
  // Launch switch: Cycle & Safety awaits clinician and counsel review — hidden for members, open to the verified owner.
  const safetyToolsVisible = useSafetyToolsVisible();
  const ownerResearch = useCan("owner-research-tools");
  /* Every shipped tab key still opens its place; a hidden Cycle & Safety falls back to Today. */
  const place = resolvePlace(tab, safetyToolsVisible);
  /* A caller asking for Schedule lands on Plan's week; one asking for Dose Math lands on Plan with the converter open. */
  const setTab = useCallback((key: CompoundTabKey, arrival: SupportArrival | null = null) => {
    setPlanView(planViewFor(key));
    if (opensDoseMath(key)) setDoseMathOpen(true);
    /* Only a button that named a sheet asks for one; the tab strip clears it. */
    setSupportArrival(arrival);
    setTabKey(key);
  }, []);

  const logEnhancementAdherence = useAthleteDashboardStore((s) => s.logEnhancementAdherence);
  const updateEnhancementEntry = useAthleteDashboardStore((s) => s.updateEnhancementEntry);

  const openCreate = useCallback(() => { setEditingId(null); setCreating(true); }, []);
  const openEdit = useCallback((id: string) => { setSheetEntryId(null); setEditingId(id); setCreating(true); }, []);
  const closeEditor = useCallback(() => { setEditingId(null); setCreating(false); }, []);
  const closeSheet = useCallback(() => setSheetEntryId(null), []);
  const closeDoseMath = useCallback(() => setDoseMathOpen(false), []);
  const closeTodaySheet = useCallback(() => setTodaySlotId(null), []);
  const setTier = useCallback((id: string, todayTier: TodayTier) => updateEnhancementEntry(id, { todayTier }), [updateEnhancementEntry]);

  /* Today, read once through the shared hook — Apex's "Your compounds" row reads the same one,
     so a compound is never "due now" in one room and "next due" in another. */
  const { entries, schedulePlan, anchors, slots, read, primary, siteLoggedToday, heroItems, railItems, markSlot } = useCompoundToday(now);
  const adherence = useAthleteDashboardStore((s) => s.trainingSession.enhancementAdherence);

  const sheetEntry = sheetEntryId ? entries.find((entry) => entry.id === sheetEntryId) ?? null : null;

  /**
   * A dose the member took, recorded against the day they took it — for an entry
   * with nothing on that day's plan (paused, ended, manual, or due another day),
   * and for yesterday, when the app was in their pocket and the dose was not.
   * It writes the same adherence record the markers write, so it counts wherever
   * they count.
   */
  const [logAddOnsOpen, setLogAddOnsOpen] = useState(false);
  const [missedDayOpen, setMissedDayOpen] = useState(false);
  /* An add-on the member chose but never gave a time: the one question that puts it in their day. */
  const [timeEntryId, setTimeEntryId] = useState<string | null>(null);
  const closeGiveTime = useCallback(() => setTimeEntryId(null), []);
  const timeEntry = timeEntryId ? entries.find((entry) => entry.id === timeEntryId) ?? null : null;
  const closeMissedDay = useCallback(() => setMissedDayOpen(false), []);
  const [missedDayKey, setMissedDayKey] = useState<string | null>(null);
  /* Yesterday until the member picks another day. */
  const backdateDay = missedDayKey ?? backdateChoices(now ?? new Date())[0].date;
  /* That day's plan, rebuilt from the same schedule Today reads — its own training day, its own anchors. */
  const backdateSlots = useMemo(
    () =>
      getEnhancementDailySchedule({
        entries,
        adherence,
        date: backdateDay,
        isTrainingDay: [1, 2, 4, 5].includes(new Date(`${backdateDay}T00:00:00`).getDay()),
        wakeTime: schedulePlan.wakeTime,
        sleepTime: schedulePlan.sleepTime,
        preferredGymTime: schedulePlan.workoutTime,
        anchors,
      }),
    [entries, adherence, backdateDay, schedulePlan, anchors],
  );
  const backdate = useMemo(() => missedDay(backdateDay, backdateSlots, adherence), [backdateDay, backdateSlots, adherence]);
  const closeLogAddOns = useCallback(() => setLogAddOnsOpen(false), []);

  const logDose = useCallback(
    (entry: EnhancementEntry, dayOffset: 0 | 1) => {
      const when = new Date();
      when.setDate(when.getDate() - dayOffset);
      const at = dayOffset === 0 ? new Date().toTimeString().slice(0, 5) : "12:00";
      const name = (entry.displayName?.trim() || entry.name);
      /* An injectable is asked once. The site log records the dose itself, so
         marking it taken first would ask the same question twice — and would
         leave it marked taken if the member closed that sheet. */
      if (dayOffset === 0 && entry.route === "injectable") {
        openInjectionLog(entry, at);
        return;
      }
      logEnhancementAdherence({ entryId: entry.id, date: localDateKey(when), plannedTime: at, takenStatus: "taken", actualTime: at });
      markCompoundLogged();
      setLoggedFlash(dayOffset === 0 ? COMMAND_COPY.logged(name, when.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })) : `${name} logged for yesterday.`);
    },
    [logEnhancementAdherence, openInjectionLog],
  );

  /* The day on one track. It reads the same slots the hero and Today read, so a
     compound is never due in one place and upcoming in another. */
  const logSlot = useCallback(
    (slotId: string) => {
      const slot = slots.find((s) => s.id === slotId);
      if (!slot) return;
      const name = slot.entry.displayName?.trim() || slot.entry.name;
      logEnhancementAdherence({
        entryId: slot.entryId,
        date: localDateKey(),
        plannedTime: slot.plannedTime,
        takenStatus: "taken",
        actualTime: new Date().toTimeString().slice(0, 5),
      });
      markCompoundLogged();
      setLoggedFlash(COMMAND_COPY.logged(name, new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })));
    },
    [slots, logEnhancementAdherence],
  );
  /* The mark on a row logs the slot where it sits. An injectable opens its
     sheet instead — that is where the site is recorded, and the site log
     records the entry with it. */
  const logTodaySlot = useCallback(
    (slot: TodaySlot) => {
      /* Straight to the site log: it is the only thing still unanswered, and
         saving it records the dose. One tap, one question. */
      if (slot.entry.route === "injectable") {
        openInjectionLog(slot.entry, slot.plannedTime);
        return;
      }
      markSlot(slot, "taken");
      setLoggedFlash(
        COMMAND_COPY.logged(
          slot.entry.displayName?.trim() || slot.entry.name,
          new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
        ),
      );
    },
    [markSlot, openInjectionLog],
  );

  const timelineCompounds = useMemo<DayTimelineSlot[]>(
    () =>
      slots.map((slot) => {
        const status = getStackStatus(slot).status;
        return {
          id: slot.id,
          slotId: slot.id,
          label: slot.entry.displayName?.trim() || slot.entry.name,
          at: slot.plannedTime === "—" ? null : slot.plannedTime,
          state: status === "logged" ? ("done" as const) : status === "missed" ? ("missed" as const) : status === "due" ? ("due" as const) : ("ahead" as const),
          detail: slot.bucketLabel,
        };
      }),
    [slots],
  );
  /* The day's anchors, from the member's own schedule plan. */
  const windDownTime = useMemo(() => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(schedulePlan.sleepTime ?? "");
    if (!m) return undefined;
    const mins = (Number(m[1]) * 60 + Number(m[2]) - 60 + 1440) % 1440;
    return `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
  }, [schedulePlan.sleepTime]);
  const trainsToday = useMemo(() => [1, 2, 4, 5].includes(new Date().getDay()), []);
  const todaySlot = todaySlotId ? slots.find((slot) => slot.id === todaySlotId) ?? null : null;
  const openTodaySlot = useCallback((slot: TodaySlot) => setTodaySlotId(slot.id), []);

  return (
    <ViewShell
      label="Reserve Stack"
      title="Compound Command"
      icon={Pill}
      accentColor={RESERVE.steel}
      disclaimer={SAFETY_LINE}
      badge={ownerResearch ? OWNER_MODE_LABEL : undefined}
      roomHero
    >
      <CompoundHeroBody
        entries={entries}
        read={read}
        primary={primary}
        scheduledToday={slots.length}
        below={
          place === "today" ? (
            <HeroCompounds
              items={heroItems}
              empty={emptyTodayRead(entries, railItems.length)}
              onOpenSlot={openTodaySlot}
              onOpenEntry={setSheetEntryId}
              onOpenPlan={() => setTab("plan")}
              onAdd={openCreate}
              onLog={logTodaySlot}
            />
          ) : undefined
        }
        onAdd={openCreate}
        onOpenInjectionLog={openInjectionLog}
        onLog={(slot) => {
          logEnhancementAdherence({
            entryId: slot.entryId,
            date: localDateKey(),
            plannedTime: slot.plannedTime,
            takenStatus: "taken",
            actualTime: new Date().toTimeString().slice(0, 5),
          });
          markCompoundLogged();
          setLoggedFlash(COMMAND_COPY.logged(slot.name, new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })));
        }}
      />

      {loggedFlash && (
        <p role="status" className="-mt-2 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.16em]" style={{ color: GREEN }}>
          <CheckCircle2 size={12} aria-hidden="true" />
          {loggedFlash}
        </p>
      )}

      <CompoundNav place={place} safetyToolsVisible={safetyToolsVisible} onChange={setTab} />

      {/* PLACE CONTENT */}
      <AnimatePresence mode="wait">
        <motion.div
          key={place}
          role="tabpanel"
          aria-label={place === "more" ? COMMAND_COPY.toolsHeading : KEPT_PLACE_NAMES[place]}
          className="flex flex-col gap-4"
          /* No exit, on purpose. With mode="wait" AnimatePresence does not
             mount the incoming panel until the outgoing one has finished
             leaving — so a stalled exit does not just linger, it means the
             new tab never appears at all. Measured under CPU starvation:
             tapping a place left the panel blank. */
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* The Cycle Brief leads Today: review-pending safety content, behind the launch switch and the safety acknowledgement.
              The Field Manual sits with it in its own compact mode — cited general reading, one line until asked for, so it never
              puts six thousand characters of nutrition guidance above the member's own schedule. */}
          {place === "today" && safetyToolsVisible && (
            <div data-compound="cycle-brief" className="flex flex-col gap-4">
              <CycleBriefPanel onOpen={setTab} />
              <FieldManualPanel onOpen={setTab} compact />
            </div>
          )}
          {/* The day on one track, under the brief and above the lists it summarises. */}
          {place === "today" && (
            <DayTimeline
              compounds={timelineCompounds}
              meals={[]}
              training={trainsToday && schedulePlan.workoutTime ? { label: "Training", at: schedulePlan.workoutTime } : null}
              wakeTime={schedulePlan.wakeTime}
              windDownTime={windDownTime}
              sleepTime={schedulePlan.sleepTime}
              onLog={logSlot}
            />
          )}
          {/* Peak Mode: the whole day for the look the member picks. The diet follows the look, never the compounds. */}
          {place === "today" && <PeakModeLauncher />}
          {place === "today" && (
            <TodayTab slots={slots} railItems={railItems} onOpenSlot={openTodaySlot} onOpenEditor={openEdit} onLog={logTodaySlot} />
          )}
          {place === "today" && railItems.some((item) => item.state !== "logged" && item.state !== "skipped") && (
            <div>
              <ReserveButton tier="secondary" size="sm" accent={GREEN} icon={CheckCircle2} onClick={() => setLogAddOnsOpen(true)}>
                Log add-ons
              </ReserveButton>
            </div>
          )}
          {place === "today" && (
            <div>
              <ReserveButton tier="quiet" size="sm" icon={CalendarClock} onClick={() => setMissedDayOpen(true)}>
                Log a missed day
              </ReserveButton>
            </div>
          )}
          {place === "today" && <OffPlanToday entries={entries} slots={slots} onOpen={setSheetEntryId} onGiveTime={setTimeEntryId} />}
          {place === "plan" && (
            <PlanTab
              slots={slots}
              view={planView}
              onViewChange={setPlanView}
              onCreate={openCreate}
              onOpenSheet={setSheetEntryId}
              onOpenEditor={openEdit}
              onOpenInjectionLog={openInjectionLog}
              onOpenDoseMath={() => setDoseMathOpen(true)}
            />
          )}
          {place === "more" && <ToolsIndex onOpen={setTab} />}
          {primaryTabFor(place) === "more" && place !== "more" && (
            <div>
              <ReserveButton tier="quiet" size="sm" icon={ArrowLeft} onClick={() => setTab("more")}>
                {COMMAND_COPY.allTools}
              </ReserveButton>
            </div>
          )}
          {place === "timeline" && <TimelineTab />}
          {place === "research" && <ResearchTab />}
          {safetyToolsVisible && place === "cycle" && <CycleCommandTab />}
          {place === "support" && <SupportStackTab arrival={supportArrival} />}
          {place === "labs" && <LabsReviewTab onEdit={openEdit} />}
          {place === "education" && <EducationTab />}
        </motion.div>
      </AnimatePresence>

      {/* ONE OF TODAY'S ENTRIES: log, skip, site log, edit, and where it shows on Today */}
      <TodaySlotSheet
        slot={todaySlot}
        state={todaySlot ? read.states.get(todaySlot.id) ?? "upcoming" : null}
        classLabel={todaySlot ? classLabelFor(todaySlot.entry.compoundClass) : null}
        planned={todaySlot ? formatPlannedExecution(todaySlot.entry) : null}
        siteLoggedToday={todaySlot ? siteLoggedToday(todaySlot.entryId) : false}
        tier={todaySlot ? todayTierFor(todaySlot.entry) : "add-on"}
        onClose={closeTodaySheet}
        onMark={(status) => { if (todaySlot) markSlot(todaySlot, status); setTodaySlotId(null); }}
        onSiteLog={() => { if (todaySlot) openInjectionLog(todaySlot.entry, todaySlot.plannedTime); setTodaySlotId(null); }}
        onEdit={() => { if (todaySlot) openEdit(todaySlot.entryId); setTodaySlotId(null); }}
        onDetails={() => { if (todaySlot) setSheetEntryId(todaySlot.entryId); setTodaySlotId(null); }}
        onGiveTime={() => { if (todaySlot) setTimeEntryId(todaySlot.entryId); setTodaySlotId(null); }}
        onTier={(tier) => { if (todaySlot) setTier(todaySlot.entryId, tier); }}
      />

      {/* ONE COMPOUND, EVERYTHING ABOUT IT */}
      <GiveItATimeSheet
        open={Boolean(timeEntry)}
        name={timeEntry ? timeEntry.displayName?.trim() || timeEntry.name : null}
        onClose={closeGiveTime}
        onSave={(patch) => {
          if (!timeEntry) return;
          updateEnhancementEntry(timeEntry.id, patch);
          setLoggedFlash(`${timeEntry.displayName?.trim() || timeEntry.name} is in your day.`);
        }}
      />

      <MissedDaySheet
        open={missedDayOpen}
        now={now ?? new Date()}
        day={backdate}
        onPickDay={setMissedDayKey}
        onClose={closeMissedDay}
        onLog={(doses) => {
          for (const dose of doses) {
            logEnhancementAdherence({ entryId: dose.entryId, date: backdate.date, plannedTime: dose.plannedTime, takenStatus: "taken", actualTime: dose.plannedTime });
          }
          markCompoundLogged();
          setLoggedFlash(`${doses.length} dose${doses.length === 1 ? "" : "s"} logged for that day.`);
        }}
      />

      <LogAddOnsSheet
        open={logAddOnsOpen}
        items={railItems
          .filter((item) => item.state !== "logged" && item.state !== "skipped")
          .map((item) => ({ id: item.slot.id, name: item.name, time: item.slot.plannedTimeLabel, slot: item.slot }))}
        onClose={closeLogAddOns}
        onLog={(chosen) => {
          for (const slot of chosen) markSlot(slot, "taken");
          setLoggedFlash(chosen.length === 1 ? COMMAND_COPY.logged(chosen[0].entry.displayName?.trim() || chosen[0].entry.name, new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })) : `${chosen.length} add-ons logged.`);
        }}
      />

      <CompoundSheet
        onLogDose={logDose}
        entry={sheetEntry}
        slots={slots}
        onClose={closeSheet}
        onEdit={openEdit}
        onSiteLog={(entry) => { setSheetEntryId(null); openInjectionLog(entry); }}
        onDoseMath={() => { setSheetEntryId(null); setDoseMathOpen(true); }}
        onTier={setTier}
      />

      {/* DOSE MATH */}
      <ReserveBottomSheet open={doseMathOpen} onClose={closeDoseMath} title={KEPT_PLACE_NAMES["dose-math"]} accent={RESERVE.steel}>
        {doseMathOpen && <DoseMathBody />}
      </ReserveBottomSheet>

      {/* EDITOR MODAL */}
      <AnimatePresence>
        {creating && (
          <EntryEditor
            editingId={editingId}
            onClose={closeEditor}
          />
        )}
      </AnimatePresence>

      {/* INJECTION LOG MODAL — the sheet owns its own open/close animation. */}
      {injectionLogFor && (
        <InjectionLogModal entry={injectionLogFor} plannedTime={injectionPlannedTime} onClose={() => setInjectionLogFor(null)} />
      )}
    </ViewShell>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   HERO — one statement, real readouts, one gold action
   ──────────────────────────────────────────────────────────────────────── */

function CompoundHeroBody({
  entries,
  read,
  primary,
  scheduledToday,
  below,
  onAdd,
  onOpenInjectionLog,
  onLog,
}: {
  entries: EnhancementEntry[];
  read: TodayRead;
  primary: ReturnType<typeof compoundPrimaryAction>;
  scheduledToday: number;
  below?: React.ReactNode;
  onAdd: () => void;
  onOpenInjectionLog: (entry: EnhancementEntry, plannedTime?: string) => void;
  onLog: (slot: CommandSlot) => void;
}) {
  const reads = compoundReadouts({
    dueNow: read.dueNow,
    laterToday: read.laterToday,
    missed: read.missed,
    loggedToday: read.loggedToday,
    scheduledToday,
  });

  return (
    <RecordHero
      testId="compound-command"
      accent={RESERVE.steel}
      eyebrow={COMMAND_COPY.eyebrow}
      statement={compoundStatement({
        trackedCount: entries.length,
        addOnCount: entries.filter((entry) => todayTierFor(entry) === "add-on").length,
        dueNow: read.dueNow.length,
        missed: read.missed.length,
      })}
      support={compoundSupport(entries.length)}
      reads={reads.map((r) => ({ label: r.label, value: r.value, unit: r.unit, detail: r.detail }))}
      below={below}
      action={
        primary.kind === "log-next-due"
          ? {
              label: primary.label,
              icon: primary.slot.injectable ? Syringe : CheckCircle2,
              onClick: () => {
                const entry = entries.find((e) => e.id === primary.slot.entryId);
                if (primary.slot.injectable && entry) onOpenInjectionLog(entry, primary.slot.plannedTime);
                else onLog(primary.slot);
              },
            }
          : { label: primary.label, icon: Plus, onClick: onAdd }
      }
    />
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   NAVIGATION — three places plus More
   ──────────────────────────────────────────────────────────────────────── */

function CompoundNav({
  place,
  safetyToolsVisible,
  onChange,
}: {
  place: CompoundTabKey;
  safetyToolsVisible: boolean;
  onChange: (key: CompoundTabKey) => void;
}) {
  const segments = primaryTabs(safetyToolsVisible).map((t) => ({ value: t.key, label: t.label }));
  return (
    <nav aria-label={COMMAND_COPY.navLabel} data-compound="nav" className="-mb-1">
      <ReserveSegmented<CompoundPrimaryTab>
        label={COMMAND_COPY.navLabel}
        value={primaryTabFor(place)}
        onChange={(key) => onChange(key)}
        accent={RESERVE.steel}
        size="sm"
        /* Four places fit one phone row; three fit with room to spare. */
        className="max-w-full max-md:w-full"
        segments={segments}
      />
    </nav>
  );
}

function ToolsIndex({ onOpen }: { onOpen: (key: CompoundToolKey) => void }) {
  return (
    <CommandPanel label={COMMAND_COPY.toolsHeading} record="tools">
      <ul className="flex flex-col divide-y divide-white/[0.06]">
        {TOOL_ORDER.map((key) => (
          <li key={key}>
            <button
              type="button"
              onClick={() => onOpen(key)}
              className="group flex min-h-[52px] w-full items-center justify-between gap-4 py-3 text-left transition-colors hover:text-white"
            >
              <span className="min-w-0">
                <span className="block text-[14px] font-semibold text-[#f2eee6]">{KEPT_PLACE_NAMES[key]}</span>
                <span className="mt-0.5 block text-[12px] leading-[1.45] text-white/55">{TOOL_LINES[key]}</span>
              </span>
              <ArrowRight size={14} aria-hidden="true" className="shrink-0 text-white/35 transition-transform group-hover:translate-x-0.5" />
            </button>
          </li>
        ))}
      </ul>
    </CommandPanel>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   TODAY
   ──────────────────────────────────────────────────────────────────────── */

function TodayTab({
  slots,
  railItems,
  onOpenSlot,
  onOpenEditor,
  onLog,
}: {
  slots: TodaySlot[];
  railItems: RailItem[];
  onOpenSlot: (slot: TodaySlot) => void;
  onOpenEditor: (id: string) => void;
  /** Marks a slot taken from its own row. */
  onLog: (slot: TodaySlot) => void;
}) {
  const entries = useAthleteDashboardStore((s) => s.trainingSession.enhancementLog);
  const schedulePlan = useAthleteDashboardStore((s) => s.trainingSession.schedulePlan);

  /* The member's main compounds are instruments in the hero above, where nothing here can push them down.
     The Day Timeline above is the one day track. Today's panel holds the add-ons: one progress line and a grid of
     markers that change state in place — never a second timeline, never a second list of logged rows. */
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      {/* With main compounds scheduled and no add-ons, the panel would only say so; it is left out. */}
      {(slots.length === 0 || railItems.length > 0) && (
        <div className="min-w-0 flex-1">
          <CommandPanel label={TIER_COPY.addOnHeading} record="today">
            {slots.length === 0 ? (
              <p className="text-[13px] leading-[1.55] text-white/60">
                {entries.length === 0 ? "Nothing scheduled today. What you add appears here on the days you set." : "Nothing in your log is scheduled for today."}
              </p>
            ) : (
              <AddOnGrid items={railItems} onOpenSlot={onOpenSlot} onLog={onLog} />
            )}
          </CommandPanel>
        </div>
      )}

      {/* Clashes in the times the member set: absorption, sleep, training, nutrients that add up. Beside the schedule on wide screens, above it on phones. */}
      <aside aria-label="Schedule checks" className="order-first empty:hidden lg:order-none lg:w-[340px] lg:shrink-0">
        <ScheduleChecks slots={slots} sleepTime={schedulePlan.sleepTime} trainingTime={schedulePlan.workoutTime} onSetTime={onOpenEditor} />
      </aside>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   PLAN — the member's compounds, and their week.

   Registry, Schedule, Inventory and the Injection Map were four places that
   each drew the same entries again. Here the entries are listed once, with
   two views, and everything about ONE compound — its schedule, what is left,
   the sites it was logged at, the markers to raise — opens in that
   compound's own sheet.
   ──────────────────────────────────────────────────────────────────────── */

/** How far ahead the board pages: four weeks, the span the ledger is built over. */
const WEEKS_AHEAD = 3;
/** How far back the board pages, so a missed or late dose can still be logged. */
const WEEKS_BACK = 3;

function PlanTab({
  slots,
  view,
  onViewChange,
  onCreate,
  onOpenSheet,
  onOpenEditor,
  onOpenInjectionLog,
  onOpenDoseMath,
}: {
  slots: TodaySlot[];
  view: PlanView;
  onViewChange: (view: PlanView) => void;
  onCreate: () => void;
  onOpenSheet: (id: string) => void;
  onOpenEditor: (id: string) => void;
  onOpenInjectionLog: (entry: EnhancementEntry, plannedTime?: string) => void;
  onOpenDoseMath: () => void;
}) {
  const entries = useAthleteDashboardStore((s) => s.trainingSession.enhancementLog);
  const adherence = useAthleteDashboardStore((s) => s.trainingSession.enhancementAdherence);
  const injectionLogs = useAthleteDashboardStore((s) => s.trainingSession.injectionLogs);
  const schedulePlan = useAthleteDashboardStore((s) => s.trainingSession.schedulePlan);
  const logEnhancementAdherence = useAthleteDashboardStore((s) => s.logEnhancementAdherence);
  const doseAnchors = useDoseAnchors();
  const [drawerEventId, setDrawerEventId] = useState<string | null>(null);
  /* The board pages a week at a time, back WEEKS_BACK weeks (to log a missed or
     late dose) and ahead WEEKS_AHEAD. weekOffset 0 is the week starting today. */
  const [weekOffset, setWeekOffset] = useState(0);

  const ledger = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - WEEKS_BACK * 7);
    return buildCompoundScheduleLedger({
      entries,
      adherence,
      injectionLogs,
      dateRange: { start, days: (WEEKS_BACK + WEEKS_AHEAD + 1) * 7 },
      wakeTime: schedulePlan.wakeTime,
      sleepTime: schedulePlan.sleepTime,
      preferredGymTime: schedulePlan.workoutTime,
      anchors: doseAnchors,
    });
  }, [entries, adherence, injectionLogs, schedulePlan, doseAnchors]);

  const boardDays = useMemo(() => {
    const out: Array<{ key: string; date: Date; events: CompoundScheduleLedgerEvent[] }> = [];
    for (let i = 0; i < 7; i += 1) {
      const key = dateKeyOffset(weekOffset * 7 + i);
      const date = new Date(`${key}T00:00:00`);
      out.push({ key, date, events: ledger.filter((event) => event.plannedDate === key) });
    }
    return out;
  }, [ledger, weekOffset]);

  const boardLabel = weekOffset === 0
    ? "Next 7 days"
    : `${scheduleDateLabel(boardDays[0].key)} – ${scheduleDateLabel(boardDays[6].key)}`;

  // The headline stats speak to now: today forward, never the past weeks the board can page back into.
  const scheduledNext7 = useMemo(() => {
    const today = dateKeyOffset(0);
    const horizon = dateKeyOffset(6);
    return ledger.filter((event) => event.plannedDate >= today && event.plannedDate <= horizon).length;
  }, [ledger]);
  const missedEvents = useMemo(() => {
    const today = dateKeyOffset(0);
    return ledger.filter((event) => event.status === "Missed" && event.plannedDate >= today);
  }, [ledger]);

  const drawerEvent = useMemo(
    () => ledger.find((event) => event.eventId === drawerEventId) ?? null,
    [ledger, drawerEventId],
  );
  const drawerInjectionLog = drawerEvent
    ? injectionLogs.find((log) => log.entryId === drawerEvent.entryId && log.date === drawerEvent.plannedDate)
    : undefined;

  function mark(eventId: string, status: "taken" | "skipped") {
    const event = ledger.find((item) => item.eventId === eventId);
    if (!event) return;
    logEnhancementAdherence({
      entryId: event.entryId,
      date: event.plannedDate,
      plannedTime: event.plannedTime,
      takenStatus: status,
      actualTime: new Date().toTimeString().slice(0, 5),
    });
    markCompoundLogged();
  }

  return (
    <>
      {/* The line and the view switch sit above the panel: a segmented control carries its own fill,
          so inside the panel it would be a surface in a surface. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="tnum min-w-0 text-[13px] font-semibold text-[#f2eee6]">
          {planLine({ trackedCount: entries.length, scheduledNext7 })}
        </p>
        <ReserveSegmented<PlanView>
          label="Plan view"
          value={view}
          onChange={onViewChange}
          accent={RESERVE.steel}
          size="sm"
          segments={[
            { value: "compounds", label: COMMAND_COPY.planCompounds },
            { value: "week", label: COMMAND_COPY.planWeek },
          ]}
        />
      </div>

      {view === "compounds" ? (
        <CommandPanel
          label={`Compounds · ${entries.length}`}
          record="plan"
          action={
            <ReserveButton tier="quiet" size="sm" icon={Plus} onClick={onCreate}>
              Add compound
            </ReserveButton>
          }
        >
          {entries.length === 0 ? (
            <p className="text-[13px] leading-[1.55] text-white/60">{COMMAND_COPY.planEmpty}</p>
          ) : (
            <RowList label="Compounds">
              {entries.map((entry) => {
                const slot = slots.find((s) => s.entryId === entry.id);
                const state = computeEntryScheduleState(entry, {
                  wakeTime: schedulePlan.wakeTime,
                  sleepTime: schedulePlan.sleepTime,
                  preferredGymTime: schedulePlan.workoutTime,
                  anchors: doseAnchors,
                });
                const last = getLastAdherenceTouch(entry.id, adherence);
                const name = entry.displayName ?? entry.officialName ?? entry.name;
                const route = entry.route ? ROUTE_OPTIONS.find((o) => o.value === entry.route)?.label : null;
                const source = entry.sourceType ? SOURCE_TYPE_OPTIONS.find((o) => o.value === entry.sourceType)?.label : "User-defined";
                const flag = getCriticalReviewFlags(entry)[0];
                /* The vial is drawn at the level this member's own logging left
                   it — remaining over starting, both from computeInventory. No
                   inventory configured means no honest level, so `fill` stays
                   null and the glass draws empty rather than guessing. */
                const rowInv = computeInventory({ entry, adherence });
                const vial = vialIdentity({
                  name: entry.officialName ?? entry.name,
                  compoundClass: entry.compoundClass,
                  route: entry.route,
                });
                const fill =
                  rowInv.remainingMg !== null && rowInv.startingMg !== null && rowInv.startingMg > 0
                    ? rowInv.remainingMg / rowInv.startingMg
                    : null;
                const vialLabel =
                  fill === null
                    ? `${name}: ${vial.appearance}, remaining not tracked`
                    : `${name}: ${vial.appearance}, ${Math.round(fill * 100)} percent remaining`;
                /* Today's word comes from the same slot the hero and Today read, so one compound
                   is never "missed" on one screen and "next due today" on another. */
                const todayFact: [string, string] = slot
                  ? ["Today", `${getStackStatus(slot).label} · ${slot.plannedTimeLabel}`]
                  : ["Next", state.nextDueLabel];
                return (
                  <Row
                    key={entry.id}
                    record="plan-entry"
                    title={name}
                    leading={
                      /* The vial is for peptides and compounds only — add-ons
                         like vitamins and supplements show as a plain row. */
                      categoryDrawsVial(entry.category) ? (
                        <CompoundVial
                          fill={fill}
                          tint={vial.tint}
                          form={vial.form}
                          urgent={rowInv.status === "reorder-now" || rowInv.status === "out"}
                          label={vialLabel}
                        />
                      ) : undefined
                    }
                    status={{ label: entry.isActive ? "Active" : "Paused", color: entry.isActive ? GREEN : "rgba(255,255,255,0.6)" }}
                    meta={[classLabelFor(entry.compoundClass), route, source].filter(Boolean).join(" · ")}
                    actions={
                      <ReserveButton tier="quiet" size="sm" iconAfter={ArrowRight} onClick={() => onOpenSheet(entry.id)}>
                        Open
                      </ReserveButton>
                    }
                  >
                    <Facts items={[todayFact, ["Last marked", last?.label ?? "Not marked yet"]]} />
                    {flag && <ReviewLine label="Needs detail">{flag}</ReviewLine>}
                  </Row>
                );
              })}
            </RowList>
          )}

          {/* The converter, as a row rather than a place of its own. */}
          <div className="mt-1 border-t border-white/[0.06]">
            <button
              type="button"
              onClick={onOpenDoseMath}
              className="group flex min-h-[52px] w-full items-center justify-between gap-4 py-3 text-left transition-colors hover:text-white"
            >
              <span className="min-w-0">
                <span className="block text-[14px] font-semibold text-[#f2eee6]">{KEPT_PLACE_NAMES["dose-math"]}</span>
                <span className="mt-0.5 block text-[12px] leading-[1.45] text-white/55">{COMMAND_COPY.doseMathLine}</span>
              </span>
              <Calculator size={14} aria-hidden="true" className="shrink-0 text-white/35" />
            </button>
          </div>
        </CommandPanel>
      ) : (
        <CommandPanel
          label={boardLabel}
          record="plan-week"
          action={
            <span className="-mr-2 flex items-center gap-1">
              {weekOffset <= -WEEKS_BACK ? (
                <ReserveButton tier="quiet" size="sm" icon={ArrowLeft} disabled disabledReason={`The board goes back ${WEEKS_BACK} weeks.`}>
                  Earlier
                </ReserveButton>
              ) : (
                <ReserveButton tier="quiet" size="sm" icon={ArrowLeft} onClick={() => setWeekOffset((w) => Math.max(-WEEKS_BACK, w - 1))}>
                  Earlier
                </ReserveButton>
              )}
              {weekOffset >= WEEKS_AHEAD ? (
                <ReserveButton tier="quiet" size="sm" iconAfter={ArrowRight} disabled disabledReason="Reserve places your own schedule four weeks ahead.">
                  Later
                </ReserveButton>
              ) : (
                <ReserveButton tier="quiet" size="sm" iconAfter={ArrowRight} onClick={() => setWeekOffset((w) => Math.min(WEEKS_AHEAD, w + 1))}>
                  Later
                </ReserveButton>
              )}
            </span>
          }
        >
          <div className="grid grid-cols-1 divide-y divide-white/[0.06] xl:grid-cols-7 xl:divide-x xl:divide-y-0">
            {boardDays.map((day) => (
              <BoardColumn
                key={day.key}
                date={day.date}
                isToday={day.key === dateKeyOffset(0)}
                events={day.events}
                injectionLogs={injectionLogs}
                onSelect={setDrawerEventId}
              />
            ))}
          </div>

          {missedEvents.length > 0 && (
            <>
              <GroupLabel color={RED}>Missed · {missedEvents.length}</GroupLabel>
              <ul className="mt-1 flex flex-col divide-y divide-white/[0.05]">
                {missedEvents.slice(0, 10).map((event) => (
                  <li key={event.eventId}>
                    <button
                      type="button"
                      onClick={() => setDrawerEventId(event.eventId)}
                      className="grid min-h-[44px] w-full grid-cols-[74px_minmax(0,1fr)_auto] items-center gap-3 py-2.5 text-left transition-colors hover:bg-white/[0.02]"
                    >
                      <span className="tnum font-mono text-[10px] uppercase tracking-[0.14em] text-white/50">{scheduleDateLabel(event.plannedDate)}</span>
                      <span className="min-w-0 truncate text-[13px] font-semibold text-[#f2eee6]">
                        {event.entry.displayName ?? event.entry.officialName ?? event.entry.name}
                      </span>
                      <StatusWord label={event.plannedTimeLabel} color="rgba(255,255,255,0.55)" />
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </CommandPanel>
      )}

      <EventSheet
        event={drawerEvent}
        injectionLog={drawerInjectionLog}
        onClose={() => setDrawerEventId(null)}
        onLog={() => { if (drawerEvent) mark(drawerEvent.eventId, "taken"); }}
        onSkip={() => { if (drawerEvent) mark(drawerEvent.eventId, "skipped"); }}
        onSiteLog={() => { if (drawerEvent) { const entry = drawerEvent.entry; setDrawerEventId(null); onOpenInjectionLog(entry, drawerEvent.plannedTime); } }}
        onEditEntry={() => { if (drawerEvent) { const id = drawerEvent.entry.id; setDrawerEventId(null); onOpenEditor(id); } }}
      />
    </>
  );
}

function BoardColumn({
  date,
  isToday,
  events,
  injectionLogs,
  onSelect,
}: {
  date: Date;
  isToday: boolean;
  events: CompoundScheduleLedgerEvent[];
  injectionLogs: InjectionLogRecord[];
  onSelect: (eventId: string) => void;
}) {
  const dayName = weekdayShort(date.getDay());
  const monthShort = date.toLocaleDateString(undefined, { month: "short" });
  return (
    <div className="flex min-w-0 flex-col gap-1.5 py-3 first:pt-0 xl:px-2 xl:py-0 xl:first:pl-0 xl:last:pr-0">
      <p className="tnum font-mono text-[9px] uppercase tracking-[0.18em]" style={{ color: isToday ? STEEL : "rgba(255,255,255,0.5)" }}>
        {isToday ? "Today" : dayName} · {monthShort} {date.getDate()}
      </p>
      {events.length === 0 ? (
        <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/30">Clear</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {events.map((event) => {
            const accent = ledgerStatusColor(event.status);
            const entry = event.entry;
            const hasSiteLog = injectionLogs.some((log) => log.entryId === event.entryId && log.date === event.plannedDate);
            return (
              <li key={event.eventId}>
                <button
                  type="button"
                  onClick={() => onSelect(event.eventId)}
                  className="flex min-h-[44px] w-full flex-col items-start border-l-2 py-1.5 pl-2 text-left transition-colors hover:bg-white/[0.03]"
                  style={{ borderLeftColor: accent }}
                >
                  <span className="tnum font-mono text-[9px] uppercase tracking-[0.12em] text-white/55">{event.plannedTimeLabel}</span>
                  <span className="w-full truncate text-[12px] font-semibold leading-tight text-[#f2eee6]">{entry.displayName ?? entry.officialName ?? entry.name}</span>
                  <span className="font-mono text-[9px] uppercase tracking-[0.12em]" style={{ color: accent }}>
                    {event.status}
                    {entry.route === "injectable" && event.status !== "Site Log Needed" && (
                      <span style={{ color: event.needsSiteLog ? AMBER : hasSiteLog ? GREEN : "rgba(255,255,255,0.4)" }}>
                        {" · "}{event.needsSiteLog ? "Site needed" : hasSiteLog ? "Site logged" : "Site clear"}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/**
 * One scheduled event. Was a hand-rolled side drawer of bordered cards inside
 * bordered cards; now the shared bottom sheet, which brings the keyboard
 * viewport, the escape paths and the phone tab-bar behaviour with it.
 */
function EventSheet({
  event,
  injectionLog,
  onClose,
  onLog,
  onSkip,
  onSiteLog,
  onEditEntry,
}: {
  event: CompoundScheduleLedgerEvent | null;
  injectionLog?: InjectionLogRecord;
  onClose: () => void;
  onLog: () => void;
  onSkip: () => void;
  onSiteLog: () => void;
  onEditEntry: () => void;
}) {
  const entry = event?.entry;
  const isTaken = event ? ["Completed", "Inventory Alert", "Site Log Needed"].includes(event.status) : false;
  const isSkipped = event?.status === "Skipped";
  const isInjectable = entry?.route === "injectable";
  const hasSiteLog = Boolean(injectionLog);
  const execution = entry ? formatPlannedExecution(entry) : null;

  return (
    <ReserveBottomSheet
      open={Boolean(event)}
      onClose={onClose}
      title={entry ? entry.displayName ?? entry.officialName ?? entry.name : "Scheduled compound"}
      accent={RESERVE.steel}
      footer={
        event && (
          <div className="flex flex-wrap items-center gap-2">
            {!isTaken && !isSkipped && (
              <ReserveButton tier="secondary" size="sm" accent={GREEN} icon={CheckCircle2} onClick={() => { onLog(); onClose(); }}>
                Log Taken
              </ReserveButton>
            )}
            {!isTaken && !isSkipped && (
              <ReserveButton tier="quiet" size="sm" onClick={() => { onSkip(); onClose(); }}>
                Skip
              </ReserveButton>
            )}
            {isInjectable && (
              <ReserveButton tier="quiet" size="sm" icon={Syringe} onClick={onSiteLog}>
                {hasSiteLog ? "Edit Site Log" : "Add Site Log"}
              </ReserveButton>
            )}
            <ReserveButton tier="quiet" size="sm" icon={Pencil} onClick={onEditEntry}>
              Edit entry
            </ReserveButton>
          </div>
        )
      }
    >
      {event && entry && (
        <div className="flex flex-col gap-3" data-compound="event-sheet">
          <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/50">
            {scheduleDateLabel(event.plannedDate)} · {event.plannedTimeLabel} · <span style={{ color: ledgerStatusColor(event.status) }}>{event.status}</span>
          </p>
          {execution && (
            <div>
              <GroupLabel>{isTaken ? "Logged" : "Planned"}</GroupLabel>
              <p className="tnum mt-1 text-[15px] font-semibold text-[#f2eee6]">{execution}</p>
              <p className="mt-1 text-[11px] leading-[1.5] text-white/40">{CALCULATION_ONLY_COPY}</p>
            </div>
          )}
          <Facts
            items={[
              ["Route", ROUTE_OPTIONS.find((o) => o.value === entry.route)?.label ?? "Not set"],
              ["Source", entry.sourceType ? SOURCE_TYPE_OPTIONS.find((o) => o.value === entry.sourceType)?.label ?? "User-defined" : "User-defined"],
              ["Inventory", event.inventoryImpact],
              ["Site log", isInjectable ? (hasSiteLog ? "Logged" : event.needsSiteLog ? "Needed" : "Clear") : "Not applicable"],
            ]}
          />
          {isInjectable && hasSiteLog && (
            <p className="text-[12px] leading-[1.5] text-white/65">{formatLogDetails(entry, injectionLog, entry.amountPerLogMg)}</p>
          )}
          {event.reviewReason && <ReviewLine label="Needs detail">{event.reviewReason}</ReviewLine>}
          {(event.loggedAt || isSkipped) && (
            <p className="text-[12px] text-white/50">{isSkipped ? "Marked skipped." : `Logged ${event.loggedAt ?? ""}.`}</p>
          )}
        </div>
      )}
    </ReserveBottomSheet>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   ONE COMPOUND — its schedule, what is left, its sites, its markers.

   This sheet is what used to be the Inventory place, the Injection Map place
   and most of Labs / Review: three more lists of the same entries.
   ──────────────────────────────────────────────────────────────────────── */

function CompoundSheet({
  entry,
  slots,
  onClose,
  onEdit,
  onSiteLog,
  onLogDose,
  onDoseMath,
  onTier,
}: {
  entry: EnhancementEntry | null;
  slots: TodaySlot[];
  onClose: () => void;
  onEdit: (id: string) => void;
  onSiteLog: (entry: EnhancementEntry) => void;
  /** Record a dose the member took: today, or the day before. */
  onLogDose: (entry: EnhancementEntry, dayOffset: 0 | 1) => void;
  onDoseMath: () => void;
  onTier: (id: string, tier: TodayTier) => void;
}) {
  const adherence = useAthleteDashboardStore((s) => s.trainingSession.enhancementAdherence);
  const injectionLogs = useAthleteDashboardStore((s) => s.trainingSession.injectionLogs);
  const schedulePlan = useAthleteDashboardStore((s) => s.trainingSession.schedulePlan);
  const doseAnchors = useDoseAnchors();
  const toggleEnhancementEntryActive = useAthleteDashboardStore((s) => s.toggleEnhancementEntryActive);
  const removeEnhancementEntry = useAthleteDashboardStore((s) => s.removeEnhancementEntry);
  const removeInjectionLog = useAthleteDashboardStore((s) => s.removeInjectionLog);

  const name = entry ? entry.displayName ?? entry.officialName ?? entry.name : "Compound";
  const slot = entry ? slots.find((s) => s.entryId === entry.id) : undefined;
  const state = entry
    ? computeEntryScheduleState(entry, { wakeTime: schedulePlan.wakeTime, sleepTime: schedulePlan.sleepTime, preferredGymTime: schedulePlan.workoutTime, anchors: doseAnchors })
    : null;
  const inv = entry ? computeInventory({ entry, adherence }) : null;
  const sheetVial = vialIdentity({
    name: entry?.officialName ?? entry?.name,
    compoundClass: entry?.compoundClass,
    route: entry?.route,
  });
  const sheetFill =
    inv && inv.remainingMg !== null && inv.startingMg !== null && inv.startingMg > 0
      ? inv.remainingMg / inv.startingMg
      : null;
  const last = entry ? getLastAdherenceTouch(entry.id, adherence) : null;
  const entryLogs = entry
    ? injectionLogs.filter((l) => l.entryId === entry.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    : [];
  const rotation = entry ? computeRotationCandidate(entry, injectionLogs) : null;
  const flags = entry ? getCriticalReviewFlags(entry) : [];
  const optional = entry ? getOptionalReviewNotes(entry) : [];
  const markers = entry?.labMarkersToDiscuss ?? [];
  const injectable = entry?.route === "injectable";

  return (
    <ReserveBottomSheet
      open={Boolean(entry)}
      onClose={onClose}
      title={name}
      accent={RESERVE.steel}
      footer={
        entry && (
          <div className="flex flex-wrap items-center gap-2">
            {/* A dose the member took is a fact, whatever the schedule says: paused,
                ended, manual, or simply not today, it can always be recorded — and
                a day that has already gone can still be put right. */}
            <ReserveButton tier="secondary" size="sm" accent={RESERVE.steel} icon={CheckCircle2} onClick={() => onLogDose(entry, 0)}>
              Log a dose now
            </ReserveButton>
            <ReserveButton tier="quiet" size="sm" icon={CalendarClock} onClick={() => onLogDose(entry, 1)}>
              Log for yesterday
            </ReserveButton>
            <ReserveButton tier="quiet" size="sm" icon={Pencil} onClick={() => onEdit(entry.id)}>
              Edit entry
            </ReserveButton>
            {injectable && (
              <ReserveButton tier="quiet" size="sm" icon={Syringe} onClick={() => onSiteLog(entry)}>
                Site Log
              </ReserveButton>
            )}
            <ReserveButton tier="quiet" size="sm" icon={Calculator} onClick={onDoseMath}>
              {KEPT_PLACE_NAMES["dose-math"]}
            </ReserveButton>
            <ReserveButton tier="quiet" size="sm" icon={entry.isActive ? Pause : Play} onClick={() => toggleEnhancementEntryActive(entry.id)}>
              {entry.isActive ? "Pause" : "Activate"}
            </ReserveButton>
            <ReserveButton tier="quiet" size="sm" accent={RED} icon={Trash2} onClick={() => { removeEnhancementEntry(entry.id); onClose(); }}>
              Remove
            </ReserveButton>
          </div>
        )
      }
    >
      {entry && (
        <div className="flex flex-col gap-4" data-compound="compound-sheet">
          <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/50">
            {[classLabelFor(entry.compoundClass), entry.route ? ROUTE_OPTIONS.find((o) => o.value === entry.route)?.label : null,
              entry.sourceType ? SOURCE_TYPE_OPTIONS.find((o) => o.value === entry.sourceType)?.label : "User-defined"].filter(Boolean).join(" · ")}
            {" · "}
            <span style={{ color: entry.isActive ? GREEN : "rgba(255,255,255,0.6)" }}>{entry.isActive ? "Active" : "Paused"}</span>
          </p>

          <div>
            <GroupLabel>{COMMAND_COPY.sheetSchedule}</GroupLabel>
            <Facts
              items={[
                ["Repeats", frequencyDisplay(entry)],
                /* The member's own amount, added up across their own times. */
                ...(dailyAmountLabel(entry) ? [["Per day", dailyAmountLabel(entry)] as [string, string]] : []),
                slot ? ["Today", `${getStackStatus(slot).label} · ${slot.plannedTimeLabel}`] : ["Next", state?.nextDueLabel ?? "Not scheduled"],
                ["Last marked", last?.label ?? "Not marked yet"],
              ]}
            />
          </div>

          <div>
            <GroupLabel>{COMMAND_COPY.sheetLeft}</GroupLabel>
            {!inv?.configured ? (
              <p className="mt-1 text-[12.5px] leading-[1.5] text-white/55">
                Not worked out yet. Add vial size, concentration and amount per log to the entry.
              </p>
            ) : (
              <div className="mt-1 flex items-start gap-4">
                {/* The same vial as the list row, at reading size, beside the
                    numbers it is drawn from — peptides and compounds only, so an
                    add-on's remaining count stands on its own without a glass. */}
                {categoryDrawsVial(entry.category) && (
                  <CompoundVial
                    size="md"
                    fill={sheetFill}
                    tint={sheetVial.tint}
                    form={sheetVial.form}
                    urgent={inv.status === "reorder-now" || inv.status === "out"}
                    label={
                      sheetFill === null
                        ? `${name}: ${sheetVial.appearance}, remaining not tracked`
                        : `${name}: ${sheetVial.appearance}, ${Math.round(sheetFill * 100)} percent remaining`
                    }
                  />
                )}
                <div className="min-w-0 flex-1">
              <Facts
                items={[
                  ["Remaining mg", inv.remainingMg !== null ? inv.remainingMg.toFixed(1) : "Not entered"],
                  ["Remaining mL", inv.remainingMl !== null ? inv.remainingMl.toFixed(2) : "Not entered"],
                  ["Per log", inv.averageMgPerLog !== null ? `${inv.averageMgPerLog} mg` : "Not entered"],
                  ["Avg mg / week", inv.averageMgPerWeek !== null ? inv.averageMgPerWeek.toFixed(1) : "Not enough logs"],
                  ["Runout date", formatDateShort(inv.estimatedRunoutDate)],
                  ["Reorder window", formatDateShort(inv.reorderDate)],
                  ["Cost / week", inv.costPerWeek !== null ? `$${inv.costPerWeek.toFixed(2)}` : "Not entered"],
                  ["Status", inventoryStatusLabel(inv.status)],
                ]}
              />
                </div>
              </div>
            )}
          </div>

          {injectable && (
            <div>
              <GroupLabel>{COMMAND_COPY.sheetSites}</GroupLabel>
              <Facts
                items={[
                  ["Last site", entryLogs[0] ? `${entryLogs[0].site}${entryLogs[0].side ? ` · ${entryLogs[0].side}` : ""}` : "No site logged yet"],
                  ["Last site logged", entryLogs[0] ? formatDateShort(new Date(entryLogs[0].createdAt)) : "No site logged yet"],
                  ["Min site rest (member-entered)", entry.minimumSiteRestDays ? `${entry.minimumSiteRestDays} day${entry.minimumSiteRestDays === 1 ? "" : "s"}` : "Not set"],
                  ["Least recently used", rotation ?? "Not enough logs"],
                ]}
              />
              {entryLogs.length > 0 && (
                <ul className="mt-2 flex flex-col divide-y divide-white/[0.05]">
                  {entryLogs.slice(0, 5).map((log) => (
                    <li key={log.id} className="flex items-center justify-between gap-2 py-1.5">
                      <div className="min-w-0">
                        <p className="text-[12px] font-semibold text-[#f2eee6]">{log.site}{log.side ? ` · ${log.side}` : ""}</p>
                        <p className="tnum font-mono text-[9px] uppercase tracking-[0.14em] text-white/40">
                          {formatDateShort(new Date(log.createdAt))}{log.amountValue ? ` · ${log.amountValue}${log.amountUnit ?? ""}` : ""}{log.reactionNote ? ` · ${log.reactionNote}` : ""}
                        </p>
                      </div>
                      <ReserveIconButton icon={X} label={`Remove ${log.site} log`} accent={RED} size={12} onClick={() => removeInjectionLog(log.id)} />
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-2 text-[11px] leading-[1.5] text-white/40">
                Sites come from your own logs. Reserve does not give injection instructions.
              </p>
            </div>
          )}

          <div>
            <GroupLabel>{COMMAND_COPY.sheetMarkers}</GroupLabel>
            <p className="mt-1 text-[12.5px] leading-[1.55] text-white/65">
              {markers.length === 0 ? "None entered yet. Add markers to this entry to keep them with it." : markers.join(" · ")}
            </p>
          </div>

          <TierChoice tier={todayTierFor(entry)} onTier={(tier) => onTier(entry.id, tier)} />

          {flags.length > 0 && <ReviewLine label="Needs detail">{flags.join(" · ")}</ReviewLine>}
          {optional.length > 0 && (
            <p className="text-[12px] leading-[1.5] text-white/50">
              Optional · {optional.map((note) => note.replace(/^Optional:\s*/i, "")).join(" · ")}
            </p>
          )}
        </div>
      )}
    </ReserveBottomSheet>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   IN YOUR LOG, NOT ON TODAY — nothing a member is on goes unmentioned
   ──────────────────────────────────────────────────────────────────────── */

function OffPlanToday({
  entries,
  slots,
  onOpen,
  onGiveTime,
}: {
  entries: EnhancementEntry[];
  slots: TodaySlot[];
  onOpen: (entryId: string) => void;
  onGiveTime: (entryId: string) => void;
}) {
  const items = useMemo(
    () => offPlanToday(entries.map((e) => ({ ...e, name: (e.displayName?.trim() || e.name) })), slots.map((slot) => slot.entryId)),
    [entries, slots],
  );
  const line = offPlanLine(items);
  if (!line) return null;
  return (
    <CommandPanel label="In your log" record="off-plan">
      <PlaceNote>{line}. Open one to see it, or to log a dose you took.</PlaceNote>
      <RowList label="In your log, not on today">
        {items.map((item) => (
          <Row
            key={item.id}
            title={item.name}
            meta={item.note}
            actions={
              item.reason === "no-time" ? (
                <ReserveButton tier="secondary" size="sm" accent={RESERVE.steel} icon={Clock} onClick={() => onGiveTime(item.id)}>
                  Set a time<span className="sr-only"> for {item.name}</span>
                </ReserveButton>
              ) : (
                <ReserveButton tier="quiet" size="sm" onClick={() => onOpen(item.id)}>
                  Open<span className="sr-only"> {item.name}</span>
                </ReserveButton>
              )
            }
          />
        ))}
      </RowList>
    </CommandPanel>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   SUPPORT STACK
   ──────────────────────────────────────────────────────────────────────── */

function SupportStackTab({ arrival }: { arrival: SupportArrival | null }) {
  const entries = useAthleteDashboardStore((s) => s.trainingSession.enhancementLog);
  const links = useAthleteDashboardStore((s) => s.trainingSession.compoundSupportLinks);
  const addCompoundSupportLink = useAthleteDashboardStore((s) => s.addCompoundSupportLink);
  const removeCompoundSupportLink = useAthleteDashboardStore((s) => s.removeCompoundSupportLink);

  const [parentId, setParentId] = useState<string>("");
  const [supportId, setSupportId] = useState<string>("");
  const [relationshipType, setRelationshipType] = useState<CompoundSupportRelationshipType>("Lab monitoring support");
  const [reasonTags, setReasonTags] = useState<string[]>([]);
  const [labMarkers, setLabMarkers] = useState<string[]>([]);
  const [symptomWatches, setSymptomWatches] = useState<string[]>([]);
  const [customNote, setCustomNote] = useState("");
  const [linking, setLinking] = useState(false);
  const closeLinking = useCallback(() => setLinking(false), []);
  const registryOptions: PickerOption[] = entries.map((entry) => ({
    id: entry.id,
    value: entry.id,
    label: entry.displayName ?? entry.officialName ?? entry.name,
    sub: `${classLabelFor(entry.compoundClass)} · ${entry.route ?? "route not set"}`,
    group: classLabelFor(entry.compoundClass),
    aliases: entry.aliases,
  }));

  function add() {
    if (!parentId || !supportId || parentId === supportId) return;
    addCompoundSupportLink({
      parentEntryId: parentId,
      supportEntryId: supportId,
      reason: reasonTags.join(" · ") || "Member/provider-entered",
      relationshipType,
      reasonTags,
      labMarkers,
      symptomWatches,
      customNote: customNote.trim() || undefined,
      source: "member_entered",
    });
    setReasonTags([]);
    setLabMarkers([]);
    setSymptomWatches([]);
    setCustomNote("");
    setSupportId("");
    setLinking(false);
  }

  const linkDisabled = !parentId || !supportId || parentId === supportId;

  return (
    <>
      {/* The evidence-graded support plan — no cycle needed, behind the safety acknowledgement. */}
      <MemberSupportPlan arrival={arrival} />

      <CommandPanel label="Linked entries" record="support-links">
        <PlaceNote>Link two entries from your log so they are tracked together. Reserve records only the link you enter.</PlaceNote>

        {links.length === 0 ? (
          <p className="text-[13px] text-white/55">No links yet.</p>
        ) : (
          <RowList label="Linked entries">
            {links.map((link) => {
              const parent = entries.find((e) => e.id === link.parentEntryId);
              const support = entries.find((e) => e.id === link.supportEntryId);
              if (!parent || !support) return null;
              return (
                <Row
                  key={`${link.parentEntryId}-${link.supportEntryId}`}
                  title={`${support.displayName ?? support.name} → ${parent.displayName ?? parent.name}`}
                  status={{ label: "Tracking only", color: GREEN }}
                  meta={`Relationship: ${link.relationshipType ?? "Member-entered note"} · member/provider-entered`}
                  actions={
                    <ReserveButton tier="quiet" size="sm" icon={X} onClick={() => removeCompoundSupportLink(link.parentEntryId, link.supportEntryId)}>
                      Unlink
                    </ReserveButton>
                  }
                >
                  <p className="mt-1 text-[12px] text-white/55">Watch: {[...(link.labMarkers ?? []), ...(link.symptomWatches ?? []), ...(link.reasonTags ?? [])].join(" · ") || link.reason}</p>
                </Row>
              );
            })}
          </RowList>
        )}

        <div className="mt-3">
          <ReserveButton tier="secondary" size="sm" accent={RESERVE.steel} icon={Link2} onClick={() => setLinking(true)}>
            Link two entries
          </ReserveButton>
        </div>
      </CommandPanel>

      {/* The form lives in a sheet: the place shows the links, not the paperwork. */}
      <ReserveBottomSheet open={linking} onClose={closeLinking} title="Link two entries" accent={RESERVE.steel}>
        <div className="grid gap-3 lg:grid-cols-2">
          <CompoundPicker label="Parent Compound" value={parentId} placeholder="Search parent compound..." options={registryOptions} onPick={(option) => setParentId(option.value ?? option.id)} />
          <CompoundPicker label="Linked Item" value={supportId} placeholder="Search linked item..." options={[...registryOptions.filter((o) => o.id !== parentId), { id: "add-new", value: "add-new", label: "Add a new item", sub: "Create it in Registry first", group: "Custom" }]} onPick={(option) => option.id !== "add-new" && setSupportId(option.value ?? option.id)} />
          <FormField label="Relationship Type">
            <ReserveSelect
              srLabel="Relationship type"
              value={relationshipType}
              options={SUPPORT_RELATIONSHIPS.map((item) => ({ value: item, label: item }))}
              onChange={(v) => setRelationshipType(v as CompoundSupportRelationshipType)}
            />
          </FormField>
          <FormField label="Optional custom note">
            <input value={customNote} onChange={(e) => setCustomNote(e.target.value)} className="rounded-lg border border-white/[0.08] bg-[#0a0c13] px-3 py-2 text-[16px] text-[#f2eee6] outline-none placeholder:text-white/25 focus:border-white/20 sm:text-[12px]" />
          </FormField>
        </div>
        <div className="mt-3 grid gap-3">
          <FormField label="Why are these linked? Select a tracking reason."><ToggleChips options={SUPPORT_REASON_TAGS} values={reasonTags} onChange={setReasonTags} /></FormField>
          <FormField label="Lab marker watch"><ToggleChips options={LAB_MARKERS} values={labMarkers} onChange={setLabMarkers} /></FormField>
          <FormField label="Symptom / tolerance watch"><ToggleChips options={SYMPTOM_WATCHES} values={symptomWatches} onChange={setSymptomWatches} /></FormField>
        </div>
        <div className="mt-3">
          {linkDisabled ? (
            <ReserveButton tier="secondary" size="sm" accent={RESERVE.steel} icon={Link2} disabled disabledReason="Choose a parent compound and a different linked item first.">
              Link
            </ReserveButton>
          ) : (
            <ReserveButton tier="secondary" size="sm" accent={RESERVE.steel} icon={Link2} onClick={add}>
              Link
            </ReserveButton>
          )}
        </div>
      </ReserveBottomSheet>
    </>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   LABS / REVIEW
   ──────────────────────────────────────────────────────────────────────── */

function LabsReviewTab({ onEdit }: { onEdit: (id: string) => void }) {
  const entries = useAthleteDashboardStore((s) => s.trainingSession.enhancementLog);

  const rows = useMemo(() => entries.map((entry) => ({ entry, flags: getCriticalReviewFlags(entry), optional: getOptionalReviewNotes(entry) })), [entries]);
  const criticalCount = useMemo(() => rows.filter((r) => r.flags.length > 0).length, [rows]);
  const optionalCount = useMemo(() => rows.reduce((sum, r) => sum + r.optional.length, 0), [rows]);
  const labMarkers = useMemo(() => {
    const set = new Set<string>();
    for (const e of entries) {
      for (const lm of e.labMarkersToDiscuss ?? []) set.add(lm);
    }
    return Array.from(set);
  }, [entries]);

  return (
    <CommandPanel label="Labs / Review" record="labs">
      <p className="tnum mb-3 text-[13px] font-semibold text-[#f2eee6]">
        {countsLine(
          [
            { count: criticalCount, label: criticalCount === 1 ? "entry blocks scheduling" : "entries block scheduling" },
            { count: optionalCount, label: "optional details" },
            { count: labMarkers.length, label: labMarkers.length === 1 ? "marker to discuss" : "markers to discuss" },
          ],
          entries.length === 0 ? "No entries to review yet" : "Nothing blocks scheduling in the entries you logged",
        )}
      </p>

      {criticalCount > 0 && (
        <>
          <GroupLabel color={AMBER}>Needs review · blocks scheduling</GroupLabel>
          <RowList label="Needs review">
            {rows.filter(({ flags }) => flags.length > 0).map(({ entry, flags }) => (
              <Row
                key={entry.id}
                title={entry.displayName ?? entry.name}
                meta={classLabelFor(entry.compoundClass)}
                actions={
                  <ReserveButton tier="quiet" size="sm" icon={Pencil} onClick={() => onEdit(entry.id)}>
                    Edit
                  </ReserveButton>
                }
              >
                <p className="mt-1 text-[12px] leading-[1.5] text-white/60">{flags.join(" · ")}</p>
              </Row>
            ))}
          </RowList>
        </>
      )}

      {optionalCount > 0 && (
        <>
          <GroupLabel>Optional details · non-blocking</GroupLabel>
          <RowList label="Optional details">
            {rows.filter(({ optional }) => optional.length > 0).map(({ entry, optional }) => (
              <Row key={entry.id} title={entry.displayName ?? entry.name} meta={`${classLabelFor(entry.compoundClass)} · ${optional.length} optional`}>
                <div className="-ml-3 mt-1 flex flex-wrap gap-x-1">
                  {optional.map((note) => (
                    <ReserveButton key={note} tier="quiet" size="sm" onClick={() => onEdit(entry.id)}>
                      {note.replace(/^Optional:\s*/i, "")}
                    </ReserveButton>
                  ))}
                </div>
              </Row>
            ))}
          </RowList>
        </>
      )}

      <GroupLabel color={STEEL}>Labs to discuss</GroupLabel>
      <p className="mt-1 text-[12.5px] leading-[1.55] text-white/65">
        {labMarkers.length === 0 ? "No lab markers entered. Add markers per compound to track clinician discussions." : labMarkers.join(" · ")}
      </p>
      <p className="mt-2 text-[11px] leading-[1.5] text-white/40">Reserve does not interpret lab results. These are reminders for clinician discussion.</p>
    </CommandPanel>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   EDUCATION
   ──────────────────────────────────────────────────────────────────────── */

const EDUCATION_ROWS: Array<{ title: string; body: string }> = [
  { title: "What Reserve does", body: "Schedule reminders around your day. Track adherence, tolerance notes, symptoms, and inventory math from member-entered values. Track injection site rotation history. Track lab markers you want to discuss with your clinician." },
  { title: "What Reserve does not do", body: "Reserve does not prescribe, recommend, or adjust doses. It does not generate steroid cycles, peptide protocols, or estrogen-management instructions. It does not classify any compound as safe." },
  { title: "Source of dose", body: "Member-entered, Provider-directed, Label-directed, or Unknown. Reserve organizes the value you entered — it does not compute a starting dose." },
  { title: "Injection site rotation", body: "Reserve shows your last-used sites and surfaces the least-recently-used active site as the 'Next Rotation Candidate'. This is rotation support based on your log history, not medical injection advice." },
  { title: "Inventory math", body: "totalMg = vialVolumeMl × concentrationMgPerMl. remainingMg subtracts member-logged usage. estimatedRunoutDate = remainingMg / averageDailyUse. No dose recommendations." },
  { title: "Schedule review flags", body: "If a legacy entry's timing text mentioned a specific weekday but the structured frequency disagreed, Reserve flags it as 'Schedule needs review' and does not assume the day." },
];

function EducationTab() {
  return (
    <CommandPanel label="Education" record="education">
      <RowList label="How Reserve handles enhancement tracking">
        {EDUCATION_ROWS.map((row) => (
          <li key={row.title} className="py-3 first:pt-1 last:pb-1">
            <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/50">{row.title}</p>
            <p className="mt-1 max-w-[72ch] text-[12.5px] leading-[1.6] text-white/65">{row.body}</p>
          </li>
        ))}
      </RowList>
    </CommandPanel>
  );
}

type PickerOption = {
  id: string;
  label: string;
  sub?: string;
  group?: string;
  aliases?: string[];
  value?: string;
};

function CompoundPicker({
  label,
  value,
  placeholder,
  options,
  onPick,
}: {
  label: string;
  value: string;
  placeholder: string;
  options: PickerOption[];
  /** The search text travels with the pick, so a name searched as an alias can be kept. */
  onPick: (option: PickerOption, query: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = options.find((o) => o.value === value || o.id === value);
  const filtered = options.filter((option) => {
    const haystack = [option.label, option.sub, option.group, ...(option.aliases ?? [])].filter(Boolean).join(" ").toLowerCase();
    return haystack.includes(query.toLowerCase().trim());
  });
  const grouped = filtered.reduce<Record<string, PickerOption[]>>((acc, option) => {
    const group = option.group ?? "Custom";
    acc[group] = [...(acc[group] ?? []), option];
    return acc;
  }, {});

  return (
    <div className="relative">
      <FormField label={label}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-[#0a0c13] px-3 py-2.5 text-left text-[12px] text-[#f2eee6] outline-none transition hover:border-white/15"
        >
          <span className={selected ? "truncate" : "truncate text-white/35"}>{selected?.label ?? placeholder}</span>
          <ChevronDown size={13} className="flex-shrink-0 text-white/35" />
        </button>
      </FormField>
      {open && (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-2xl border border-white/[0.1] bg-[#080a10] shadow-2xl">
          <div className="flex items-center gap-2 border-b border-white/[0.06] px-3 py-2">
            <SearchIcon />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search official names or aliases"
              className="min-w-0 flex-1 bg-transparent text-[12px] text-[#f2eee6] outline-none placeholder:text-white/28"
            />
          </div>
          <div className="max-h-72 overflow-y-auto p-2">
            {Object.entries(grouped).map(([group, items]) => (
              <div key={group} className="mb-2 last:mb-0">
                <p className="px-2 py-1 font-mono text-[7px] uppercase tracking-[0.22em] text-white/35">{group}</p>
                <div className="grid gap-1">
                  {items.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => {
                        onPick(option, query);
                        setOpen(false);
                        setQuery("");
                      }}
                      className="rounded-lg border border-white/[0.06] bg-white/[0.025] px-2.5 py-2 text-left transition hover:border-[#a78bfa]/35 hover:bg-[#a78bfa]/[0.08]"
                    >
                      <p className="text-[12px] font-semibold text-[#f2eee6]">{option.label}</p>
                      <p className="mt-0.5 text-[10px] text-white/42">{option.sub ?? option.aliases?.join(" · ") ?? "Tracking only"}</p>
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {filtered.length === 0 && <p className="px-2 py-3 text-[11px] text-white/45">No exact match. Use custom display name below.</p>}
          </div>
        </div>
      )}
    </div>
  );
}

function SearchIcon() {
  return <Search size={12} className="text-white/35" aria-hidden="true" />;
}

function ToggleChips({ options, values, onChange }: { options: string[]; values: string[]; onChange: (values: string[]) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((option) => {
        const active = values.includes(option);
        return (
          <button
            key={option}
            type="button"
            onClick={() => onChange(active ? values.filter((v) => v !== option) : [...values, option])}
            className="rounded-md border px-2.5 py-1 font-mono text-[7.5px] uppercase tracking-[0.16em] transition"
            style={{ borderColor: active ? `${ACCENT}55` : "rgba(255,255,255,0.08)", background: active ? `${ACCENT}14` : "rgba(255,255,255,0.025)", color: active ? ACCENT : "rgba(255,255,255,0.55)" }}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}

function ScheduleRuleBuilder({ draft, onChange }: { draft: DraftEntry; onChange: (rule: CompoundScheduleRule) => void }) {
  const rule = draft.scheduleRule ?? legacyFrequencyToRule(draft.frequencyType ?? "daily", draft);
  return (
    <section className="mt-3 rounded-2xl border border-white/[0.07] bg-black/25 p-4">
      <p className="font-mono text-[8px] uppercase tracking-[0.22em] text-white/45">Custom schedule builder</p>
      <div className="mt-2 grid gap-1.5 sm:grid-cols-3">
        {SCHEDULE_RULE_OPTIONS.map((option) => {
          const active = rule.type === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange({ type: option.value, weekdays: option.value === "specific_weekdays" ? draft.daysOfWeek : undefined, anchorDate: draft.startDate })}
              className="rounded-xl border px-3 py-2 text-left transition"
              style={{ borderColor: active ? `${STEEL}55` : "rgba(255,255,255,0.08)", background: active ? `${STEEL}12` : "rgba(255,255,255,0.022)" }}
            >
              <p className="font-mono text-[7.5px] uppercase tracking-[0.18em]" style={{ color: active ? STEEL : "rgba(255,255,255,0.62)" }}>{option.label}</p>
              <p className="mt-0.5 text-[10px] leading-[1.4] text-white/42">{option.sub}</p>
            </button>
          );
        })}
      </div>
      {(rule.type === "every_x_days" || rule.type === "every_x_weeks") && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <FormField label={rule.type === "every_x_days" ? "Every X days" : "Every X weeks"}>
            <input type="number" min={1} value={rule.type === "every_x_days" ? rule.intervalDays ?? "" : rule.intervalWeeks ?? ""} onChange={(e) => onChange({ ...rule, [rule.type === "every_x_days" ? "intervalDays" : "intervalWeeks"]: e.target.value === "" ? undefined : parseInt(e.target.value, 10) })} className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[12px] text-[#f2eee6] outline-none focus:border-white/20" />
          </FormField>
          <FormField label="Anchor date">
            <input type="date" value={rule.anchorDate ?? ""} onChange={(e) => onChange({ ...rule, anchorDate: e.target.value || undefined })} className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[12px] text-[#f2eee6] outline-none focus:border-white/20" />
          </FormField>
        </div>
      )}
      {rule.type === "on_off_cycle" && (
        <div className="mt-3 grid gap-3 sm:grid-cols-3" data-compound="on-off-cycle">
          <FormField label="Days on">
            <input type="number" min={1} max={60} aria-label="Days on" value={rule.daysOn ?? ""} onChange={(e) => onChange({ ...rule, daysOn: e.target.value === "" ? undefined : Math.max(1, Math.min(60, parseInt(e.target.value, 10) || 1)) })} className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[12px] text-[#f2eee6] outline-none focus:border-white/20" />
          </FormField>
          <FormField label="Days off">
            <input type="number" min={0} max={60} aria-label="Days off" value={rule.daysOff ?? ""} onChange={(e) => onChange({ ...rule, daysOff: e.target.value === "" ? undefined : Math.max(0, Math.min(60, parseInt(e.target.value, 10) || 0)) })} className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[12px] text-[#f2eee6] outline-none focus:border-white/20" />
          </FormField>
          <FormField label="Anchor date (first day on)">
            <input type="date" aria-label="Anchor date" value={rule.anchorDate ?? ""} onChange={(e) => onChange({ ...rule, anchorDate: e.target.value || undefined })} className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[12px] text-[#f2eee6] outline-none focus:border-white/20" />
          </FormField>
        </div>
      )}
      {rule.type === "custom_training_tags" && (
        <FormField label="Custom training tags" className="mt-3">
          <input value={(rule.trainingTags ?? []).join(", ")} onChange={(e) => onChange({ ...rule, trainingTags: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} placeholder="upper, lower, conditioning" className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[12px] text-[#f2eee6] outline-none placeholder:text-white/25 focus:border-white/20" />
        </FormField>
      )}
      {rule.type === "custom_date_sequence" && (
        <FormField label="Custom date sequence" className="mt-3">
          <input value={(rule.dateSequence ?? []).join(", ")} onChange={(e) => onChange({ ...rule, dateSequence: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} placeholder="2026-06-01, 2026-06-05" className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[12px] text-[#f2eee6] outline-none placeholder:text-white/25 focus:border-white/20" />
        </FormField>
      )}
    </section>
  );
}

function legacyFrequencyToRule(type: EnhancementFrequencyType, draft: DraftEntry): CompoundScheduleRule {
  if (type === "daily") return { type: "daily" };
  if (type === "training_only") return { type: "training_days_only" };
  if (type === "rest_only") return { type: "rest_days_only" };
  if (type === "custom") return { type: "manual_only" };
  return { type: "specific_weekdays", weekdays: draft.daysOfWeek ?? [] };
}

function ruleToLegacyFrequency(rule: CompoundScheduleRule): EnhancementFrequencyType {
  if (rule.type === "daily") return "daily";
  if (rule.type === "training_days_only" || rule.type === "all_training_days" || rule.type === "all_6_training_days") return "training_only";
  if (rule.type === "rest_days_only") return "rest_only";
  if (rule.type === "manual_only") return "custom";
  if (rule.type === "specific_weekdays") return "specific_days";
  return "custom";
}

function estimateLogsPerWeek(entry: Pick<EnhancementEntry, "frequencyType" | "daysOfWeek" | "scheduleRule">): number | undefined {
  const days = estimateScheduledDaysPerWeek(entry);
  /* Each of the member's own dose times is a log. */
  return days === undefined ? undefined : days * Math.max(1, entry.scheduleRule?.doses?.length ?? 1);
}

function estimateScheduledDaysPerWeek(entry: Pick<EnhancementEntry, "frequencyType" | "daysOfWeek" | "scheduleRule">): number | undefined {
  const rule = entry.scheduleRule;
  if (rule?.type === "daily") return 7;
  if (rule?.type === "specific_weekdays") return rule.weekdays?.length || undefined;
  if (rule?.type === "all_6_training_days") return 6;
  if (rule?.type === "training_days_only" || rule?.type === "all_training_days") return 4;
  if (rule?.type === "rest_days_only") return 3;
  if (rule?.type === "every_x_days" && rule.intervalDays) return 7 / rule.intervalDays;
  if (rule?.type === "every_x_weeks" && rule.intervalWeeks) return 1 / rule.intervalWeeks;
  if (rule?.type === "on_off_cycle" && rule.daysOn) return (7 * rule.daysOn) / (rule.daysOn + (rule.daysOff ?? 0));
  if (entry.frequencyType === "daily") return 7;
  if (entry.frequencyType === "weekly" || entry.frequencyType === "specific_days") return entry.daysOfWeek?.length || 1;
  if (entry.frequencyType === "training_only") return 4;
  if (entry.frequencyType === "rest_only") return 3;
  return undefined;
}

function buildSchedulePreview(draft: DraftEntry): Array<{ key: string; label: string; status: "Due" | "Clear" | "Review" }> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(start);
    date.setDate(date.getDate() + i);
    const resolution = resolveScheduleRuleForDate(draft.scheduleRule, date, undefined, draft.startDate);
    const due = resolution ? resolution.due : false;
    return {
      key: date.toISOString(),
      label: `${weekdayShort(date.getDay())} · ${date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`,
      status: resolution?.reviewRequired ? "Review" : due ? "Due" : "Clear",
    };
  });
}

/* ────────────────────────────────────────────────────────────────────────────
   ENTRY EDITOR (catalog dropdown + full fields)
   ──────────────────────────────────────────────────────────────────────── */

type DraftEntry = Omit<EnhancementEntry, "id" | "createdAt" | "updatedAt">;

const EMPTY_DRAFT: DraftEntry = {
  name: "",
  officialName: undefined,
  displayName: undefined,
  aliases: [],
  compoundClass: undefined,
  category: "supplement",
  doseAmount: "",
  doseUnit: "",
  frequency: "",
  timingPreference: "",
  timeOfDayPreference: "unspecified",
  customTime: "",
  goalAssociation: [],
  trainingDayUse: true,
  restDayUse: true,
  clinicianOversight: false,
  sourceOfDose: "member_entered",
  sourceType: "member_entered",
  notes: "",
  toleranceNotes: "",
  sideEffectNotes: "",
  symptomNotes: "",
  labMarkersToDiscuss: [],
  isActive: true,
  frequencyType: "daily",
  daysOfWeek: [],
  scheduleRule: { type: "daily" },
  startDate: undefined,
  route: undefined,
  injectionType: undefined,
  amountSource: "manual",
  vialTotalUnit: "mg",
  syringeUnitsPerMl: 100,
};

function EntryEditor({ editingId, onClose }: { editingId: string | null; onClose: () => void }) {
  const entries = useAthleteDashboardStore((s) => s.trainingSession.enhancementLog);
  const addEnhancementEntry = useAthleteDashboardStore((s) => s.addEnhancementEntry);
  const updateEnhancementEntry = useAthleteDashboardStore((s) => s.updateEnhancementEntry);

  const existing = editingId ? entries.find((e) => e.id === editingId) : null;
  const [draft, setDraft] = useState<DraftEntry>(existing ? toDraft(existing) : EMPTY_DRAFT);
  const [doseApplied, setDoseApplied] = useState(false);
  const [showDoseWizard, setShowDoseWizard] = useState(false);
  const [catalogPick, setCatalogPick] = useState<string>(existing?.officialName ?? "");
  const [initialDraft] = useState(() => JSON.stringify({ draft, catalogPick }));
  const guard = useFormCloseGuard(JSON.stringify({ draft, catalogPick }) !== initialDraft, onClose);
  const doseAnchors = useDoseAnchors();
  const draftDoses = draft.scheduleRule?.doses;
  /* The member's own dose times live on the schedule rule; changing the day rule keeps them. */
  const setDraftDoses = (doses: CompoundDoseTiming[] | undefined) =>
    setDraft((d) => ({ ...d, scheduleRule: { ...(d.scheduleRule ?? legacyFrequencyToRule(d.frequencyType ?? "daily", d)), doses } }));
  const withDoses = (rule: CompoundScheduleRule): CompoundScheduleRule => (draftDoses ? { ...rule, doses: draftDoses } : rule);

  function applyDoseResult(result: DoseMathResult, input: DoseMathInput) {
    if (!result.ok || result.calculatedAmount === undefined) return;
    const unit = result.calculatedAmountUnit ?? "mg";
    const amountMg = unit === "mg" ? result.calculatedAmount : unit === "mcg" ? result.calculatedAmount / 1000 : undefined;
    const source: CompoundAmountSource =
      input.formType === "injectable_vial" ? "reconstitution_calculator"
      : input.formType === "injectable_ml_marked" ? "ml_calculator"
      : input.formType === "liquid_oral" ? "liquid_oral_calculator"
      : (input.formType === "tablet" || input.formType === "capsule") ? "oral_unit_calculator"
      : "manual";
    setDraft((d) => ({
      ...d,
      amountPerLogMg: amountMg ?? d.amountPerLogMg,
      amountSource: source,
      concentrationMgPerMl: result.concentrationAmountPerMl !== undefined
        ? (unit === "mcg" ? result.concentrationAmountPerMl / 1000 : result.concentrationAmountPerMl)
        : d.concentrationMgPerMl,
      unitsPlannedPerLog: result.calculatedUnitsEquivalent !== undefined
        ? Math.round(result.calculatedUnitsEquivalent * 100) / 100
        : d.unitsPlannedPerLog,
      vialTotalAmount: input.vialTotalAmount ?? d.vialTotalAmount,
      vialTotalUnit: input.vialTotalUnit && input.vialTotalUnit !== "iu" ? input.vialTotalUnit : d.vialTotalUnit,
      reconstitutionVolumeMl: input.reconstitutionVolumeMl ?? d.reconstitutionVolumeMl,
      syringeUnitsPerMl: input.syringeUnitsPerMl ?? d.syringeUnitsPerMl,
      doseAmount: amountMg !== undefined ? String(Math.round(amountMg * 1000) / 1000) : d.doseAmount,
      doseUnit: amountMg !== undefined ? "mg" : d.doseUnit,
    }));
    setDoseApplied(true);
  }
  const [intakeText, setIntakeText] = useState("");
  const extracted = useMemo(() => parseCompoundIntakeText(intakeText), [intakeText]);
  const catalogOptions = useMemo<PickerOption[]>(() => COMPOUND_CATALOG.map((c) => ({
    id: c.officialName,
    value: c.officialName,
    label: c.officialName,
    /* Show the names people actually use, so the catalog is recognisable. */
    sub: c.aliases.length > 0 ? `${c.classLabel} · ${c.aliases.slice(0, 3).join(", ")}` : c.classLabel,
    group: PICKER_GROUP_LABELS[c.compoundClass] ?? c.classLabel,
    aliases: c.aliases,
  })), []);

  function onPickCatalog(name: string, query = "") {
    setCatalogPick(name);
    if (!name) return;
    const found = COMPOUND_CATALOG.find((c) => c.officialName === name);
    if (!found) return;
    /* A member who searched "Masteron" keeps Masteron as the name they see; the official name is stored alongside. */
    const q = query.trim().toLowerCase();
    const alias = q ? found.aliases.find((a) => a.toLowerCase() === q) ?? found.aliases.find((a) => a.toLowerCase().startsWith(q)) : undefined;
    setDraft((d) => ({
      ...d,
      officialName: found.officialName,
      displayName: alias ?? (d.displayName?.trim() && d.displayName !== d.officialName ? d.displayName : found.officialName),
      aliases: found.aliases,
      compoundClass: found.compoundClass,
      category: found.category,
      route: found.routes[0],
      doseUnit: d.doseUnit || found.units[0] || "",
      name: d.name || alias || found.officialName,
    }));
  }

  function applyExtractedFields() {
    if (extracted.chips.length === 0) return;
    setDraft((d) => ({
      ...d,
      vialTotalAmount: extracted.vialTotalAmount ?? d.vialTotalAmount,
      vialTotalUnit: extracted.vialTotalUnit ?? d.vialTotalUnit,
      reconstitutionVolumeMl: extracted.reconstitutionVolumeMl ?? d.reconstitutionVolumeMl,
      vialVolumeMl: extracted.reconstitutionVolumeMl ?? d.vialVolumeMl,
      syringeUnitsPerMl: extracted.syringeUnitsPerMl ?? d.syringeUnitsPerMl,
      unitsPlannedPerLog: extracted.unitsPlannedPerLog ?? d.unitsPlannedPerLog,
      scheduleRule: extracted.scheduleRule ? { ...extracted.scheduleRule, doses: d.scheduleRule?.doses } : d.scheduleRule,
      frequencyType: extracted.scheduleRule ? "specific_days" : d.frequencyType,
      daysOfWeek: extracted.scheduleRule?.weekdays ?? d.daysOfWeek,
      timeOfDayPreference: extracted.timeOfDayPreference ?? d.timeOfDayPreference,
      timingPreference: extracted.timingPreference ?? d.timingPreference,
    }));
  }

  function toDraft(e: EnhancementEntry): DraftEntry {
    const { id: _id, createdAt: _ca, updatedAt: _ua, ...rest } = e;
    void _id; void _ca; void _ua;
    return rest;
  }

  function save() {
    const cleaned: DraftEntry = {
      ...draft,
      name: (draft.name || draft.officialName || "").trim(),
      doseAmount: draft.doseAmount.trim(),
      doseUnit: draft.doseUnit.trim(),
      frequency: draft.frequency.trim(),
      timingPreference: draft.timingPreference.trim(),
      customTime: draft.customTime?.trim() ?? "",
    };
    if (cleaned.name.length === 0) return;
    if (editingId) updateEnhancementEntry(editingId, cleaned);
    else addEnhancementEntry(cleaned);
    onClose();
  }

  const isInjectable = draft.route === "injectable";
  const showDayPicker = draft.frequencyType === "weekly" || draft.frequencyType === "specific_days" || draft.scheduleRule?.type === "specific_weekdays";
  const reconstitution = computeReconstitution({
    vialTotalAmount: draft.vialTotalAmount,
    unit: draft.vialTotalUnit,
    reconstitutionVolumeMl: draft.reconstitutionVolumeMl ?? draft.vialVolumeMl,
    unitsPerMl: draft.syringeUnitsPerMl,
    unitsPlannedPerLog: draft.unitsPlannedPerLog,
    amountPerLogOverrideMg: draft.amountSource === "manual" ? draft.amountPerLogMg : undefined,
    vialCount: draft.vialCount,
    startingRemainingAmountMg: draft.remainingQuantityMg ?? draft.totalQuantityMg,
    reorderLeadDays: draft.reorderLeadDays,
    logsPerWeek: estimateLogsPerWeek(draft),
  });

  return (
    /* The backdrop fades in with CSS and is NOT presence-tracked.
       AnimatePresence releases a child only once every animation inside it
       has finished, so an animated backdrop is a second thing that can stall
       — and on a CPU-starved device it does, leaving the modal in the DOM
       over a dimmed screen with nothing to dismiss. Only the panel's exit
       gates removal now. */
    <div
      className="fba-scrim-in fixed inset-0 z-50 flex items-end justify-center bg-black/82 p-0 sm:items-center sm:p-4"
      style={{ backdropFilter: "blur(18px) saturate(120%)" }}
    >
      <motion.div
        className="relative w-full max-w-3xl overflow-hidden rounded-t-[28px] border border-white/[0.1] sm:rounded-[28px]"
        role="dialog"
        aria-modal="true"
        aria-label="Compound editor"
        style={{
          background: "linear-gradient(168deg, rgba(14,16,24,0.96) 0%, rgba(6,7,11,0.99) 100%)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), 0 32px 120px rgba(0,0,0,0.82)",
          maxHeight: "92vh",
        }}
        /* No exit animation, on purpose. A modal's removal must not depend on
           an animation finishing: framer stalls under CPU starvation — measured
           at 10x throttle, the panel's y reached its exit target while opacity
           never moved, so safeToRemove was never called and the modal stayed
           over a dimmed screen. Dismissal is not the place for polish. */
        initial={{ y: 44, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        onClick={(e) => e.stopPropagation()}
      >
        <DiscardChangesBar guard={guard} />
        <div className="border-b border-white/[0.06] px-5 py-4">
          <div className="flex items-center justify-between">
            <p className="font-mono text-[8px] uppercase tracking-[0.28em] text-[#a78bfa]">{editingId ? "Edit Compound" : "Add User-Defined Compound"}</p>
            <button type="button" aria-label="Close editor" onClick={guard.requestClose} className="grid min-h-[44px] min-w-[44px] place-items-center rounded-md border border-white/[0.08] bg-white/[0.03] p-1 text-white/45 transition hover:text-white/85">
              <X size={12} />
            </button>
          </div>
          <p className="mt-1.5 text-[11px] leading-[1.55] text-white/50">
            Member/provider-entered tracking only. Reserve does not prescribe or adjust dosing.
          </p>
        </div>

        <div className="max-h-[78vh] overflow-y-auto p-5">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
            <div className="grid gap-3">
              <CompoundPicker
                label="Official compound (optional)"
                value={catalogPick}
                placeholder="Search catalog or enter custom below..."
                options={catalogOptions}
                onPick={(option, query) => onPickCatalog(option.value ?? option.label, query)}
              />

              <section className="rounded-2xl border border-white/[0.07] bg-black/25 p-4">
                <div className="flex items-center gap-2">
                  <ClipboardPaste size={12} className="text-[#7dd3ee]" />
                  <p className="font-mono text-[8px] uppercase tracking-[0.22em] text-white/45">Paste what you know</p>
                </div>
                <textarea
                  rows={2}
                  value={intakeText}
                  onChange={(e) => setIntakeText(e.target.value)}
                  placeholder="10 mg vial, reconstituted with 2 mL, U100 syringe, 10 units, Sundays before breakfast"
                  className="mt-2 w-full resize-none rounded-xl border border-white/[0.08] bg-[#0a0c13] px-3 py-2 text-[12px] text-[#f2eee6] outline-none placeholder:text-white/25 focus:border-white/20"
                />
                {intakeText.trim().length > 0 && (
                  <div className="mt-2 grid gap-2">
                    <div className="flex flex-wrap gap-1.5">
                      {extracted.chips.map((chip) => (
                        <span key={chip} className="rounded-full border border-[#7dd3ee]/25 bg-[#7dd3ee]/[0.08] px-2 py-0.5 font-mono text-[7.5px] uppercase tracking-[0.16em] text-[#7dd3ee]">{chip}</span>
                      ))}
                      {extracted.needsReview.map((item) => (
                        <span key={item} className="rounded-full border border-[#e8c87a]/30 bg-[#e8c87a]/[0.08] px-2 py-0.5 font-mono text-[7.5px] uppercase tracking-[0.16em] text-[#e8c87a]">Needs Review</span>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={applyExtractedFields}
                      disabled={extracted.chips.length === 0}
                      className="w-fit rounded-lg border px-3 py-1.5 font-mono text-[8px] uppercase tracking-[0.2em] transition disabled:opacity-40"
                      style={{ borderColor: `${STEEL}45`, background: `${STEEL}12`, color: STEEL }}
                    >
                      Apply extracted fields
                    </button>
                  </div>
                )}
              </section>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <FormField label="Display name">
              <input
                type="text"
                value={draft.displayName ?? draft.name}
                onChange={(e) => setDraft({ ...draft, displayName: e.target.value, name: draft.name || e.target.value })}
                placeholder="e.g. Retatrutide"
                className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[12px] text-[#f2eee6] outline-none placeholder:text-white/25 focus:border-white/20"
              />
            </FormField>
            <FormField label="Nickname (hidden by default)">
              <input
                type="text"
                value={(draft.aliases ?? []).join(", ")}
                onChange={(e) => setDraft({ ...draft, aliases: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                placeholder="optional"
                className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[12px] text-[#f2eee6] outline-none placeholder:text-white/25 focus:border-white/20"
              />
            </FormField>
            <FormField label="Category">
              <ReserveSelect
                srLabel="Category"
                value={draft.category}
                options={[
                  { value: "supplement", label: "Supplement" },
                  { value: "peptide", label: "Peptide" },
                  { value: "hormone", label: "Hormones / AAS" },
                  { value: "medication", label: "Medication" },
                  { value: "vitamin", label: "Vitamin" },
                  { value: "nootropic", label: "Nootropic" },
                  { value: "recovery", label: "Recovery" },
                  { value: "other", label: "Other" },
                ]}
                onChange={(v) =>
                  setDraft({
                    ...draft,
                    category: v as EnhancementCategory,
                    compoundClass: draft.compoundClass ?? classKeyFromCategory(v as EnhancementCategory),
                  })
                }
              />
            </FormField>
            <FormField label="Route">
              <ReserveSelect
                srLabel="Route"
                value={draft.route ?? ""}
                options={[{ value: "", label: "Not set" }, ...ROUTE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))]}
                onChange={(v) => setDraft({ ...draft, route: (v || undefined) as CompoundRoute | undefined })}
              />
            </FormField>
            {isInjectable && (
              <FormField label="Injection type">
                <ReserveSelect
                  srLabel="Injection type"
                  value={draft.injectionType ?? ""}
                  options={[{ value: "", label: "Not set" }, ...INJECTION_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))]}
                  onChange={(v) => setDraft({ ...draft, injectionType: (v || undefined) as CompoundInjectionType | undefined })}
                />
              </FormField>
            )}
            <FormField label="Source type">
              <ReserveSelect
                srLabel="Source type"
                value={draft.sourceType ?? "member_entered"}
                options={SOURCE_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                onChange={(v) => setDraft({ ...draft, sourceType: v as CompoundSourceType })}
              />
            </FormField>
            <FormField label="Source of dose">
              <ReserveSelect
                srLabel="Source of dose"
                value={draft.sourceOfDose ?? "member_entered"}
                options={SOURCE_OF_DOSE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                onChange={(v) => setDraft({ ...draft, sourceOfDose: v as EnhancementDoseSource })}
              />
            </FormField>
          </div>

          {/* DOSE */}
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <FormField label="Member-entered amount">
              <input type="text" value={draft.doseAmount} onChange={(e) => setDraft({ ...draft, doseAmount: e.target.value })} placeholder="e.g. 5" className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[12px] text-[#f2eee6] outline-none placeholder:text-white/25 focus:border-white/20" />
            </FormField>
            <FormField label="Unit">
              <input type="text" value={draft.doseUnit} onChange={(e) => setDraft({ ...draft, doseUnit: e.target.value })} placeholder="mg · mcg · iu · mL · g" className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[12px] text-[#f2eee6] outline-none placeholder:text-white/25 focus:border-white/20" />
              {/* Each amount is per time; with more than one time a day, the day adds up here. */}
              {timesPerDay(draft) > 1 && dailyAmountLabel(draft) && (
                <span data-compound="daily-amount" className="tnum mt-1 block text-[11px] text-white/60">{dailyAmountLabel(draft)}</span>
              )}
            </FormField>
            <FormField label="Start date">
              <input type="date" value={draft.startDate ?? ""} onChange={(e) => setDraft({ ...draft, startDate: e.target.value || undefined })} className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[12px] text-[#f2eee6] outline-none focus:border-white/20" />
            </FormField>
          </div>

          {/* FREQUENCY */}
          <FormField label="Frequency" className="mt-3">
            <div className="grid gap-1.5 sm:grid-cols-3">
              {FREQUENCY_OPTIONS.map((opt) => {
                const active = (draft.frequencyType ?? "daily") === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setDraft({ ...draft, frequencyType: opt.value, scheduleRule: withDoses(legacyFrequencyToRule(opt.value, draft)) })}
                    className="rounded-xl border px-3 py-2 text-left transition"
                    style={{
                      borderColor: active ? `${ACCENT}55` : "rgba(255,255,255,0.08)",
                      background: active ? `${ACCENT}14` : "rgba(255,255,255,0.022)",
                    }}
                  >
                    <p className="font-mono text-[8px] uppercase tracking-[0.2em]" style={{ color: active ? ACCENT : "rgba(255,255,255,0.65)" }}>{opt.label}</p>
                    <p className="mt-0.5 text-[10px] leading-[1.45] text-white/45">{opt.sub}</p>
                  </button>
                );
              })}
            </div>
          </FormField>

          <ScheduleRuleBuilder draft={draft} onChange={(rule) => setDraft({ ...draft, scheduleRule: withDoses(rule), frequencyType: ruleToLegacyFrequency(rule), daysOfWeek: rule.weekdays ?? draft.daysOfWeek })} />

          {showDayPicker && (
            <FormField label="Days of week" className="mt-3">
              <div className="flex flex-wrap gap-1.5">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((dayLabel, idx) => {
                  const active = (draft.daysOfWeek ?? []).includes(idx);
                  return (
                    <button
                      key={dayLabel}
                      type="button"
                      onClick={() => setDraft({
                        ...draft,
                        daysOfWeek: active ? (draft.daysOfWeek ?? []).filter((d) => d !== idx) : [...(draft.daysOfWeek ?? []), idx],
                        scheduleRule: { ...(draft.scheduleRule ?? { type: "specific_weekdays" }), type: "specific_weekdays", weekdays: active ? (draft.daysOfWeek ?? []).filter((d) => d !== idx) : [...(draft.daysOfWeek ?? []), idx] },
                      })}
                      className="rounded-md border px-2.5 py-1 font-mono text-[8px] uppercase tracking-[0.18em] transition"
                      style={{ borderColor: active ? `${ACCENT}55` : "rgba(255,255,255,0.08)", background: active ? `${ACCENT}14` : "rgba(255,255,255,0.025)", color: active ? ACCENT : "rgba(255,255,255,0.55)" }}
                    >
                      {dayLabel}
                    </button>
                  );
                })}
              </div>
            </FormField>
          )}

          {/* WHEN YOU TAKE IT — the entry's single time-of-day setting, or the member's own dose times. */}
          <section className="mt-3" data-compound="when-you-take-it">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-[7.5px] uppercase tracking-[0.22em] text-white/35">{DOSE_TIMING_COPY.heading}</span>
              <ReserveSegmented<"time-of-day" | "dose-times">
                label={DOSE_TIMING_COPY.heading}
                value={draftDoses ? "dose-times" : "time-of-day"}
                onChange={(mode) => setDraftDoses(mode === "dose-times" ? [{ anchor: "clock", time: draft.timeOfDayPreference === "custom" ? draft.customTime ?? "" : "" }] : undefined)}
                accent={STEEL}
                size="sm"
                segments={[
                  { value: "time-of-day", label: "Time of day" },
                  { value: "dose-times", label: "Set each time" },
                ]}
              />
            </div>
            {draftDoses ? (
              <div className="mt-3">
                <DoseTimingEditor doses={draftDoses} anchors={doseAnchors} onChange={setDraftDoses} />
              </div>
            ) : (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <FormField label="Time-of-day anchor">
                  <ReserveSelect
                    srLabel="Time of day preference"
                    value={draft.timeOfDayPreference ?? "unspecified"}
                    options={TIME_OF_DAY_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                    onChange={(v) => setDraft({ ...draft, timeOfDayPreference: v as EnhancementTimeOfDayPreference })}
                  />
                </FormField>
                {draft.timeOfDayPreference === "custom" ? (
                  <FormField label="Custom time (HH:MM)">
                    <input type="time" value={draft.customTime ?? ""} onChange={(e) => setDraft({ ...draft, customTime: e.target.value })} className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[12px] text-[#f2eee6] outline-none focus:border-white/20" />
                  </FormField>
                ) : (
                  <FormField label="Timing note (optional)">
                    <input type="text" value={draft.timingPreference} onChange={(e) => setDraft({ ...draft, timingPreference: e.target.value })} placeholder="With breakfast · 30 min pre-lift" className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[12px] text-[#f2eee6] outline-none placeholder:text-white/25 focus:border-white/20" />
                  </FormField>
                )}
              </div>
            )}
          </section>

          {/* INVENTORY */}
          <section className="mt-4 rounded-2xl border border-white/[0.07] bg-black/25 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="font-mono text-[8px] uppercase tracking-[0.22em] text-white/45">Reconstitution & Inventory (member-entered)</p>
              <span className="rounded-full border px-2 py-0.5 font-mono text-[7px] uppercase tracking-[0.18em]" style={{ borderColor: reconstitution.valid ? `${GREEN}35` : `${AMBER}35`, background: reconstitution.valid ? `${GREEN}10` : `${AMBER}10`, color: reconstitution.valid ? GREEN : AMBER }}>
                {reconstitution.valid ? "Calculation valid" : "Needs values"}
              </span>
            </div>
            <p className="mt-1 text-[10px] leading-[1.5] text-white/42">{CALCULATION_ONLY_COPY}</p>
            <div className="mt-2 grid gap-3 sm:grid-cols-3">
              <FormField label="Vial total amount">
                <input type="number" inputMode="decimal" value={draft.vialTotalAmount ?? ""} onChange={(e) => setDraft({ ...draft, vialTotalAmount: e.target.value === "" ? undefined : parseFloat(e.target.value) })} className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[12px] text-[#f2eee6] outline-none focus:border-white/20" />
              </FormField>
              <FormField label="Vial unit">
                <div className="flex gap-1.5">
                  {(["mg", "mcg"] as const).map((unit) => (
                    <button key={unit} type="button" onClick={() => setDraft({ ...draft, vialTotalUnit: unit })} className="flex-1 rounded-lg border px-2 py-2 font-mono text-[8px] uppercase tracking-[0.2em]" style={{ borderColor: draft.vialTotalUnit === unit ? `${ACCENT}55` : "rgba(255,255,255,0.08)", background: draft.vialTotalUnit === unit ? `${ACCENT}14` : "rgba(255,255,255,0.025)", color: draft.vialTotalUnit === unit ? ACCENT : "rgba(255,255,255,0.55)" }}>{unit}</button>
                  ))}
                </div>
              </FormField>
              <FormField label="Reconstitution volume (mL)">
                <input type="number" inputMode="decimal" value={draft.reconstitutionVolumeMl ?? ""} onChange={(e) => setDraft({ ...draft, reconstitutionVolumeMl: e.target.value === "" ? undefined : parseFloat(e.target.value), vialVolumeMl: e.target.value === "" ? draft.vialVolumeMl : parseFloat(e.target.value) })} className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[12px] text-[#f2eee6] outline-none focus:border-white/20" />
              </FormField>
              <FormField label="Syringe type">
                <div className="grid grid-cols-2 gap-1.5">
                  <button type="button" onClick={() => setDraft({ ...draft, syringeUnitsPerMl: 100 })} className="rounded-lg border px-2 py-2 font-mono text-[8px] uppercase tracking-[0.18em]" style={{ borderColor: draft.syringeUnitsPerMl === 100 ? `${ACCENT}55` : "rgba(255,255,255,0.08)", background: draft.syringeUnitsPerMl === 100 ? `${ACCENT}14` : "rgba(255,255,255,0.025)", color: draft.syringeUnitsPerMl === 100 ? ACCENT : "rgba(255,255,255,0.55)" }}>U-100</button>
                  <input type="number" inputMode="decimal" placeholder="Custom units/mL" value={draft.syringeUnitsPerMl === 100 ? "" : draft.syringeUnitsPerMl ?? ""} onChange={(e) => setDraft({ ...draft, syringeUnitsPerMl: e.target.value === "" ? undefined : parseFloat(e.target.value) })} className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-2 py-2 text-[12px] text-[#f2eee6] outline-none placeholder:text-white/25" />
                </div>
              </FormField>
              <FormField label="Units planned per log">
                <input type="number" inputMode="decimal" value={draft.unitsPlannedPerLog ?? ""} onChange={(e) => setDraft({ ...draft, unitsPlannedPerLog: e.target.value === "" ? undefined : parseFloat(e.target.value) })} className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[12px] text-[#f2eee6] outline-none focus:border-white/20" />
              </FormField>
              <FormField label="Vial count">
                <input type="number" inputMode="decimal" value={draft.vialCount ?? ""} onChange={(e) => setDraft({ ...draft, vialCount: e.target.value === "" ? undefined : parseFloat(e.target.value) })} className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[12px] text-[#f2eee6] outline-none focus:border-white/20" />
              </FormField>
              <FormField label="Vial volume (mL)">
                <input type="number" inputMode="decimal" value={draft.vialVolumeMl ?? ""} onChange={(e) => setDraft({ ...draft, vialVolumeMl: e.target.value === "" ? undefined : parseFloat(e.target.value) })} className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[12px] text-[#f2eee6] outline-none focus:border-white/20" />
              </FormField>
              <FormField label="Concentration (mg / mL)">
                <input type="number" inputMode="decimal" value={draft.concentrationMgPerMl ?? ""} onChange={(e) => setDraft({ ...draft, concentrationMgPerMl: e.target.value === "" ? undefined : parseFloat(e.target.value) })} className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[12px] text-[#f2eee6] outline-none focus:border-white/20" />
              </FormField>
              <FormField label="Amount per log (mg)">
                <input type="number" inputMode="decimal" value={draft.amountPerLogMg ?? ""} onChange={(e) => setDraft({ ...draft, amountPerLogMg: e.target.value === "" ? undefined : parseFloat(e.target.value) })} className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[12px] text-[#f2eee6] outline-none focus:border-white/20" />
              </FormField>
              <FormField label="Starting total (mg)">
                <input type="number" inputMode="decimal" value={draft.totalQuantityMg ?? ""} onChange={(e) => setDraft({ ...draft, totalQuantityMg: e.target.value === "" ? undefined : parseFloat(e.target.value) })} className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[12px] text-[#f2eee6] outline-none focus:border-white/20" />
              </FormField>
              <FormField label="Reorder lead (days)">
                <input type="number" inputMode="numeric" value={draft.reorderLeadDays ?? ""} onChange={(e) => setDraft({ ...draft, reorderLeadDays: e.target.value === "" ? undefined : parseInt(e.target.value, 10) })} className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[12px] text-[#f2eee6] outline-none focus:border-white/20" />
              </FormField>
              <FormField label="Cost per vial">
                <input type="number" inputMode="decimal" value={draft.costPerVial ?? ""} onChange={(e) => setDraft({ ...draft, costPerVial: e.target.value === "" ? undefined : parseFloat(e.target.value) })} className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[12px] text-[#f2eee6] outline-none focus:border-white/20" />
              </FormField>
              <FormField label="Expiration date">
                <input type="date" value={draft.expirationDate ?? ""} onChange={(e) => setDraft({ ...draft, expirationDate: e.target.value || undefined })} className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[12px] text-[#f2eee6] outline-none focus:border-white/20" />
              </FormField>
              <FormField label="Supplier (note)">
                <input type="text" value={draft.supplierNote ?? ""} onChange={(e) => setDraft({ ...draft, supplierNote: e.target.value })} className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[12px] text-[#f2eee6] outline-none focus:border-white/20" />
              </FormField>
              <FormField label="Storage (note)">
                <ReserveSelect
                  srLabel="Storage note"
                  value={draft.storageNote ?? ""}
                  options={[{ value: "", label: "Not set" }, ...STORAGE_OPTIONS.map((option) => ({ value: option, label: option }))]}
                  onChange={(v) => setDraft({ ...draft, storageNote: v })}
                />
              </FormField>
            </div>
            <div className="mt-3 rounded-xl border border-white/[0.06] bg-white/[0.022] p-3">
              <div className="grid gap-2 sm:grid-cols-3">
                <Fact label="Concentration">{reconstitution.concentrationMgPerMl !== null ? `${reconstitution.concentrationMgPerMl.toFixed(3)} mg/mL` : "—"}</Fact>
                <Fact label="Calculated per log">{reconstitution.mgPerLog !== null ? `${reconstitution.mgPerLog.toFixed(4)} mg · ${reconstitution.mcgPerLog?.toFixed(0)} mcg` : "—"}</Fact>
                <Fact label="Logs remaining">{reconstitution.estimatedLogsRemaining !== null ? reconstitution.estimatedLogsRemaining.toFixed(1) : "—"}</Fact>
              </div>
              <p className="mt-2 text-[10px] leading-[1.5] text-white/42">{reconstitution.formulaPreview}</p>
              {[...reconstitution.errors, ...reconstitution.warnings].map((message) => (
                <p key={message} className="mt-1 text-[10px] text-[#e8c87a]">{message}</p>
              ))}
              <button
                type="button"
                disabled={!reconstitution.valid || reconstitution.mgPerLog === null}
                onClick={() => setDraft({
                  ...draft,
                  amountPerLogMg: reconstitution.mgPerLog ?? draft.amountPerLogMg,
                  amountSource: "reconstitution_calculator",
                  concentrationMgPerMl: reconstitution.concentrationMgPerMl ?? draft.concentrationMgPerMl,
                  totalQuantityMg: reconstitution.vialTotalMg !== null ? reconstitution.vialTotalMg * (draft.vialCount ?? 1) : draft.totalQuantityMg,
                })}
                className="mt-2 rounded-lg border px-3 py-1.5 font-mono text-[8px] uppercase tracking-[0.2em] transition disabled:opacity-40"
                style={{ borderColor: `${GREEN}45`, background: `${GREEN}12`, color: GREEN }}
              >
                Use calculated amount per log
              </button>
            </div>
          </section>

          {/* DOSE MATH WIZARD — units ↔ mg/mcg, mL, tablet/capsule */}
          <section className="mt-3 rounded-2xl border border-white/[0.07] bg-white/[0.022] p-3">
            <button type="button" onClick={() => setShowDoseWizard((v) => !v)}
              className="flex w-full items-center gap-2 text-left">
              <Calculator size={13} className="text-[#d5b15f]" />
              <p className="font-mono text-[8px] uppercase tracking-[0.22em] text-[#d5b15f]/85">Dose Math Wizard</p>
              <span className="ml-auto font-mono text-[8px] uppercase tracking-[0.16em] text-white/35">{showDoseWizard ? "Hide" : "Open"}</span>
            </button>
            {doseApplied && (
              <div className="mt-2 rounded-lg border px-3 py-2" style={{ borderColor: "#79e3b545", background: "#79e3b512" }}>
                <p className="text-[10.5px] font-medium text-[#79e3b5]">Calculated amount applied to this compound.</p>
                <p className="mt-0.5 font-mono text-[8px] text-white/35">Calculation only from member-entered values. Not dosing guidance.</p>
              </div>
            )}
            {showDoseWizard && (
              <div className="mt-3">
                <DoseMathWizard onUseAmount={applyDoseResult} compact />
              </div>
            )}
          </section>

          {/* NOTES + LABS */}
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <FormField label="Notes (optional)">
              <textarea rows={2} value={draft.notes ?? ""} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} className="w-full resize-none rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[12px] text-[#f2eee6] outline-none focus:border-white/20" />
            </FormField>
            <FormField label="Tolerance notes">
              <textarea rows={2} value={draft.toleranceNotes ?? ""} onChange={(e) => setDraft({ ...draft, toleranceNotes: e.target.value })} className="w-full resize-none rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[12px] text-[#f2eee6] outline-none focus:border-white/20" />
            </FormField>
            <FormField label="Symptom notes">
              <textarea rows={2} value={draft.symptomNotes ?? ""} onChange={(e) => setDraft({ ...draft, symptomNotes: e.target.value })} className="w-full resize-none rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[12px] text-[#f2eee6] outline-none focus:border-white/20" />
            </FormField>
            <FormField label="Lab markers (comma separated)">
              <input type="text" value={(draft.labMarkersToDiscuss ?? []).join(", ")} onChange={(e) => setDraft({ ...draft, labMarkersToDiscuss: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} placeholder="e.g. Estradiol, hematocrit, lipids" className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[12px] text-[#f2eee6] outline-none focus:border-white/20" />
            </FormField>
          </div>

          {isInjectable && (
            <FormField label="Minimum site rest days (member-entered)" className="mt-3">
              <input type="number" inputMode="numeric" value={draft.minimumSiteRestDays ?? ""} onChange={(e) => setDraft({ ...draft, minimumSiteRestDays: e.target.value === "" ? undefined : parseInt(e.target.value, 10) })} className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[12px] text-[#f2eee6] outline-none focus:border-white/20" />
            </FormField>
          )}
            </div>

            <aside className="grid h-fit gap-3 xl:sticky xl:top-4">
              <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
                <div className="flex items-center gap-2">
                  <Calculator size={13} className="text-[#79e3b5]" />
                  <p className="font-mono text-[8px] uppercase tracking-[0.22em] text-white/45">Live Calculation Preview</p>
                </div>
                <div className="mt-3 grid gap-2">
                  <Fact label="Vial total">{reconstitution.vialTotalMg !== null ? `${reconstitution.vialTotalMg.toFixed(3)} mg` : "—"}</Fact>
                  <Fact label="mL per log">{reconstitution.mlPerLog !== null ? reconstitution.mlPerLog.toFixed(3) : "—"}</Fact>
                  <Fact label="Amount per log">{reconstitution.mgPerLog !== null ? `${reconstitution.mgPerLog.toFixed(4)} mg` : "—"}</Fact>
                  <Fact label="Runout">{formatDateShort(reconstitution.estimatedRunoutDate)}</Fact>
                </div>
                <p className="mt-2 text-[9.5px] leading-[1.5] text-white/35">{CALCULATION_ONLY_COPY}</p>
              </div>
              <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
                <p className="font-mono text-[8px] uppercase tracking-[0.22em] text-white/45">Schedule Preview</p>
                <div className="mt-2 grid gap-1.5">
                  {buildSchedulePreview(draft).map((item) => (
                    <div key={item.key} data-preview-status={item.status} className="flex items-center justify-between rounded-lg border border-white/[0.05] bg-black/20 px-2.5 py-2">
                      <span className="font-mono text-[8px] uppercase tracking-[0.18em] text-white/45">{item.label}</span>
                      <span className="font-mono text-[8px] uppercase tracking-[0.18em]" style={{ color: item.status === "Due" ? ACCENT : item.status === "Review" ? GOLD : "rgba(255,255,255,0.42)" }}>{item.status}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-[9.5px] leading-[1.5] text-white/35">Suggested from saved data — confirm before saving.</p>
              </div>
            </aside>
          </div>

          <p className="mt-3 text-[9.5px] leading-[1.55] text-white/35">{SAFETY_LINE}</p>

          <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
            <button type="button" onClick={guard.requestClose} className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 font-mono text-[8px] uppercase tracking-[0.2em] text-white/55 transition hover:text-white/85">Cancel</button>
            <button
              type="button"
              onClick={save}
              disabled={(draft.name || draft.displayName || draft.officialName || "").trim().length === 0}
              className="rounded-lg border px-3.5 py-2 font-mono text-[8.5px] uppercase tracking-[0.22em] transition disabled:opacity-40"
              style={{ borderColor: `${ACCENT}40`, background: `${ACCENT}14`, color: ACCENT }}
            >
              {editingId ? "Update Compound" : "Save Compound"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   INJECTION LOG MODAL
   ──────────────────────────────────────────────────────────────────────── */

export function InjectionLogModal({ entry, plannedTime, onClose }: { entry: EnhancementEntry; /** The dose slot this log records; defaults to the entry's first time today. */ plannedTime?: string; onClose: () => void }) {
  const addInjectionLog = useAthleteDashboardStore((s) => s.addInjectionLog);
  const updateEnhancementEntry = useAthleteDashboardStore((s) => s.updateEnhancementEntry);
  const logEnhancementAdherence = useAthleteDashboardStore((s) => s.logEnhancementAdherence);
  const schedulePlan = useAthleteDashboardStore((s) => s.trainingSession.schedulePlan);
  const doseAnchors = useDoseAnchors();
  const [site, setSite] = useState(INJECTION_SITES[0]);
  const [side, setSide] = useState<"left" | "right" | "center" | "">("");
  const [date, setDate] = useState(todayDateString());
  const [time, setTime] = useState(new Date().toTimeString().slice(0, 5));
  const [unitsUsed, setUnitsUsed] = useState<number | "">(entry.unitsPlannedPerLog ?? "");
  const [amountValue, setAmountValue] = useState(entry.amountPerLogMg ? String(entry.amountPerLogMg) : "");
  const [amountUnit, setAmountUnit] = useState(entry.doseUnit ?? "mg");
  const [route, setRoute] = useState<CompoundRoute>(entry.route ?? "injectable");
  const [injectionType, setInjectionType] = useState<CompoundInjectionType>(entry.injectionType ?? "subq");
  const [reactionNote, setReactionNote] = useState("");
  const [painLevel, setPainLevel] = useState<number | "">("");
  const logSnapshot = JSON.stringify([site, side, date, time, unitsUsed, amountValue, amountUnit, route, injectionType, reactionNote, painLevel]);
  const [initialLog] = useState(logSnapshot);
  /* The sheet guards the close: a changed form asks before discarding, from the
     X, Escape, a backdrop click or a drag-dismiss (ReserveBottomSheet `dirty`). */
  const dirty = logSnapshot !== initialLog;
  const calc = computeReconstitution({
    ...reconstitutionInputFromEntry(entry),
    unitsPlannedPerLog: typeof unitsUsed === "number" ? unitsUsed : entry.unitsPlannedPerLog,
    logsPerWeek: estimateLogsPerWeek(entry),
  });
  const scheduleState = computeEntryScheduleState(entry, {
    wakeTime: schedulePlan.wakeTime,
    sleepTime: schedulePlan.sleepTime,
    preferredGymTime: schedulePlan.workoutTime,
    anchors: doseAnchors,
  });
  const calculatedMgUsed = calc.mgPerLog ?? (amountValue ? parseFloat(amountValue) : undefined);

  function save() {
    addInjectionLog({
      entryId: entry.id,
      date,
      time,
      amountValue: amountValue || undefined,
      amountUnit,
      unitsUsed: unitsUsed === "" ? undefined : Number(unitsUsed),
      calculatedMgUsed,
      amountSource: entry.amountSource ?? (calc.mgPerLog !== null ? "reconstitution_calculator" : "manual"),
      route,
      injectionType,
      site,
      side: side || undefined,
      reactionNote: reactionNote || undefined,
      painLevel: painLevel === "" ? undefined : Number(painLevel),
    });
    logEnhancementAdherence({
      entryId: entry.id,
      date,
      plannedTime: plannedTime ?? scheduleState.plannedTime,
      takenStatus: "taken",
      actualTime: time,
    });
    markCompoundLogged();
    if (typeof calculatedMgUsed === "number" && Number.isFinite(calculatedMgUsed)) {
      const baseRemaining = entry.remainingQuantityMg ?? entry.totalQuantityMg;
      if (typeof baseRemaining === "number") {
        updateEnhancementEntry(entry.id, {
          remainingQuantityMg: Math.max(0, baseRemaining - calculatedMgUsed),
          partialVialRemainingMg: Math.max(0, (entry.partialVialRemainingMg ?? baseRemaining) - calculatedMgUsed),
        });
      }
    }
    onClose();
  }

  return (
    <ReserveBottomSheet
      open
      onClose={onClose}
      dirty={dirty}
      title={`Site Log · ${entry.displayName ?? entry.name}`}
      accent={ACCENT}
      footer={<SiteLogFooter onSave={save} />}
    >
      <div className="flex flex-col gap-4">
        {/* The dose itself — where and when. Site and side lead (rotation reads
           them); date and time follow, kept visible for backdating. */}
        <div className="grid gap-3.5 sm:grid-cols-2">
          <FormField label="Site"><ReserveSelect srLabel="Site" value={site} options={INJECTION_SITES.map((s) => ({ value: s, label: s }))} onChange={setSite} /></FormField>
          <FormField label="Side">
            <ReserveSegmented<"left" | "center" | "right">
              label="Injection side"
              size="sm"
              accent={ACCENT}
              value={side as "left" | "center" | "right"}
              segments={[
                { value: "left", label: "Left" },
                { value: "center", label: "Center" },
                { value: "right", label: "Right" },
              ]}
              onChange={setSide}
            />
          </FormField>
          <FormField label="Date"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-[13px] text-[#f2eee6] outline-none focus:border-white/20" /></FormField>
          <FormField label="Time"><input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-[13px] text-[#f2eee6] outline-none focus:border-white/20" /></FormField>
        </div>

        {/* Dose detail — amount and route, for when the dose varies. A note
           (how it felt) is its own disclosure, reached at a different moment. */}
        <div className="flex flex-col gap-2">
          <ReserveDisclosure summary="Add dose detail" accent={ACCENT}>
            <div className="flex flex-col gap-3 pt-1">
              <div className="rounded-xl border border-[#79e3b5]/20 bg-[#79e3b5]/[0.06] p-3">
                <p className="font-mono text-[7.5px] uppercase tracking-[0.22em] text-[#79e3b5]">Inventory decrement preview</p>
                <p className="mt-1 text-[11px] text-white/60">{calculatedMgUsed ? `${calculatedMgUsed.toFixed(4)} mg will be recorded from this log. Inventory updated from log.` : "Enter units or amount to preview inventory impact."}</p>
                <p className="mt-1 text-[9.5px] text-white/35">{CALCULATION_ONLY_COPY}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField label="Amount"><input type="text" value={amountValue} onChange={(e) => setAmountValue(e.target.value)} className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[12px] text-[#f2eee6] outline-none focus:border-white/20" /></FormField>
                <FormField label="Units used"><input type="number" inputMode="decimal" value={unitsUsed} onChange={(e) => setUnitsUsed(e.target.value === "" ? "" : parseFloat(e.target.value))} className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[12px] text-[#f2eee6] outline-none focus:border-white/20" /></FormField>
                <FormField label="Unit"><input type="text" value={amountUnit} onChange={(e) => setAmountUnit(e.target.value)} className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[12px] text-[#f2eee6] outline-none focus:border-white/20" /></FormField>
                <FormField label="Route"><ReserveSelect srLabel="Route" value={route} options={ROUTE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))} onChange={(v) => setRoute(v as CompoundRoute)} /></FormField>
                <FormField label="Injection type"><ReserveSelect srLabel="Injection type" value={injectionType} options={INJECTION_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))} onChange={(v) => setInjectionType(v as CompoundInjectionType)} /></FormField>
              </div>
            </div>
          </ReserveDisclosure>
          <ReserveDisclosure summary="Add a note" accent={ACCENT}>
            <div className="grid gap-3 pt-1 sm:grid-cols-2">
              <FormField label="Reaction note"><input type="text" value={reactionNote} onChange={(e) => setReactionNote(e.target.value)} placeholder="None / minor / etc." className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[12px] text-[#f2eee6] outline-none focus:border-white/20" /></FormField>
              <FormField label="Pain (0–10)"><input type="number" min={0} max={10} value={painLevel} onChange={(e) => setPainLevel(e.target.value === "" ? "" : parseInt(e.target.value, 10))} className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[12px] text-[#f2eee6] outline-none focus:border-white/20" /></FormField>
            </div>
          </ReserveDisclosure>
        </div>

        {/* Save decrements inventory, so the consequence stays visible even when
           the detail disclosure is closed — never a silent side effect. */}
        {typeof calculatedMgUsed === "number" && Number.isFinite(calculatedMgUsed) && (
          <p className="text-[11.5px] leading-[1.5] text-white/60">
            Records {calculatedMgUsed.toFixed(2)} mg
            {(() => {
              const base = entry.remainingQuantityMg ?? entry.totalQuantityMg;
              return typeof base === "number" ? ` · ${Math.max(0, base - calculatedMgUsed).toFixed(1)} mg left after` : "";
            })()}
          </p>
        )}
        <p className="text-[10px] leading-[1.5] text-white/45">{SAFETY_LINE}</p>
      </div>
    </ReserveBottomSheet>
  );
}

/* The Site Log footer: Cancel closes through the sheet's own guard (so a changed
   form asks first), Save writes the log. Lives in the sheet's footer so it stays
   pinned above the keyboard and the phone safe area. */
function SiteLogFooter({ onSave }: { onSave: () => void }) {
  const close = useReserveSheetClose();
  return (
    <div className="flex items-center justify-end gap-2">
      <ReserveButton tier="quiet" size="sm" onClick={() => close?.()}>Cancel</ReserveButton>
      <ReserveButton tier="secondary" size="sm" accent={ACCENT} onClick={onSave}>Save Site Log</ReserveButton>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   SHARED PRIMITIVES
   ──────────────────────────────────────────────────────────────────────── */

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/[0.05] bg-white/[0.022] p-2.5">
      <p className="font-mono text-[7.5px] uppercase tracking-[0.22em] text-white/40">{label}</p>
      <p className="mt-0.5 text-[11.5px] leading-[1.5] text-white/75">{children}</p>
    </div>
  );
}

function FormField({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`flex flex-col gap-1 ${className}`}>
      <span className="font-mono text-[7.5px] uppercase tracking-[0.22em] text-white/35">{label}</span>
      {children}
    </label>
  );
}

type TodaySlot = ReturnType<typeof getEnhancementDailySchedule>[number];

function dateKeyOffset(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}


function scheduleDateLabel(key: string): string {
  const date = new Date(`${key}T00:00:00`);
  const today = todayDateString();
  const tomorrow = dateKeyOffset(1);
  const prefix = key === today ? "Today" : key === tomorrow ? "Tomorrow" : weekdayShort(date.getDay());
  return `${prefix} · ${date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
}


function formatLogDetails(entry: EnhancementEntry, log: InjectionLogRecord | undefined, fallbackMg?: number): string {
  if (!log) return "Logged · amount not captured";
  const pieces: string[] = [];
  if (typeof log.unitsUsed === "number") pieces.push(`${log.unitsUsed} units`);
  const mg = log.calculatedMgUsed ?? fallbackMg;
  if (typeof mg === "number" && Number.isFinite(mg)) pieces.push(`${Number(mg.toFixed(4))} mg`);
  else if (log.amountValue) pieces.push(`${log.amountValue}${log.amountUnit ? ` ${log.amountUnit}` : ""}`);
  else pieces.push("amount not captured");
  if (log.site) pieces.push(log.side ? `${log.site} · ${log.side}` : log.site);
  if (log.injectionType && log.injectionType !== "none") pieces.push(INJECTION_TYPE_OPTIONS.find((item) => item.value === log.injectionType)?.label ?? log.injectionType);
  if (log.time) pieces.push(log.time);
  if (entry.route !== "injectable" && pieces.length === 0) return "Logged";
  return pieces.join(" · ");
}

/**
 * Least-recently-used active injection site as the next rotation candidate.
 * Based on prior member logs only — not medical injection advice.
 */
function computeRotationCandidate(entry: EnhancementEntry, injectionLogs: InjectionLogRecord[]): string | null {
  if (entry.route !== "injectable") return null;
  const entryLogs = injectionLogs
    .filter((l) => l.entryId === entry.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (entryLogs.length === 0) return INJECTION_SITES[0];
  const lastUsed = entryLogs[0].site;
  const usedRecently = new Set(entryLogs.slice(0, INJECTION_SITES.length).map((l) => l.site));
  return (
    INJECTION_SITES.find((s) => s !== lastUsed && !usedRecently.has(s)) ??
    INJECTION_SITES.find((s) => s !== lastUsed) ??
    INJECTION_SITES[0]
  );
}

function ledgerStatusColor(status: CompoundLedgerStatus): string {
  switch (status) {
    case "Completed": return GREEN;
    case "Skipped": return AMBER;
    case "Missed": return RED;
    case "Review Required": return GOLD;
    case "Due Now": return GOLD;
    case "Inventory Alert": return AMBER;
    case "Site Log Needed": return STEEL;
    case "Manual Only": return "rgba(255,255,255,0.5)";
    case "Rescheduled": return STEEL;
    case "Upcoming":
    default: return ACCENT;
  }
}

function frequencyDisplay(entry: EnhancementEntry): string {
  const ft = entry.frequencyType ?? "daily";
  if (ft === "daily") return "Daily";
  if (ft === "training_only") return "Training days only";
  if (ft === "rest_only") return "Rest days only";
  if (ft === "custom") return "Custom · you log";
  const days = (entry.daysOfWeek ?? []).slice().sort((a, b) => a - b).map((d) => weekdayShort(d));
  if (days.length === 0) return ft === "weekly" ? "Weekly · day not set" : "Days not set";
  if (days.length === 7) return "Daily";
  return days.join(" · ");
}
