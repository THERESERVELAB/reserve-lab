"use client";

import {
  Archive,
  ArrowDown,
  ArrowUp,
  BookOpen,
  Check,
  ChevronRight,
  ClipboardPaste,
  Copy,
  Dumbbell,
  FileUp,
  History,
  Library,
  Lock,
  Play,
  Plus,
  RefreshCw,
  Save,
  ScanSearch,
  ShieldCheck,
  Trash2,
  Unlock,
  X,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { GlassPanel } from "@/components/ui/GlassPanel";
import {
  DETAIL_BAND_BLEED,
  DiscardChangesBar,
  ReserveDetailImage,
  ReserveDisclosure,
  ReserveSectionHeader,
  ReserveSegmented,
  ReserveSelect,
  useDirtySnapshot,
  useFormCloseGuard,
} from "@/components/ui/reserve";
import { localDateKey } from "@/lib/dates/local-day";
import { useAthleteDashboardStore } from "@/lib/athlete-store";
import {
  detectProgramInconsistencies,
  type ProgramInconsistencyObservation,
} from "@/lib/lifestyle/adherence-engine";
import {
  deriveDetailedProgramExposure,
  DETAILED_MUSCLE_REGIONS,
} from "@/lib/lifestyle/exposure-engine";
import {
  INTENSITY_TECHNIQUE_LABELS,
  WEEK_KIND_LABELS,
  isoWeekKey,
  lifestyleId,
  rotationDayLabel,
  type CustomWorkoutMovement,
  type CustomWorkoutTemplate,
  type WeekKind,
} from "@/lib/lifestyle/types";
import {
  auditProgramDay,
  compareProgramDays,
  createProgramFromSchedule,
  createReserveProgram,
  parseProgramText,
  programRotationIndex,
} from "@/lib/program/engine";
import {
  PROGRAM_MODE_DESCRIPTIONS,
  PROGRAM_OWNERSHIP_LABELS,
  type ImportedProgramDraft,
  type ProgramDayChangeScope,
  type ProgramDayDefinition,
  type ProgramDaySessionType,
  type ProgramDefinition,
  type ProgramOperatingMode,
  type ProgramRecommendationCategory,
} from "@/lib/program/types";
import { MOVEMENT_LIBRARY } from "@/lib/training/prescription-engine";
import type { WorkoutDemandLevel } from "@/lib/training/workout-demand";

import { BUILD_STUDIO_ANCHOR } from "./builder-anchors";

const GOLD = "#d5b15f";
const STEEL = "#5fb7d5";
const GREEN = "#6ee7b7";
const AMBER = "#e8c87a";
const FIELD = "w-full rounded-xl border border-white/[0.08] bg-black/25 px-3 py-2.5 text-[16px] text-white/80 outline-none transition focus:border-[#d5b15f]/40";
const LABEL = "font-mono text-[8px] uppercase tracking-[0.2em] text-white/35";
const BUTTON = "inline-flex items-center justify-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.025] px-3 py-2 font-mono text-[8px] uppercase tracking-[0.15em] text-white/60 transition hover:border-white/20 hover:text-white";

const SESSION_TYPES: ProgramDaySessionType[] = [
  "strength", "hypertrophy", "track", "sprint", "conditioning", "sport",
  "mobility", "recovery", "rest", "custom",
];

const MODE_ORDER: ProgramOperatingMode[] = ["reserve-managed", "hybrid", "member-managed"];
/** Segment labels. The full name and its one-line meaning sit under the control. */
const MODE_SHORT: Record<ProgramOperatingMode, string> = {
  "reserve-managed": "Reserve",
  hybrid: "Hybrid",
  "member-managed": "Member",
};
const WEEK_TITLES = ["This Week", "Next Week", "Following Week", "Fourth Week"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEK_KINDS = Object.keys(WEEK_KIND_LABELS) as WeekKind[];

function weekStart(base: Date, offset: number): Date {
  const date = new Date(base);
  const mondayOffset = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - mondayOffset + offset * 7);
  date.setHours(12, 0, 0, 0);
  return date;
}

function blankDay(programId: string, programVersion: number, dayIndex: number, type: ProgramDaySessionType = "rest"): ProgramDayDefinition {
  const now = new Date().toISOString();
  const id = lifestyleId("pday");
  return {
    id,
    lineageId: id,
    programId,
    programVersion,
    dayIndex,
    title: type === "rest" ? `Day ${dayIndex + 1} · Rest` : `Day ${dayIndex + 1} · ${type}`,
    sessionType: type,
    sessionObjective: type === "rest" ? "Recovery protected" : "Member-defined session",
    primaryTargets: [],
    secondaryTargets: [],
    ownership: "member-created",
    version: 1,
    locked: false,
    preserveFromAiOverwrite: true,
    status: "active",
    createdAt: now,
    updatedAt: now,
  };
}

function blankProgram(mode: ProgramOperatingMode): ProgramDefinition {
  const now = new Date().toISOString();
  const id = lifestyleId("program");
  const days = Array.from({ length: 7 }, (_, index) => blankDay(id, 1, index, index === 0 ? "custom" : "rest"));
  return {
    id,
    lineageId: id,
    version: 1,
    name: "My Program",
    description: "Built from scratch inside Reserve.",
    status: "active",
    source: "member",
    operatingMode: mode,
    rotationLengthDays: 7,
    weekAnchor: 0,
    days,
    createdAt: now,
    updatedAt: now,
  };
}

function movementName(movement: CustomWorkoutMovement): string {
  return movement.customExerciseName
    ?? (movement.exerciseId ? MOVEMENT_LIBRARY.find((entry) => entry.id === movement.exerciseId)?.name : undefined)
    ?? "Custom Movement";
}

function freshMovement(order: number): CustomWorkoutMovement {
  return {
    id: lifestyleId("cwm"),
    customExerciseName: "",
    slotRole: "",
    order,
    warmupSets: 0,
    workingSets: 3,
    repMin: 8,
    repMax: 12,
    rirTarget: 2,
    restSeconds: 120,
    intensityTechnique: "straight-sets",
    substitutionExerciseIds: [],
  };
}

async function extractPdfProgramText(file: File): Promise<string> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(await file.arrayBuffer()));
  const result = await extractText(pdf, { mergePages: true });
  return result.text.slice(0, 30_000);
}

async function extractXlsxProgramText(file: File): Promise<string> {
  const { strFromU8, unzipSync } = await import("fflate");
  const archive = unzipSync(new Uint8Array(await file.arrayBuffer()));
  const parser = new DOMParser();
  const sharedXml = archive["xl/sharedStrings.xml"];
  const shared = sharedXml
    ? [...parser.parseFromString(strFromU8(sharedXml), "application/xml").getElementsByTagName("si")]
        .map((node) => [...node.getElementsByTagName("t")].map((textNode) => textNode.textContent ?? "").join(""))
    : [];
  const worksheetPaths = Object.keys(archive)
    .filter((path) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(path))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const sheets: string[] = [];
  for (const path of worksheetPaths) {
    const xml = archive[path];
    if (!xml) continue;
    const doc = parser.parseFromString(strFromU8(xml), "application/xml");
    const rows = [...doc.getElementsByTagName("row")].map((row) => {
      const values = [...row.getElementsByTagName("c")].map((cell) => {
        const type = cell.getAttribute("t");
        const raw = cell.getElementsByTagName("v")[0]?.textContent ?? cell.getElementsByTagName("t")[0]?.textContent ?? "";
        return type === "s" ? shared[Number(raw)] ?? raw : raw;
      });
      return values.join(" ").trim();
    }).filter(Boolean);
    if (rows.length > 0) sheets.push(rows.join("\n"));
  }
  return sheets.join("\n\n").slice(0, 30_000);
}

function ownershipTone(ownership: ProgramDayDefinition["ownership"]): string {
  if (ownership === "reserve-original") return STEEL;
  if (ownership === "reserve-optimized") return GOLD;
  if (ownership === "imported") return AMBER;
  return GREEN;
}

function ReserveConfirmationModal({
  eyebrow,
  title,
  detail,
  cancelLabel,
  confirmLabel,
  children,
  dirty = false,
  onCancel,
  onConfirm,
}: {
  eyebrow: string;
  title: string;
  detail: string;
  cancelLabel: string;
  confirmLabel: string;
  children?: ReactNode;
  /** The children hold a form the member has changed (FormCloseGuard). */
  dirty?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  /* Escape, Cancel and an outside click cancel, like every other sheet in
     Reserve — but a changed field asks first. */
  const guard = useFormCloseGuard(dirty, onCancel, { backdropClosesWhenClean: true });

  /* Portaled to <body>: rendered in place, the Build Studio GlassPanel's
     backdrop-filter became the containing block for `fixed`, so the "sheet"
     sat inside the page and the confirm button could scroll under the phone
     tab bar. */
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/80 p-0 backdrop-blur-xl sm:items-center sm:p-4" role="presentation" onClick={() => guard.requestCloseFrom("backdrop")}>
      <div className="safe-bottom max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-t-[28px] border border-white/[0.09] bg-[#090b11] shadow-[0_32px_120px_rgba(0,0,0,0.82)] sm:rounded-[28px]" role="dialog" aria-modal="true" aria-labelledby="reserve-confirmation-title" onClick={(event) => event.stopPropagation()}>
        <div className="border-b border-white/[0.06] px-5 py-5 sm:px-6">
          <p className="font-mono text-[8px] uppercase tracking-[0.24em] text-[#d5b15f]">{eyebrow}</p>
          <h3 id="reserve-confirmation-title" className="mt-1.5 text-xl font-black uppercase tracking-tight text-[#f2eee6]">{title}</h3>
          <p className="mt-2 text-[11px] leading-5 text-white/45">{detail}</p>
        </div>
        <DiscardChangesBar guard={guard} />
        {children && <div className="px-5 py-5 sm:px-6">{children}</div>}
        <div className="flex flex-col-reverse gap-2 border-t border-white/[0.06] px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
          <button type="button" onClick={guard.requestClose} className={`${BUTTON} min-h-[44px]`}>{cancelLabel}</button>
          <button type="button" onClick={onConfirm} className="min-h-[44px] rounded-xl bg-[#d5b15f] px-4 py-2.5 font-mono text-[8px] font-bold uppercase tracking-[0.16em] text-black transition hover:bg-[#e2c677]">{confirmLabel}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

type PendingConfirmation =
  | { kind: "archive-program" }
  | { kind: "restore-original" }
  | { kind: "remove-day" }
  | { kind: "activate-version"; versionId: string; version: number }
  | { kind: "rename-version"; versionId: string; version: number };

function InconsistencyCard({
  observation,
  onDecision,
}: {
  observation: ProgramInconsistencyObservation;
  onDecision: (recommendationId: string, decision: "accepted" | "modified" | "rejected" | "kept") => void;
}) {
  return (
    <div className="border-t border-white/[0.06] pt-4">
      <p className="font-mono text-[8px] uppercase tracking-[0.22em] text-[#5fb7d5]">Reserve Observation</p>
      <h4 className="mt-1.5 text-[14px] font-bold text-[#f2eee6]">{observation.title}</h4>
      <p className="mt-2 text-[11px] leading-[1.55] text-white/48">{observation.detail}</p>
      <div className="mt-3 grid gap-2 lg:grid-cols-3">
        {observation.alternatives.map((alternative) => (
          <div key={alternative.rank} className="border-l border-white/[0.08] pl-3">
            <p className="font-mono text-[7px] uppercase tracking-[0.18em] text-[#d5b15f]">{alternative.rank}. {alternative.label}</p>
            <p className="mt-1 text-[11px] font-semibold text-white/75">{alternative.title}</p>
            <p className="mt-1 text-[9.5px] leading-4 text-white/35">{alternative.tradeoff}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <button type="button" className={BUTTON} onClick={() => onDecision(`${observation.id}:${alternative.rank}`, "accepted")}>Accept</button>
              <button type="button" className={BUTTON} onClick={() => onDecision(`${observation.id}:${alternative.rank}`, "modified")}>Modify</button>
              <button type="button" className={BUTTON} onClick={() => onDecision(`${observation.id}:${alternative.rank}`, "rejected")}>Reject</button>
              <button type="button" className={BUTTON} onClick={() => onDecision(`${observation.id}:${alternative.rank}`, "kept")}>Preserve</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ProgramCommandPanel({
  weekCanvas,
  sessionsCanvas,
  intelligence,
  liveScheduleCount,
}: {
  /** The lifestyle week editor. Opens in place from the Build section. */
  weekCanvas: ReactNode;
  /** The custom session builder. */
  sessionsCanvas: ReactNode;
  /** What Reserve reads in the selected week, when one exists. */
  intelligence?: ReactNode;
  liveScheduleCount: number;
}) {
  const mode = useAthleteDashboardStore((state) => state.programOperatingMode);
  const setMode = useAthleteDashboardStore((state) => state.setProgramOperatingMode);
  const programs = useAthleteDashboardStore((state) => state.programs);
  const activeProgramId = useAthleteDashboardStore((state) => state.activeProgramId);
  const saveProgram = useAthleteDashboardStore((state) => state.saveProgram);
  const saveProgramVersion = useAthleteDashboardStore((state) => state.saveProgramVersion);
  const saveProgramStructureVersion = useAthleteDashboardStore((state) => state.saveProgramStructureVersion);
  const setActiveProgram = useAthleteDashboardStore((state) => state.setActiveProgram);
  const archiveProgram = useAthleteDashboardStore((state) => state.archiveProgram);
  const dayVersions = useAthleteDashboardStore((state) => state.programDayVersions);
  const saveDayChange = useAthleteDashboardStore((state) => state.saveProgramDayChange);
  const setDayLocked = useAthleteDashboardStore((state) => state.setProgramDayLocked);
  const restoreDayVersion = useAthleteDashboardStore((state) => state.restoreProgramDayVersion);
  const duplicateDayVersion = useAthleteDashboardStore((state) => state.duplicateProgramDayVersion);
  const renameDayVersion = useAthleteDashboardStore((state) => state.renameProgramDayVersion);
  const restoreOriginal = useAthleteDashboardStore((state) => state.restoreReserveOriginalDay);
  const archiveDayVersion = useAthleteDashboardStore((state) => state.archiveProgramDayVersion);
  const templates = useAthleteDashboardStore((state) => state.customWorkoutTemplates);
  const saveTemplate = useAthleteDashboardStore((state) => state.saveCustomWorkoutTemplate);
  const saveTemplateVersion = useAthleteDashboardStore((state) => state.saveCustomWorkoutTemplateVersion);
  const schedules = useAthleteDashboardStore((state) => state.lifestyleSchedules);
  const activeScheduleId = useAthleteDashboardStore((state) => state.activeLifestyleScheduleId);
  const assignments = useAthleteDashboardStore((state) => state.weekAssignments);
  const assignWeek = useAthleteDashboardStore((state) => state.assignWeek);
  const actualWeeks = useAthleteDashboardStore((state) => state.actualWeeks);
  const movementSelections = useAthleteDashboardStore((state) => state.movementSelections);
  const recommendationPreferences = useAthleteDashboardStore((state) => state.programRecommendationPreferences);
  const updateRecommendationPreferences = useAthleteDashboardStore((state) => state.updateProgramRecommendationPreferences);
  const recordDecision = useAthleteDashboardStore((state) => state.recordProgramRecommendationDecision);
  const saveImport = useAthleteDashboardStore((state) => state.saveImportedProgramDraft);
  const activateImport = useAthleteDashboardStore((state) => state.activateImportedProgramDraft);
  const importedDrafts = useAthleteDashboardStore((state) => state.importedProgramDrafts);
  const startProgramSession = useAthleteDashboardStore((state) => state.startSessionFromProgramDay);
  const trainingSession = useAthleteDashboardStore((state) => state.trainingSession);
  const setActiveView = useAthleteDashboardStore((state) => state.setActiveView);

  const activeProgram = programs.find((program) => program.id === activeProgramId && program.status !== "archived") ?? null;
  const activeSchedule = schedules.find((schedule) => schedule.id === activeScheduleId) ?? null;
  const [selectedDayLineage, setSelectedDayLineage] = useState<string | null>(null);
  const selectedDay = activeProgram?.days.find((day) => day.lineageId === selectedDayLineage)
    ?? activeProgram?.days[0]
    ?? null;
  const isSelectedCurrentOccurrence = Boolean(
    activeProgram
      && selectedDay
      && selectedDay.dayIndex === programRotationIndex(activeProgram, new Date()),
  );
  const [editing, setEditing] = useState(false);
  const [draftDay, setDraftDay] = useState<ProgramDayDefinition | null>(null);
  const [draftMovements, setDraftMovements] = useState<CustomWorkoutMovement[]>([]);
  const [scope, setScope] = useState<ProgramDayChangeScope | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [auditOpen, setAuditOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyPreviewId, setHistoryPreviewId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [compareOpen, setCompareOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importDraft, setImportDraft] = useState<ImportedProgramDraft | null>(null);
  const [importReviewed, setImportReviewed] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation | null>(null);
  /* A new rename opens a new pending object, so the snapshot retakes per open. */
  const renameChanged = useDirtySnapshot(renameValue, pendingConfirmation);
  const [renamingTemplateId, setRenamingTemplateId] = useState<string | null>(null);
  const [templateRenameValue, setTemplateRenameValue] = useState("");

  const selectedTemplate = selectedDay?.workoutTemplateId
    ? templates.find((template) => template.id === selectedDay.workoutTemplateId)
    : undefined;
  const selectedHistory = selectedDay
    ? dayVersions.filter((version) => version.lineageId === selectedDay.lineageId).sort((a, b) => b.version - a.version)
    : [];
  const historyPreview = historyPreviewId
    ? selectedHistory.find((version) => version.id === historyPreviewId) ?? null
    : null;
  const historyComparison = historyPreview && selectedDay
    ? compareProgramDays(historyPreview, selectedDay, templates, activeSchedule)
    : null;
  const originalDay = selectedDay
    ? dayVersions.find((version) => version.id === selectedDay.reserveOriginalDayId)
      ?? dayVersions.find((version) => version.lineageId === selectedDay.lineageId && version.ownership === "reserve-original")
    : undefined;
  const originalTemplate = originalDay?.workoutTemplateId
    ? templates.find((template) => template.id === originalDay.workoutTemplateId)
    : undefined;
  const comparison = selectedDay && originalDay
    ? compareProgramDays(originalDay, selectedDay, templates, activeSchedule)
    : null;
  const audit = selectedDay
    ? auditProgramDay({ day: selectedDay, templates, schedule: activeSchedule, preferences: recommendationPreferences })
    : null;
  const exposure = activeProgram
    ? deriveDetailedProgramExposure({ program: activeProgram, templates, schedule: activeSchedule, actualWeeks })
    : null;
  const inconsistencies = activeProgram
    ? detectProgramInconsistencies({ program: activeProgram, actualWeeks, dayVersions, movementSelections })
    : [];
  const loggedSets = Object.values(trainingSession.workoutSets).reduce((sum, sets) => sum + sets.length, 0);

  function activateFoundation(kind: "reserve" | "schedule" | "scratch" | "hybrid") {
    let program: ProgramDefinition;
    if (kind === "schedule" && activeSchedule) program = createProgramFromSchedule(activeSchedule, mode);
    else if (kind === "scratch") program = blankProgram(mode);
    else program = createReserveProgram(kind === "hybrid" ? "hybrid" : mode);
    if (kind === "hybrid") {
      setMode("hybrid");
      program = {
        ...program,
        operatingMode: "hybrid",
        name: "Hybrid Performance Week",
        days: program.days.map((day) => {
          if (day.dayIndex === 0) return { ...day, title: "Member Track", sessionType: "track", ownership: "member-created", preserveFromAiOverwrite: true };
          if (day.dayIndex === 2) return { ...day, title: "Member Legs", ownership: "member-created", preserveFromAiOverwrite: true };
          if (day.dayIndex === 5) return { ...day, title: "Member Pickleball", sessionType: "sport", ownership: "member-created", preserveFromAiOverwrite: true };
          return day;
        }),
      };
    }
    saveProgram(program);
    setSelectedDayLineage(program.days[0]?.lineageId ?? null);
    setConfirmation(`${program.name} is active. Existing history and sessions were preserved.`);
  }

  function openEditor(day: ProgramDayDefinition, templateId?: string) {
    const template = templateId ? templates.find((candidate) => candidate.id === templateId) : day.workoutTemplateId ? templates.find((candidate) => candidate.id === day.workoutTemplateId) : undefined;
    setDraftDay({
      ...day,
      workoutTemplateId: template?.id ?? day.workoutTemplateId,
      ownership: day.ownership === "reserve-original" ? "member-customized" : day.ownership,
    });
    setDraftMovements((template?.movements ?? []).map((movement) => ({ ...movement })));
    setScope(null);
    setEditing(true);
    setConfirmation(null);
  }

  function patchMovement(id: string, updates: Partial<CustomWorkoutMovement>) {
    setDraftMovements((current) => current.map((movement) => movement.id === id ? { ...movement, ...updates } : movement));
  }

  function saveEditor() {
    if (!activeProgram || !selectedDay || !draftDay || !scope) return;
    const now = new Date().toISOString();
    let workoutTemplateId = draftDay.workoutTemplateId;
    if (["strength", "hypertrophy", "custom"].includes(draftDay.sessionType) && draftMovements.length > 0) {
      const parent = draftDay.workoutTemplateId ? templates.find((template) => template.id === draftDay.workoutTemplateId) : undefined;
      const lineageId = parent?.lineageId ?? lifestyleId("cwt-lineage");
      const version = Math.max(0, ...templates.filter((template) => template.lineageId === lineageId).map((template) => template.version)) + 1;
      workoutTemplateId = lifestyleId("cwt");
      const template: CustomWorkoutTemplate = {
        id: workoutTemplateId,
        lineageId,
        parentVersionId: parent?.id,
        version,
        name: draftDay.title,
        status: "active",
        sessionObjective: draftDay.sessionObjective,
        targetMuscles: draftDay.primaryTargets,
        painObservations: draftDay.painRestrictions ?? [],
        timeAvailableMin: draftDay.expectedDurationMinutes,
        expectedDemand: draftDay.expectedDemand,
        facility: draftDay.facility,
        equipment: draftDay.equipment,
        conditioning: draftDay.conditioning,
        coreWork: draftDay.coreWork,
        mobility: draftDay.mobility,
        finisher: draftDay.finisher,
        coachingNotes: draftDay.coachingNotes,
        movements: draftMovements.map((movement, order) => ({ ...movement, order })),
        source: "member",
        createdAt: now,
        updatedAt: now,
      };
      saveTemplate(template);
    }
    saveDayChange({
      programId: activeProgram.id,
      dayId: selectedDay.id,
      scope,
      dateKey: localDateKey(new Date()),
      definition: {
        ...draftDay,
        workoutTemplateId,
        ownership: draftDay.ownership === "reserve-original" ? "member-customized" : draftDay.ownership,
        preserveFromAiOverwrite:
          draftDay.locked ||
          mode === "member-managed" ||
          ["member-customized", "member-created", "imported"].includes(draftDay.ownership),
      },
    });
    setEditing(false);
    setConfirmation(
      scope === "today-only"
        ? `${draftDay.title} is staged for today only. The permanent day is unchanged.`
        : scope === "new-program-version"
          ? `A new complete program version now contains ${draftDay.title}. The prior program remains available.`
          : `${draftDay.title} is the permanent future occurrence. Every other day was preserved.`,
    );
  }

  function structuralChange(days: ProgramDayDefinition[], updates?: Parameters<typeof saveProgramStructureVersion>[2]) {
    if (!activeProgram) return;
    saveProgramStructureVersion(activeProgram.id, days, updates);
    setSelectedDayLineage(days[0]?.lineageId ?? null);
    setConfirmation("A new complete program version was created. The prior version remains available.");
  }

  function moveDay(day: ProgramDayDefinition, direction: -1 | 1) {
    if (!activeProgram) return;
    const ordered = [...activeProgram.days].sort((a, b) => a.dayIndex - b.dayIndex);
    const index = ordered.findIndex((candidate) => candidate.id === day.id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= ordered.length) return;
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    structuralChange(ordered);
  }

  function resizeRotation(length: number) {
    if (!activeProgram) return;
    const ordered = [...activeProgram.days].sort((a, b) => a.dayIndex - b.dayIndex).slice(0, length);
    while (ordered.length < length) ordered.push(blankDay(activeProgram.id, activeProgram.version, ordered.length));
    structuralChange(ordered, { rotationLengthDays: length });
  }

  function launchSelectedDay() {
    if (!selectedDay || !activeProgram) return;
    const launchDate = new Date();
    const currentIndex = programRotationIndex(activeProgram, launchDate);
    const distance = (selectedDay.dayIndex - currentIndex + activeProgram.rotationLengthDays) % activeProgram.rotationLengthDays;
    launchDate.setDate(launchDate.getDate() + distance);
    const started = startProgramSession(localDateKey(launchDate), false);
    if (started) setActiveView("training");
    else setConfirmation(trainingSession.sessionMode === "live"
      ? "A live session already exists. Reserve preserved it; close it before launching another day."
      : "This day needs a real movement template before it can launch.");
  }

  function parseImport() {
    if (!importText.trim()) return;
    const parsed = parseProgramText(importText, "paste");
    setImportDraft(parsed);
    setImportReviewed(false);
    setImportMessage("Draft parsed. Review every day, movement, and uncertain field before activation.");
  }

  async function handleUpload(file: File | undefined) {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      setImportMessage("The file is larger than the 8 MB local review limit. Export the relevant program pages or paste the written plan.");
      return;
    }
    const extension = file.name.split(".").pop()?.toLowerCase();
    try {
      if (extension === "txt" || extension === "csv") {
        const parsed = parseProgramText(await file.text(), extension === "csv" ? "spreadsheet" : "text-file", file.name);
        setImportDraft(parsed);
        setImportReviewed(false);
        setImportMessage("Text content was parsed into a review draft. Nothing has been activated.");
        return;
      }
      if (extension === "pdf") {
        const text = await extractPdfProgramText(file);
        if (!text.trim()) throw new Error("No selectable text was found in the PDF");
        const parsed = parseProgramText(text, "pdf", file.name);
        setImportDraft({ ...parsed, uncertainFields: [...parsed.uncertainFields, "PDF layout and columns require member review"] });
        setImportReviewed(false);
        setImportMessage("Selectable PDF text was interpreted locally into a review draft. Confirm every field before activation.");
        return;
      }
      if (extension === "xlsx") {
        const text = await extractXlsxProgramText(file);
        if (!text.trim()) throw new Error("No readable worksheet cells were found");
        const parsed = parseProgramText(text, "spreadsheet", file.name);
        setImportDraft({ ...parsed, uncertainFields: [...parsed.uncertainFields, "Worksheet columns and merged cells require member review"] });
        setImportReviewed(false);
        setImportMessage("Workbook cells were interpreted locally into a review draft. Confirm every field before activation.");
        return;
      }
      throw new Error("This file type is not parsed locally");
    } catch (error) {
      const now = new Date().toISOString();
      setImportDraft({
        id: lifestyleId("import-draft"),
        name: file.name.replace(/\.[^.]+$/, ""),
        sourceKind: extension === "pdf" ? "pdf" : extension === "xlsx" || extension === "xls" ? "spreadsheet" : "text-file",
        sourceName: file.name,
        rotationLengthDays: 1,
        days: [],
        uncertainFields: [error instanceof Error ? error.message : "File parsing was unavailable", "Paste the program text or build reviewed days manually"],
        status: "draft",
        createdAt: now,
        updatedAt: now,
      });
      setImportReviewed(false);
      setImportMessage("The source reference is preserved, but Reserve did not claim uncertain content as parsed. Paste the plan text or build the reviewed days manually.");
    }
  }

  function saveAndActivateImport() {
    if (!importDraft || !importReviewed || importDraft.days.length === 0) return;
    const reviewed = { ...importDraft, status: "reviewed" as const, updatedAt: new Date().toISOString() };
    saveImport(reviewed);
    const activated = activateImport(reviewed.id);
    setImportMessage(activated
      ? "Imported program activated after review. Its days are locked from automatic changes."
      : "The draft could not activate because it has no reviewed days.");
    if (activated) {
      setImportDraft({ ...reviewed, status: "activated" });
      setImportReviewed(false);
    }
    setConfirmation(activated
      ? `${reviewed.name} is active. The reviewed import is preserved as locked member-owned days.`
      : null);
  }

  function confirmPendingAction() {
    if (!pendingConfirmation || !activeProgram || !selectedDay) return;
    if (pendingConfirmation.kind === "rename-version" && !renameValue.trim()) return;
    if (pendingConfirmation.kind === "archive-program") {
      archiveProgram(activeProgram.id, true);
      setConfirmation("The program version was archived. Its history remains restorable.");
    } else if (pendingConfirmation.kind === "restore-original") {
      restoreOriginal(activeProgram.id, selectedDay.id);
      setConfirmation("Only this day was restored. The custom version remains in history.");
    } else if (pendingConfirmation.kind === "remove-day") {
      structuralChange(activeProgram.days.filter((day) => day.id !== selectedDay.id));
    } else if (pendingConfirmation.kind === "activate-version") {
      restoreDayVersion(activeProgram.id, selectedDay.id, pendingConfirmation.versionId);
      setConfirmation(`v${pendingConfirmation.version} was activated as a new day version. The prior day remains in history.`);
    } else {
      renameDayVersion(pendingConfirmation.versionId, renameValue);
      setConfirmation(`v${pendingConfirmation.version} was renamed. Its lineage and saved content are unchanged.`);
    }
    setPendingConfirmation(null);
  }

  const currentMovementNames = selectedTemplate?.movements.map(movementName) ?? [];
  const originalMovementNames = originalTemplate?.movements.map(movementName) ?? [];
  const currentDirectSets = selectedTemplate?.movements.reduce((sum, movement) => sum + movement.workingSets, 0) ?? 0;
  const originalDirectSets = originalTemplate?.movements.reduce((sum, movement) => sum + movement.workingSets, 0) ?? 0;

  const liveTemplateCount = templates.filter((template) => template.status !== "archived").length;

  /* The four weeks Reserve can assign. Only this week is on screen; the rest
     wait behind "Plan ahead". */
  const today = new Date();
  const weekPlans = [0, 1, 2, 3].map((offset) => {
    const start = weekStart(today, offset);
    const key = isoWeekKey(start);
    const assignment = assignments.find((entry) => entry.weekKey === key);
    const write = (updates: Partial<Omit<NonNullable<typeof assignment>, "assignedAt">>) => assignWeek({
      weekKey: key,
      programId: assignment?.programId ?? activeProgramId ?? undefined,
      scheduleId: assignment?.scheduleId ?? activeScheduleId ?? undefined,
      kind: assignment?.kind ?? "standard",
      startDate: assignment?.startDate ?? localDateKey(start),
      label: assignment?.label,
      notes: assignment?.notes,
      temporaryActivityIds: assignment?.temporaryActivityIds,
      temporaryDayOverrideIds: assignment?.temporaryDayOverrideIds,
      travelConstraints: assignment?.travelConstraints,
      eventConstraints: assignment?.eventConstraints,
      availabilityNotes: assignment?.availabilityNotes,
      ...updates,
    });
    return { key, assignment, write, title: WEEK_TITLES[offset], dateLabel: `Week of ${MONTHS[start.getMonth()]} ${start.getDate()}` };
  });
  type WeekPlan = (typeof weekPlans)[number];

  const renderWeekSelects = (plan: WeekPlan) => (
    <div className="grid gap-2 sm:grid-cols-3">
      <ReserveSelect
        label="Program"
        srLabel={`Program for week ${plan.key}`}
        value={plan.assignment?.programId ?? activeProgramId ?? ""}
        options={[
          { value: "", label: "Active program" },
          ...programs
            .filter((program) => program.status !== "archived")
            .map((program) => ({ value: program.id, label: program.name, hint: `v${program.version}` })),
        ]}
        onChange={(v) => plan.write({ programId: v || undefined })}
      />
      <ReserveSelect
        label="Schedule"
        srLabel={`Schedule for week ${plan.key}`}
        value={plan.assignment?.scheduleId ?? activeScheduleId ?? ""}
        options={[
          { value: "", label: "No schedule override" },
          ...schedules
            .filter((schedule) => schedule.status !== "archived")
            .map((schedule) => ({ value: schedule.id, label: schedule.name, hint: `v${schedule.version}` })),
        ]}
        onChange={(v) => plan.write({ scheduleId: v || undefined })}
      />
      <ReserveSelect
        label="Week"
        srLabel={`Week kind for week ${plan.key}`}
        value={plan.assignment?.kind ?? "standard"}
        options={WEEK_KINDS.map((kind) => ({ value: kind, label: WEEK_KIND_LABELS[kind] }))}
        onChange={(v) => plan.write({ kind: v as WeekKind })}
      />
    </div>
  );

  const renderWeekNotes = (plan: WeekPlan) => (
    <div className="grid gap-2 sm:grid-cols-2">
      <input aria-label={`Notes for week ${plan.key}`} className={FIELD} placeholder="Week notes" value={plan.assignment?.notes ?? ""} onChange={(event) => plan.write({ notes: event.target.value })} />
      <input aria-label={`Travel constraints for week ${plan.key}`} className={FIELD} placeholder="Travel constraints" value={(plan.assignment?.travelConstraints ?? []).join(", ")} onChange={(event) => plan.write({ travelConstraints: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) })} />
      <input aria-label={`Event constraints for week ${plan.key}`} className={FIELD} placeholder="Event constraints" value={(plan.assignment?.eventConstraints ?? []).join(", ")} onChange={(event) => plan.write({ eventConstraints: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) })} />
      <input aria-label={`Availability changes for week ${plan.key}`} className={FIELD} placeholder="Availability changes" value={plan.assignment?.availabilityNotes ?? ""} onChange={(event) => plan.write({ availabilityNotes: event.target.value })} />
    </div>
  );

  return (
    <div className="grid gap-5">
      {pendingConfirmation && activeProgram && selectedDay && (
        <ReserveConfirmationModal
          eyebrow={pendingConfirmation.kind === "restore-original" ? "Restore One Day" : "Confirm Program Change"}
          title={
            pendingConfirmation.kind === "archive-program" ? `Archive ${activeProgram.name}?`
            : pendingConfirmation.kind === "remove-day" ? `Remove ${selectedDay.title}?`
            : pendingConfirmation.kind === "activate-version" ? `Activate v${pendingConfirmation.version}?`
            : pendingConfirmation.kind === "rename-version" ? `Rename v${pendingConfirmation.version}?`
            : "Restore Reserve Original?"
          }
          detail={
            pendingConfirmation.kind === "archive-program" ? "This version leaves the active canvas but remains available in program history."
            : pendingConfirmation.kind === "remove-day" ? "A complete new program version will be created without this day. Every existing version remains available."
            : pendingConfirmation.kind === "activate-version" ? "The selected history record becomes a new active day version. The current day is preserved."
            : pendingConfirmation.kind === "rename-version" ? "Only the history label changes. The movement sequence, ownership, and version lineage remain exact."
            : "Only this day changes. The current custom version remains in history, and every other program day stays untouched."
          }
          cancelLabel={pendingConfirmation.kind === "restore-original" ? "Keep My Custom Day" : "Cancel"}
          confirmLabel={
            pendingConfirmation.kind === "restore-original" ? "Restore Reserve Original"
            : pendingConfirmation.kind === "archive-program" ? "Archive Program"
            : pendingConfirmation.kind === "remove-day" ? "Create Version Without Day"
            : pendingConfirmation.kind === "rename-version" ? "Save Name"
            : "Activate New Version"
          }
          dirty={pendingConfirmation.kind === "rename-version" && renameChanged}
          onCancel={() => setPendingConfirmation(null)}
          onConfirm={confirmPendingAction}
        >
          {pendingConfirmation.kind === "rename-version" && (
            <label>
              <span className={LABEL}>Version Name</span>
              <input autoFocus className={`${FIELD} mt-2`} value={renameValue} onChange={(event) => setRenameValue(event.target.value)} />
            </label>
          )}
          {pendingConfirmation.kind === "restore-original" && originalDay && (
            <div className="grid gap-3 md:grid-cols-2">
              <div className="border-l-2 border-[#6ee7b7]/30 pl-4">
                <p className={LABEL}>Current Customized Day</p>
                <p className="mt-1.5 text-[13px] font-semibold text-white/78">{selectedDay.title}</p>
                <p className="mt-1 text-[9px] text-white/35">{currentDirectSets} planned direct sets · {currentMovementNames.length} movements</p>
                <div className="mt-3 grid gap-1.5">{currentMovementNames.map((name, index) => <p key={`${name}-${index}`} className="text-[10.5px] text-white/50">{index + 1}. {name}</p>)}</div>
              </div>
              <div className="border-l-2 border-[#5fb7d5]/30 pl-4">
                <p className={LABEL}>Reserve Original Day</p>
                <p className="mt-1.5 text-[13px] font-semibold text-white/78">{originalDay.title}</p>
                <p className="mt-1 text-[9px] text-white/35">
                  {originalTemplate
                    ? `${originalDirectSets} planned direct sets · ${originalMovementNames.length} movements`
                    : "Reserve-resolved queue · frozen when the session launches"}
                </p>
                <div className="mt-3 grid gap-1.5">
                  {originalMovementNames.length > 0
                    ? originalMovementNames.map((name, index) => <p key={`${name}-${index}`} className="text-[10.5px] text-white/50">{index + 1}. {name}</p>)
                    : <p className="text-[10.5px] leading-5 text-white/45">No persisted custom movement sequence belongs to this Reserve original. Its resolved session queue will remain immutable after launch.</p>}
                </div>
              </div>
              <p className="md:col-span-2 border-t border-white/[0.06] pt-3 text-[10px] leading-5 text-white/42">
                Persisted movements, order, and planned volume shown above will change. Your custom version is backed up in day history before the Reserve original becomes active.
              </p>
            </div>
          )}
        </ReserveConfirmationModal>
      )}
      {/* ── WHO OWNS THE SYSTEM — three cards became one segmented control ── */}
      <GlassPanel accent={GOLD} noPad phone="flush" className="md:p-5">
        <section data-lifestyle="ownership" aria-label="Who owns the system">
          <ReserveSectionHeader label="Who owns the system" accent={GOLD} />
          <ReserveSegmented
            label="Who owns the system"
            value={mode}
            onChange={setMode}
            segments={MODE_ORDER.map((option) => ({ value: option, label: MODE_SHORT[option] }))}
          />
          <p className="mt-2.5 max-w-[64ch] text-[12.5px] leading-[1.55] text-white/60">{PROGRAM_MODE_DESCRIPTIONS[mode]}</p>
          {mode === "member-managed" && (
            <ReserveDisclosure summary="Optional review categories">
              <div className="grid gap-x-2 sm:grid-cols-2 lg:grid-cols-5">
                {(Object.keys(recommendationPreferences) as ProgramRecommendationCategory[]).map((category) => (
                  <label key={category} className="flex min-h-11 items-center gap-2 px-1 text-[12px] capitalize text-white/65">
                    <input type="checkbox" checked={recommendationPreferences[category]} onChange={(event) => updateRecommendationPreferences({ [category]: event.target.checked })} className="accent-[#d5b15f]" />
                    {category.replace(/-/g, " ")}
                  </label>
                ))}
              </div>
            </ReserveDisclosure>
          )}
        </section>
      </GlassPanel>

      {/* ── THIS WEEK — the next three weeks and every note wait behind a line ── */}
      <GlassPanel accent={STEEL} noPad phone="flush" className="md:p-5">
        <section data-lifestyle="this-week" aria-label="This week">
          <ReserveSectionHeader label={`This week · ${weekPlans[0].dateLabel}`} accent={STEEL} />
          {renderWeekSelects(weekPlans[0])}
          <div className="mt-2 border-t border-white/[0.05]">
            <ReserveDisclosure summary="Add a note">{renderWeekNotes(weekPlans[0])}</ReserveDisclosure>
          </div>
          <div className="border-t border-white/[0.05]">
            <ReserveDisclosure summary={`Plan ahead · ${weekPlans.length - 1} weeks`}>
              <ul className="divide-y divide-white/[0.05]">
                {weekPlans.slice(1).map((plan) => (
                  <li key={plan.key} className="py-3 first:pt-0">
                    <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#5fb7d5]">
                      {plan.title} · {plan.dateLabel}
                    </p>
                    <div className="mt-2">{renderWeekSelects(plan)}</div>
                    <div className="mt-2">{renderWeekNotes(plan)}</div>
                  </li>
                ))}
              </ul>
            </ReserveDisclosure>
          </div>
        </section>
      </GlassPanel>

      {/* ── BUILD — each editor is one row that opens in place ── */}
      <GlassPanel accent={GOLD} noPad phone="flush" className="md:p-5">
        <ReserveDetailImage id="build-studio" className={DETAIL_BAND_BLEED} />
        <section data-lifestyle="build" aria-label="Build">
          <ReserveSectionHeader label="Build" accent={GOLD} />
          {confirmation && (
            <div role="status" className="mb-1 flex items-start justify-between gap-3 border-l-2 border-[#6ee7b7]/45 py-1 pl-3.5">
              <p className="text-[12px] leading-5 text-[#6ee7b7]/85">{confirmation}</p>
              <button type="button" aria-label="Dismiss confirmation" onClick={() => setConfirmation(null)} className="grid h-11 w-11 shrink-0 place-items-center text-white/40 hover:text-white"><X size={14} /></button>
            </div>
          )}
          <ul className="divide-y divide-white/[0.05]">
            <li id={BUILD_STUDIO_ANCHOR.week}>
              <ReserveDisclosure summary={`Week canvas · ${liveScheduleCount} ${liveScheduleCount === 1 ? "week" : "weeks"} saved`} accent={GOLD}>
                {weekCanvas}
              </ReserveDisclosure>
            </li>
            <li id={BUILD_STUDIO_ANCHOR.program}>
              <ReserveDisclosure summary={`Program canvas · ${activeProgram ? activeProgram.name : "no program active"}`}>
                <div>
                  <p className="max-w-[64ch] text-[12.5px] leading-[1.55] text-white/55">Start from Reserve, your schedule, a blank canvas or a hybrid week. Structural edits save a new version.</p>
                  <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
                    <div className="flex flex-wrap gap-2">
                      <button type="button" className={BUTTON} onClick={() => activateFoundation("reserve")}>Reserve Template</button>
                      <button type="button" className={BUTTON} disabled={!activeSchedule} title={activeSchedule ? undefined : "Build or activate a lifestyle schedule first"} onClick={() => activateFoundation("schedule")}>Lifestyle Schedule</button>
                      <button type="button" className={BUTTON} onClick={() => activateFoundation("scratch")}>Start from Scratch</button>
                      <button type="button" className={BUTTON} onClick={() => activateFoundation("hybrid")}>Hybrid Example</button>
                    </div>
                  </div>


                  {activeProgram ? (
                    <>
                      <div className="mt-5 flex flex-wrap items-center gap-2">
                        <ReserveSelect
                          srLabel="Active program"
                          className="max-w-sm flex-1"
                          value={activeProgram.id}
                          options={programs
                            .filter((program) => program.status !== "archived")
                            .map((program) => ({ value: program.id, label: program.name, hint: `v${program.version}` }))}
                          onChange={setActiveProgram}
                        />
                        <button type="button" className={BUTTON} onClick={() => saveProgramVersion(activeProgram)}><Copy size={12} /> Duplicate Version</button>
                        <button type="button" className={BUTTON} onClick={() => setPendingConfirmation({ kind: "archive-program" })}><Archive size={12} /> Archive</button>
                      </div>

                      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
                        <div className="grid gap-2">
                          {[...activeProgram.days].sort((a, b) => a.dayIndex - b.dayIndex).map((day) => {
                            const selected = day.lineageId === selectedDay?.lineageId;
                            const tone = ownershipTone(day.ownership);
                            return (
                              <button
                                key={day.id}
                                type="button"
                                onClick={() => { setSelectedDayLineage(day.lineageId); setEditing(false); }}
                                className="group grid min-h-20 grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-3 rounded-[18px] border px-3 py-3 text-left transition"
                                style={{ borderColor: selected ? `${tone}55` : "rgba(255,255,255,0.055)", background: selected ? `${tone}0a` : "rgba(255,255,255,0.014)" }}
                              >
                                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-black/25 font-mono text-[9px] uppercase tracking-[0.16em]" style={{ color: tone }}>
                                  {activeProgram.rotationLengthDays === 7 ? rotationDayLabel({ rotationLengthDays: 7, weekAnchor: activeProgram.weekAnchor }, day.dayIndex) : `D${day.dayIndex + 1}`}
                                </span>
                                <span className="min-w-0">
                                  <span className="block truncate text-[12px] font-bold text-[#f2eee6]">{day.title}</span>
                                  <span className="mt-1 block font-mono text-[7px] uppercase tracking-[0.16em]" style={{ color: tone }}>{PROGRAM_OWNERSHIP_LABELS[day.ownership]} · v{day.version}{day.locked ? " · Locked" : ""}</span>
                                </span>
                                <span className="flex items-center gap-1">
                                  <span onClick={(event) => { event.stopPropagation(); moveDay(day, -1); }} className="grid h-8 w-8 place-items-center rounded-lg text-white/30 transition hover:bg-white/[0.05] hover:text-white" role="button" aria-label={`Move ${day.title} up`}><ArrowUp size={12} /></span>
                                  <span onClick={(event) => { event.stopPropagation(); moveDay(day, 1); }} className="grid h-8 w-8 place-items-center rounded-lg text-white/30 transition hover:bg-white/[0.05] hover:text-white" role="button" aria-label={`Move ${day.title} down`}><ArrowDown size={12} /></span>
                                  <ChevronRight size={14} className="text-white/20 transition group-hover:text-white/45" />
                                </span>
                              </button>
                            );
                          })}
                        </div>
                        <div className="border-white/[0.08] max-lg:border-t max-lg:pt-4 lg:border-l lg:pl-4">
                          <p className={LABEL}>Rotation Architecture</p>
                          <div className="mt-3 grid grid-cols-2 gap-2">
                            {[7, 8, 9, 4].map((length) => (
                              <button key={length} type="button" onClick={() => resizeRotation(length)} className={BUTTON}>{length === 4 ? "3 On / 1 Off" : `${length} Day`}</button>
                            ))}
                          </div>
                          <button type="button" className={`${BUTTON} mt-3 w-full`} onClick={() => {
                            const day = blankDay(activeProgram.id, activeProgram.version, activeProgram.days.length, "custom");
                            structuralChange([...activeProgram.days, day], { rotationLengthDays: activeProgram.days.length + 1 });
                          }}><Plus size={12} /> Add Day</button>
                          <button type="button" className={`${BUTTON} mt-2 w-full`} onClick={() => {
                            const day = { ...blankDay(activeProgram.id, activeProgram.version, activeProgram.days.length, "custom"), title: "Two-a-Day", secondarySession: { title: "Second Session", sessionType: "conditioning" as const, sessionObjective: "Member-defined second session" } };
                            structuralChange([...activeProgram.days, day], { rotationLengthDays: activeProgram.days.length + 1 });
                          }}><Plus size={12} /> Add Two-a-Day</button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="mt-5 py-8 text-center">
                      <p className="text-[13px] font-semibold text-white/70">No program is active.</p>
                      <p className="mt-2 text-[10.5px] text-white/35">Choose a foundation above. Existing training history stays untouched.</p>
                    </div>
                  )}
                </div>

              {activeProgram && selectedDay && (
                <div className="mt-5 border-t border-white/[0.06] pt-4">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="font-mono text-[8px] uppercase tracking-[0.24em]" style={{ color: ownershipTone(selectedDay.ownership) }}>{PROGRAM_OWNERSHIP_LABELS[selectedDay.ownership]}</p>
                        <h3 className="mt-1 text-2xl font-black uppercase tracking-tight text-[#f2eee6]">{selectedDay.title}</h3>
                        <p className="mt-1 text-[11px] text-white/42">{selectedDay.sessionObjective}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" className={BUTTON} onClick={() => openEditor(selectedDay)}><Dumbbell size={12} /> Edit This Day</button>
                        <button type="button" className={BUTTON} onClick={() => setDayLocked(activeProgram.id, selectedDay.id, !selectedDay.locked)}>
                          {selectedDay.locked ? <Unlock size={12} /> : <Lock size={12} />}{selectedDay.locked ? "Unlock for Reserve Optimization" : "Lock My Custom Day"}
                        </button>
                        <button type="button" className={BUTTON} onClick={launchSelectedDay}><Play size={12} /> Launch Day</button>
                      </div>
                    </div>

                    {selectedDay.locked && (
                      <div className="mt-4 border-l-2 border-[#6ee7b7]/40 py-0.5 pl-3.5">
                        <p className="text-[11px] font-semibold text-[#6ee7b7]/80">Protected from automatic changes</p>
                        <p className="mt-1 text-[9.5px] text-white/38">Reserve recommendations remain optional. Unlocking does not modify the day.</p>
                      </div>
                    )}

                    <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 md:grid-cols-4">
                      {[
                        ["Session Type", selectedDay.sessionType],
                        ["Primary Targets", selectedDay.primaryTargets.join(" · ") || "Member defined"],
                        ["Expected Window", selectedDay.expectedDurationMinutes ? `${selectedDay.expectedDurationMinutes} min` : "Evidence needed"],
                        ["Source Template", selectedTemplate?.name ?? "Not assigned"],
                      ].map(([label, value]) => (
                        <div key={label} className="min-w-0">
                          <dt className={LABEL}>{label}</dt><dd className="mt-1.5 text-[12px] capitalize text-white/70">{value}</dd>
                        </div>
                      ))}
                    </dl>

                    {trainingSession.sessionMode === "live" && (
                      <div className="mt-4 border-l-2 border-white/[0.12] py-0.5 pl-3.5">
                        <p className={LABEL}>Active Session Protection</p>
                        <p className="mt-1.5 text-[11px] text-white/55">
                          {loggedSets > 0
                            ? `This session has ${loggedSets} logged set${loggedSets === 1 ? "" : "s"}. Its frozen queue stays unchanged; edits apply next occurrence.`
                            : "No progress is logged. After saving, Training Command will offer Rebuild Today or Apply Next Session."}
                        </p>
                      </div>
                    )}

                    <div className="mt-4 flex flex-wrap gap-2 border-t border-white/[0.05] pt-4">
                      <button type="button" className={BUTTON} disabled={!originalDay} title={originalDay ? undefined : "No Reserve original exists for this member-created day"} onClick={() => setCompareOpen((value) => !value)}><ScanSearch size={12} /> Compare with Reserve Original</button>
                      <button type="button" className={BUTTON} onClick={() => setAuditOpen((value) => !value)}><ShieldCheck size={12} /> Let Reserve Review This Day</button>
                      <button type="button" className={BUTTON} onClick={() => setHistoryOpen((value) => !value)}><History size={12} /> Day History</button>
                      <button type="button" className={BUTTON} disabled={!originalDay} title={originalDay ? undefined : "This day has no Reserve original"} onClick={() => setPendingConfirmation({ kind: "restore-original" })}><RefreshCw size={12} /> Restore Reserve Original</button>
                      <button type="button" className={BUTTON} disabled={activeProgram.days.length <= 1} title={activeProgram.days.length <= 1 ? "A program must keep at least one day" : undefined} onClick={() => setPendingConfirmation({ kind: "remove-day" })}><Trash2 size={12} /> Remove Day</button>
                    </div>

                    {compareOpen && comparison && (
                      <div className="mt-4 border-t border-white/[0.06] pt-4">
                        <p className={LABEL}>Compared with Reserve Original</p>
                        <dl className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                          {[
                            ["Exercises Added", comparison.addedExercises.join(", ") || "None"],
                            ["Exercises Removed", comparison.removedExercises.join(", ") || "None"],
                            ["Order Changes", comparison.orderChanges.join(", ") || "None"],
                            ["Direct Sets", `${comparison.directSetDelta >= 0 ? "+" : ""}${comparison.directSetDelta}`],
                            ["Indirect Exposure", comparison.estimatedIndirectExposureChange],
                            ["Muscle Emphasis Added", comparison.muscleEmphasisAdded.join(", ") || "None"],
                            ["Muscle Emphasis Removed", comparison.muscleEmphasisRemoved.join(", ") || "None"],
                            ["Duration", comparison.durationDeltaMinutes === null ? "Evidence needed" : `${comparison.durationDeltaMinutes >= 0 ? "+" : ""}${comparison.durationDeltaMinutes} min`],
                            ["Fatigue", comparison.fatigueChange],
                            ["Movement Patterns", comparison.movementPatternChanges.join(" · ") || "No material change"],
                            ["Equipment Added", comparison.equipmentAdded.join(", ") || "None"],
                            ["Equipment Removed", comparison.equipmentRemoved.join(", ") || "None"],
                            ["Weekly Exposure", comparison.weeklyExposureNote],
                            ["Side Activity", comparison.sideActivityNote],
                          ].map(([label, value]) => <div key={label} className="min-w-0"><dt className={LABEL}>{label}</dt><dd className="mt-1.5 text-[11.5px] leading-5 text-white/60">{value}</dd></div>)}
                        </dl>
                        <p className="mt-3 text-[9.5px] leading-4 text-white/35">{comparison.recoveryChange} {comparison.jointStressChange}</p>
                      </div>
                    )}

                    {auditOpen && audit && (
                      <div className="mt-4 border-t border-white/[0.06] pt-4">
                        <p className={LABEL}>Reserve Day Audit · Observational</p>
                        <div className="mt-2 grid gap-1">{audit.observations.map((observation) => <p key={observation} className="text-[10.5px] leading-5 text-white/48">{observation}</p>)}</div>
                        <div className="mt-3 flex flex-col divide-y divide-white/[0.06]">
                          {audit.recommendations.map((recommendation) => (
                            <div key={recommendation.id} className="py-3 first:pt-0 last:pb-0">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="max-w-2xl">
                                  <p className="font-mono text-[7px] uppercase tracking-[0.18em] text-[#d5b15f]">{recommendation.rank}. {recommendation.category.replace(/-/g, " ")}</p>
                                  <p className="mt-1 text-[12px] font-semibold text-white/75">{recommendation.title}</p>
                                  <p className="mt-1 text-[9.5px] leading-4 text-white/38">{recommendation.reason} Benefit: {recommendation.expectedBenefit} Tradeoff: {recommendation.tradeoff}</p>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                  {recommendation.patch && <button type="button" className={BUTTON} onClick={() => {
                                    saveDayChange({ programId: activeProgram.id, dayId: selectedDay.id, scope: "future-occurrences", definition: { ...selectedDay, ...recommendation.patch, ownership: "reserve-optimized" } });
                                    recordDecision({ programId: activeProgram.id, dayLineageId: selectedDay.lineageId, dayVersion: selectedDay.version, recommendationId: recommendation.id, decision: "accepted" });
                                    setConfirmation("Recommendation accepted as a new day version. The prior version remains available.");
                                  }}>Accept</button>}
                                  <button type="button" className={BUTTON} onClick={() => { openEditor(selectedDay); recordDecision({ programId: activeProgram.id, dayLineageId: selectedDay.lineageId, dayVersion: selectedDay.version, recommendationId: recommendation.id, decision: "modified" }); }}>Modify</button>
                                  <button type="button" className={BUTTON} onClick={() => { recordDecision({ programId: activeProgram.id, dayLineageId: selectedDay.lineageId, dayVersion: selectedDay.version, recommendationId: recommendation.id, decision: recommendation.category === "keep-as-built" ? "kept" : "rejected" }); setConfirmation("Decision recorded. The current day was preserved."); }}>{recommendation.category === "keep-as-built" ? "Keep" : "Reject"}</button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {historyOpen && (
                      <div className="mt-4 border-t border-white/[0.06] pt-4">
                        <p className={LABEL}>{selectedDay.title} History</p>
                        <div className="mt-2 flex flex-col divide-y divide-white/[0.06]">
                          {selectedHistory.map((version) => (
                            <div key={version.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                              <div><p className="text-[11px] font-semibold text-white/70">v{version.version} · {version.title}</p><p className="mt-0.5 font-mono text-[7px] uppercase tracking-[0.16em] text-white/30">{PROGRAM_OWNERSHIP_LABELS[version.ownership]} · {version.status}</p></div>
                              <div className="flex flex-wrap gap-1.5">
                                <button type="button" className={BUTTON} onClick={() => setHistoryPreviewId(historyPreviewId === version.id ? null : version.id)}>{historyPreviewId === version.id ? "Close" : "View"}</button>
                                <button type="button" className={BUTTON} onClick={() => setHistoryPreviewId(version.id)}>Compare</button>
                                <button type="button" className={BUTTON} onClick={() => { duplicateDayVersion(activeProgram.id, selectedDay.id, version.id); setConfirmation(`v${version.version} was duplicated as a draft day version.`); }}>Duplicate</button>
                                <button type="button" className={BUTTON} onClick={() => { setRenameValue(version.title); setPendingConfirmation({ kind: "rename-version", versionId: version.id, version: version.version }); }}>Rename</button>
                                <button type="button" className={BUTTON} onClick={() => setPendingConfirmation({ kind: "activate-version", versionId: version.id, version: version.version })}>Activate</button>
                                <button type="button" className={BUTTON} disabled={version.id === selectedDay.id} title={version.id === selectedDay.id ? "The active version cannot be archived" : undefined} onClick={() => archiveDayVersion(version.id, version.status !== "archived")}>{version.status === "archived" ? "Restore" : "Archive"}</button>
                              </div>
                            </div>
                          ))}
                        </div>
                        {historyPreview && (
                          <div className="mt-3 border-l-2 border-[#5fb7d5]/35 pl-4">
                            <p className={LABEL}>Viewing v{historyPreview.version} · {historyPreview.phaseLabel ?? "All phases"}</p>
                            <p className="mt-1.5 text-[12px] font-semibold text-white/72">{historyPreview.title}</p>
                            <p className="mt-1 text-[10px] leading-5 text-white/40">{historyPreview.sessionObjective}</p>
                            <div className="mt-3 grid gap-2 sm:grid-cols-3">
                              <p className="text-[11px] text-white/55">Type · {historyPreview.sessionType}</p>
                              <p className="text-[11px] text-white/55">Targets · {historyPreview.primaryTargets.join(", ") || "Member defined"}</p>
                              <p className="text-[11px] text-white/55">Template · {historyPreview.workoutTemplateId ?? "Reserve-resolved"}</p>
                            </div>
                            {historyComparison && (
                              <p className="mt-3 text-[9.5px] leading-5 text-white/38">
                                Versus active: {historyComparison.directSetDelta >= 0 ? "+" : ""}{historyComparison.directSetDelta} direct sets · {historyComparison.addedExercises.length} exercises in active only · {historyComparison.removedExercises.length} exercises in v{historyPreview.version} only · fatigue {historyComparison.fatigueChange}.
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                </div>
              )}

              {editing && draftDay && selectedDay && activeProgram && (
                <div className="mt-5 border-t border-white/[0.06] pt-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className={LABEL}>Edit This Day</p>
                        <p className="mt-1 text-[15px] font-semibold text-[#f2eee6]">{draftDay.title}</p>
                        <p className="mt-1 text-[12px] leading-[1.5] text-white/50">Saving asks for an explicit scope. Untouched days stay exactly as saved.</p>
                      </div>
                      <button type="button" aria-label="Close editor" className="text-white/40 hover:text-white" onClick={() => setEditing(false)}><X size={16} /></button>
                    </div>
                    <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <label><span className={LABEL}>Day Title</span><input className={`${FIELD} mt-1.5`} value={draftDay.title} onChange={(event) => setDraftDay({ ...draftDay, title: event.target.value })} /></label>
                      <ReserveSelect
                        label="Session Type"
                        value={draftDay.sessionType}
                        options={SESSION_TYPES.map((type) => ({ value: type, label: type }))}
                        onChange={(v) => setDraftDay({ ...draftDay, sessionType: v as ProgramDaySessionType })}
                      />
                      <ReserveSelect
                        label="Day Ownership"
                        value={draftDay.ownership}
                        options={[
                          { value: "reserve-optimized", label: "Reserve Optimized" },
                          { value: "member-customized", label: "Member Customized" },
                          { value: "member-created", label: "Member Created" },
                          { value: "imported", label: "Imported" },
                        ]}
                        onChange={(v) => setDraftDay({ ...draftDay, ownership: v as ProgramDayDefinition["ownership"] })}
                      />
                      <label><span className={LABEL}>Phase Label</span><input className={`${FIELD} mt-1.5`} placeholder="Travel, deload, contest prep…" value={draftDay.phaseLabel ?? ""} onChange={(event) => setDraftDay({ ...draftDay, phaseLabel: event.target.value || undefined })} /></label>
                      <label className="sm:col-span-2"><span className={LABEL}>Session Objective</span><input className={`${FIELD} mt-1.5`} value={draftDay.sessionObjective} onChange={(event) => setDraftDay({ ...draftDay, sessionObjective: event.target.value })} /></label>
                      <label><span className={LABEL}>Primary Targets</span><input className={`${FIELD} mt-1.5`} value={draftDay.primaryTargets.join(", ")} onChange={(event) => setDraftDay({ ...draftDay, primaryTargets: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) })} /></label>
                      <label><span className={LABEL}>Secondary Targets</span><input className={`${FIELD} mt-1.5`} value={draftDay.secondaryTargets.join(", ")} onChange={(event) => setDraftDay({ ...draftDay, secondaryTargets: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) })} /></label>
                      <label><span className={LABEL}>Expected Duration</span><input type="number" min={10} className={`${FIELD} mt-1.5`} value={draftDay.expectedDurationMinutes ?? ""} onChange={(event) => setDraftDay({ ...draftDay, expectedDurationMinutes: event.target.value ? Number(event.target.value) : undefined })} /></label>
                      <ReserveSelect
                        label="Workout Demand"
                        value={draftDay.expectedDemand ?? "precision"}
                        options={[
                          { value: "precision", label: "Precision" },
                          { value: "high-output", label: "High Output" },
                          { value: "elite-volume", label: "Elite Volume" },
                        ]}
                        onChange={(v) => setDraftDay({ ...draftDay, expectedDemand: v as WorkoutDemandLevel })}
                      />
                      <label><span className={LABEL}>Facility</span><input className={`${FIELD} mt-1.5`} value={draftDay.facility ?? ""} onChange={(event) => setDraftDay({ ...draftDay, facility: event.target.value })} /></label>
                      <label><span className={LABEL}>Equipment</span><input className={`${FIELD} mt-1.5`} value={(draftDay.equipment ?? []).join(", ")} onChange={(event) => setDraftDay({ ...draftDay, equipment: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) })} /></label>
                      <label><span className={LABEL}>Pain Observations</span><input className={`${FIELD} mt-1.5`} value={(draftDay.painRestrictions ?? []).join(", ")} onChange={(event) => setDraftDay({ ...draftDay, painRestrictions: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) })} /></label>
                      <label><span className={LABEL}>Performance Goal</span><input className={`${FIELD} mt-1.5`} value={draftDay.performanceGoal ?? ""} onChange={(event) => setDraftDay({ ...draftDay, performanceGoal: event.target.value })} /></label>
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      {(["conditioning", "coreWork", "mobility", "finisher"] as const).map((field) => <label key={field}><span className={LABEL}>{field.replace(/([A-Z])/g, " $1")}</span><input className={`${FIELD} mt-1.5`} value={draftDay[field] ?? ""} onChange={(event) => setDraftDay({ ...draftDay, [field]: event.target.value })} /></label>)}
                    </div>
                    <label className="mt-3 block"><span className={LABEL}>Coaching Notes</span><textarea className={`${FIELD} mt-1.5 min-h-20 resize-y`} value={draftDay.coachingNotes ?? ""} onChange={(event) => setDraftDay({ ...draftDay, coachingNotes: event.target.value })} /></label>

                    <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                      <div><p className={LABEL}>Movement Sequence</p><p className="mt-1 text-[10px] text-white/35">Warm-ups, working sets, reps, load, RIR/RPE, tempo, rest, and intensity techniques are saved into the day template.</p></div>
                      <ReserveSelect
                        srLabel="Workout template"
                        className="max-w-xs"
                        value={draftDay.workoutTemplateId ?? ""}
                        options={[
                          { value: "", label: "Build movement sequence" },
                          ...templates
                            .filter((template) => template.status !== "archived")
                            .map((template) => ({ value: template.id, label: template.name, hint: `v${template.version}` })),
                        ]}
                        onChange={(v) => {
                          const template = templates.find((candidate) => candidate.id === v);
                          setDraftDay({ ...draftDay, workoutTemplateId: template?.id });
                          setDraftMovements((template?.movements ?? []).map((movement) => ({ ...movement })));
                        }}
                      />
                    </div>
                    <div className="mt-3 flex flex-col divide-y divide-white/[0.06]">
                      {draftMovements.map((movement, index) => (
                        <div key={movement.id} className="py-3 first:pt-0">
                          <div className="grid gap-2 md:grid-cols-[28px_minmax(180px,1fr)_72px_72px_72px_72px_90px_110px_auto]">
                            <span className="grid h-9 place-items-center font-mono text-[9px] text-[#d5b15f]">{index + 1}</span>
                            <input aria-label={`Movement ${index + 1} name`} className={FIELD} value={movementName(movement)} onChange={(event) => patchMovement(movement.id, { exerciseId: undefined, customExerciseName: event.target.value })} placeholder="Movement" />
                            <input aria-label="Warm-up sets" title="Warm-up sets" type="number" min={0} className={FIELD} value={movement.warmupSets ?? 0} onChange={(event) => patchMovement(movement.id, { warmupSets: Number(event.target.value) })} />
                            <input aria-label="Working sets" title="Working sets" type="number" min={1} className={FIELD} value={movement.workingSets} onChange={(event) => patchMovement(movement.id, { workingSets: Number(event.target.value) })} />
                            <input aria-label="Minimum reps" title="Minimum reps" type="number" min={1} className={FIELD} value={movement.repMin ?? ""} onChange={(event) => patchMovement(movement.id, { repMin: Number(event.target.value) || undefined })} />
                            <input aria-label="Maximum reps" title="Maximum reps" type="number" min={1} className={FIELD} value={movement.repMax ?? ""} onChange={(event) => patchMovement(movement.id, { repMax: Number(event.target.value) || undefined })} />
                            <input aria-label="RIR target" title="RIR target" type="number" min={0} max={5} className={FIELD} value={movement.rirTarget ?? ""} onChange={(event) => patchMovement(movement.id, { rirTarget: Number(event.target.value) })} />
                            <ReserveSelect
                              srLabel={`Intensity technique for movement ${index + 1}`}
                              value={movement.intensityTechnique ?? "straight-sets"}
                              options={Object.entries(INTENSITY_TECHNIQUE_LABELS).map(([value, label]) => ({ value, label }))}
                              onChange={(v) => patchMovement(movement.id, { intensityTechnique: v as CustomWorkoutMovement["intensityTechnique"] })}
                            />
                            <button type="button" aria-label={`Remove movement ${index + 1}`} onClick={() => setDraftMovements((current) => current.filter((candidate) => candidate.id !== movement.id))} className="grid h-11 w-11 place-items-center rounded-xl text-white/40 hover:bg-white/[0.05] hover:text-white"><Trash2 size={13} /></button>
                          </div>
                          <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                            <input aria-label={`Load target for movement ${index + 1}`} className={FIELD} placeholder="Load target" type="number" value={movement.loadTarget ?? ""} onChange={(event) => patchMovement(movement.id, { loadTarget: Number(event.target.value) || undefined })} />
                            <input aria-label={`RPE target for movement ${index + 1}`} className={FIELD} placeholder="RPE target" type="number" min={1} max={10} value={movement.rpeTarget ?? ""} onChange={(event) => patchMovement(movement.id, { rpeTarget: Number(event.target.value) || undefined })} />
                            <input aria-label={`Tempo for movement ${index + 1}`} className={FIELD} placeholder="Tempo (3-1-1)" value={movement.tempo ?? ""} onChange={(event) => patchMovement(movement.id, { tempo: event.target.value })} />
                            <input aria-label={`Rest seconds for movement ${index + 1}`} className={FIELD} placeholder="Rest seconds" type="number" value={movement.restSeconds ?? ""} onChange={(event) => patchMovement(movement.id, { restSeconds: Number(event.target.value) || undefined })} />
                            <input aria-label={`Notes or substitutions for movement ${index + 1}`} className={FIELD} placeholder="Notes / substitutions" value={movement.notes ?? ""} onChange={(event) => patchMovement(movement.id, { notes: event.target.value })} />
                          </div>
                        </div>
                      ))}
                    </div>
                    <button type="button" className={`${BUTTON} mt-3`} onClick={() => setDraftMovements((current) => [...current, freshMovement(current.length)])}><Plus size={12} /> Add Movement</button>

                    <div className="mt-6 border-t border-white/[0.08] pt-4">
                      <p className={LABEL}>Choose Change Scope</p>
                      <div className="mt-3 grid gap-2 lg:grid-cols-3">
                        {([
                          ["today-only", "Today Only", "One uncompleted occurrence. The permanent day remains unchanged."],
                          ["future-occurrences", "Future Occurrences", "This day changes permanently; every other day stays exact."],
                          ["new-program-version", "Save as New Program Version", "A new complete version contains this day. The prior program remains available."],
                        ] as const).map(([value, label, detail]) => (
                          <button key={value} type="button" disabled={value === "today-only" && !isSelectedCurrentOccurrence} title={value === "today-only" && !isSelectedCurrentOccurrence ? "Today Only is available on today's scheduled day" : undefined} onClick={() => setScope(value)} className="rounded-2xl border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-35" style={{ borderColor: scope === value ? `${GOLD}60` : "rgba(255,255,255,0.06)", background: scope === value ? `${GOLD}0b` : "transparent" }}>
                            <p className="text-[11px] font-bold text-white/75">{label}</p><p className="mt-1 text-[9.5px] leading-4 text-white/35">{detail}</p>
                          </button>
                        ))}
                      </div>
                      <div className="mt-4 flex flex-wrap justify-end gap-2">
                        <button type="button" className={`${BUTTON} min-h-[44px]`} onClick={() => setEditing(false)}>Cancel</button>
                        <button type="button" disabled={!scope} title={scope ? undefined : "Choose an explicit change scope"} onClick={saveEditor} className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#d5b15f] px-4 py-2.5 font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-black transition hover:bg-[#e2c677] disabled:cursor-not-allowed disabled:opacity-35"><Save size={12} /> Save Day</button>
                      </div>
                    </div>
                </div>
              )}
              </ReserveDisclosure>
            </li>
            <li id={BUILD_STUDIO_ANCHOR.sessions}>
              <ReserveDisclosure summary={`Sessions · ${liveTemplateCount} built`}>{sessionsCanvas}</ReserveDisclosure>
            </li>
            {intelligence && (
              <li id={BUILD_STUDIO_ANCHOR.intelligence}>
                <ReserveDisclosure summary="What Reserve reads in the week">{intelligence}</ReserveDisclosure>
              </li>
            )}
            {activeProgram && exposure && (
              <li>
                <ReserveDisclosure summary="Planned versus performed">
                <div className="mt-5 border-t border-white/[0.06] pt-4">
                    <div className="mt-4 overflow-x-auto">
                      <div className="min-w-[760px]">
                        <div className="grid grid-cols-[160px_repeat(6,minmax(80px,1fr))] gap-2 px-3 font-mono text-[7px] uppercase tracking-[0.14em] text-white/28"><span>Region</span><span>Planned freq</span><span>Actual freq</span><span>Planned sets</span><span>Completed</span><span>Spacing</span><span>Side activity</span></div>
                        <div className="mt-2 grid gap-1.5">
                          {DETAILED_MUSCLE_REGIONS.filter((region) => exposure.regions[region].plannedSets > 0 || exposure.regions[region].completedSets > 0 || exposure.regions[region].sideActivityContribution !== "none").map((region) => {
                            const line = exposure.regions[region];
                            return <div key={region} className="grid grid-cols-[160px_repeat(6,minmax(80px,1fr))] items-center gap-2 rounded-xl bg-white/[0.018] px-3 py-2 text-[9.5px] text-white/48"><span className="font-semibold text-white/68">{region}</span><span>{line.plannedDirectFrequency}</span><span>{line.actualDirectFrequency}</span><span>{line.plannedSets}</span><span>{line.completedSets || "—"}</span><span>{line.minimumRecoverySpacingDays === null ? "Evidence needed" : `${line.minimumRecoverySpacingDays}d${line.backToBack ? " · overlap" : ""}`}</span><span className="capitalize">{line.sideActivityContribution}</span></div>;
                          })}
                        </div>
                      </div>
                    </div>
                    <p className="mt-3 text-[9.5px] text-white/30">Missed sessions: {exposure.missedSessions} · Moved or substituted sessions: {exposure.substitutedSessions}. Completed-set counts appear only when closeout carried real logged sets.</p>
                    {inconsistencies.length > 0 && <div className="mt-5 grid gap-3">{inconsistencies.map((observation) => <InconsistencyCard key={observation.id} observation={observation} onDecision={(recommendationId, decision) => {
                      if (!selectedDay) return;
                      recordDecision({ programId: activeProgram.id, dayLineageId: selectedDay.lineageId, dayVersion: selectedDay.version, recommendationId, decision });
                      if (decision === "modified") openEditor(selectedDay);
                      setConfirmation(decision === "accepted"
                        ? "Recommendation accepted as a member decision. Open Edit This Day to apply an exact change; Reserve did not rewrite the program silently."
                        : decision === "modified" ? "Decision recorded. The day editor is ready for your modification."
                        : decision === "kept" ? "Current structure preserved. The observation remains available for review."
                        : "Recommendation rejected. The current program remains unchanged.");
                    }} />)}</div>}
                </div>
                </ReserveDisclosure>
              </li>
            )}
          </ul>
        </section>
      </GlassPanel>

      {/* ── LIBRARY & IMPORT — two rows ── */}
      <GlassPanel accent={AMBER} noPad phone="flush" className="md:p-5">
        <section data-lifestyle="library" aria-label="Library and import">
          <ReserveSectionHeader label="Library & import" accent={AMBER} />
          <ul className="divide-y divide-white/[0.05]">
            <li>
              <ReserveDisclosure summary={`Reusable day systems · ${templates.length}`}>
                <p className="max-w-[64ch] text-[12.5px] leading-[1.55] text-white/55">Assign, duplicate, version or archive a saved movement sequence. Training Command reads the same library.</p>
                <div className="mt-2 grid gap-x-6 md:grid-cols-2 xl:grid-cols-3">
                  {templates.length === 0 ? <p className="text-[11px] text-white/35">Build a day movement sequence to create the first library entry.</p> : templates.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 12).map((template) => (
                    <div key={template.id} className="border-t border-white/[0.06] py-3.5">
                      <div className="flex items-start justify-between gap-3"><div><p className="text-[12px] font-semibold text-white/72">{template.name}</p><p className="mt-1 font-mono text-[7px] uppercase tracking-[0.16em] text-white/28">v{template.version} · {template.movements.length} movements · {template.status}</p></div><Library size={14} className="text-[#e8c87a]/65" /></div>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        <button type="button" className={BUTTON} disabled={!selectedDay} title={selectedDay ? undefined : "Select a program day first"} onClick={() => selectedDay && openEditor(selectedDay, template.id)}>Assign</button>
                        <button type="button" className={BUTTON} onClick={() => {
                          const now = new Date().toISOString();
                          const id = lifestyleId("cwt");
                          saveTemplate({ ...template, id, lineageId: id, parentVersionId: undefined, version: 1, name: `${template.name} Copy`, status: "draft", createdAt: now, updatedAt: now });
                        }}><Copy size={11} /> Duplicate</button>
                        <button type="button" className={BUTTON} onClick={() => { saveTemplateVersion(template); setConfirmation(`${template.name} was saved as a new library version.`); }}><History size={11} /> Version</button>
                        <button type="button" className={BUTTON} onClick={() => { setRenamingTemplateId(template.id); setTemplateRenameValue(template.name); }}>Rename</button>
                        <button type="button" className={BUTTON} onClick={() => saveTemplate({ ...template, status: template.status === "archived" ? "draft" : "archived" })}>{template.status === "archived" ? "Restore" : "Archive"}</button>
                      </div>
                      {renamingTemplateId === template.id && (
                        <div className="mt-3 flex gap-2">
                          <input autoFocus className={FIELD} value={templateRenameValue} onChange={(event) => setTemplateRenameValue(event.target.value)} />
                          <button type="button" className={BUTTON} disabled={!templateRenameValue.trim()} onClick={() => { saveTemplate({ ...template, name: templateRenameValue.trim() }); setRenamingTemplateId(null); }}>Save</button>
                          <button type="button" className={BUTTON} onClick={() => setRenamingTemplateId(null)}>Cancel</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ReserveDisclosure>
            </li>
            <li id={BUILD_STUDIO_ANCHOR.import}>
              <ReserveDisclosure summary="Import a program">
                <p className="max-w-[64ch] text-[12.5px] leading-[1.55] text-white/55">Paste, upload or build a plan. It parses on this device into a draft you review before anything runs.</p>
                <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1.3fr)_minmax(300px,0.7fr)]">
                  <div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" className={BUTTON} onClick={() => activateFoundation("scratch")}><Plus size={12} /> Build It Manually</button>
                      <button type="button" className={BUTTON} onClick={() => setImportText("Monday:\nBack Squat 4 x 6-8\nRomanian Deadlift 3 x 8-10\n\nWednesday:\nBench Press 4 x 6-8\nCable Row 3 x 10-12")}><ClipboardPaste size={12} /> Paste My Program</button>
                      <label className={`${BUTTON} cursor-pointer`}><FileUp size={12} /> Upload My Program<input className="sr-only" type="file" accept=".txt,.csv,.pdf,.xlsx,.xls" onChange={(event) => void handleUpload(event.target.files?.[0])} /></label>
                      <button type="button" className={BUTTON} onClick={() => activateFoundation("reserve")}><BookOpen size={12} /> Start from a Template</button>
                    </div>
                    {/* 16px floor: below it iOS zooms on focus (accessibility.md). */}
                    <textarea className={`${FIELD} mt-3 min-h-52 resize-y font-mono text-[16px] leading-6`} value={importText} onChange={(event) => setImportText(event.target.value)} placeholder="Paste days, movements, sets, reps, rest, and notes. Example:&#10;Monday — Lower&#10;Back Squat 4 x 6-8 rest 180s" />
                    {/* Secondary: Build Studio's one gold action is the hero's. */}
                    <button type="button" className="mt-3 inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[#d5b15f]/40 bg-[#d5b15f]/[0.08] px-4 py-2.5 font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-[#d5b15f]" onClick={parseImport}><ScanSearch size={12} /> Parse into Review Draft</button>
                  </div>
                  <div className="border-l border-white/[0.1] pl-4">
                    <p className={LABEL}>Import Safety</p>
                    <div className="mt-3 grid gap-2 text-[10px] leading-4 text-white/42">
                      <p>1. Parse into a draft.</p><p>2. Show every interpreted day and movement.</p><p>3. Mark uncertain fields.</p><p>4. Require member review.</p><p>5. Preserve the source reference.</p><p>6. Never activate uncertain content silently.</p>
                    </div>
                    {importedDrafts.length > 0 && <p className="mt-4 text-[9px] text-white/28">{importedDrafts.length} bounded import draft{importedDrafts.length === 1 ? "" : "s"} preserved.</p>}
                  </div>
                </div>
                {importMessage && <p role="status" className="mt-3 border-l-2 border-white/[0.12] pl-3 text-[12px] leading-5 text-white/60">{importMessage}</p>}
                {importDraft && (
                  <div className="mt-5 border-t border-white/[0.08] pt-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div><p className={LABEL}>Import Review</p><input aria-label="Imported program name" className={`${FIELD} mt-2 max-w-sm`} value={importDraft.name} onChange={(event) => setImportDraft({ ...importDraft, name: event.target.value })} /></div>
                      <p className="max-w-md text-[9.5px] leading-4 text-white/35">Uncertain: {importDraft.uncertainFields.join(" · ") || "None marked"}</p>
                    </div>
                    <div className="mt-3 grid gap-x-6 lg:grid-cols-2">
                      {importDraft.days.map((day, dayIndex) => (
                        <div key={day.id} className="border-t border-white/[0.06] py-3.5">
                          <input aria-label={`Day ${dayIndex + 1} title`} className={FIELD} value={day.title} onChange={(event) => setImportDraft({ ...importDraft, days: importDraft.days.map((candidate) => candidate.id === day.id ? { ...candidate, title: event.target.value } : candidate) })} />
                          <p className="mt-2 font-mono text-[7px] uppercase tracking-[0.16em] text-[#e8c87a]/70">Uncertain: {day.uncertainFields.join(", ") || "none"}</p>
                          <div className="mt-2 grid gap-1.5">
                            {day.movements.map((movement) => (
                              <div key={movement.id} className="grid grid-cols-[minmax(0,1fr)_64px_80px] gap-1.5">
                                <input aria-label={`Movement name, day ${dayIndex + 1}`} className={FIELD} value={movement.name} onChange={(event) => setImportDraft({ ...importDraft, days: importDraft.days.map((candidate) => candidate.id === day.id ? { ...candidate, movements: candidate.movements.map((entry) => entry.id === movement.id ? { ...entry, name: event.target.value } : entry) } : candidate) })} />
                                <input aria-label={`Sets for ${movement.name}`} className={FIELD} type="number" value={movement.sets ?? ""} onChange={(event) => setImportDraft({ ...importDraft, days: importDraft.days.map((candidate) => candidate.id === day.id ? { ...candidate, movements: candidate.movements.map((entry) => entry.id === movement.id ? { ...entry, sets: Number(event.target.value) || undefined } : entry) } : candidate) })} />
                                <input aria-label={`Reps for ${movement.name}`} className={FIELD} value={movement.repMin ? `${movement.repMin}${movement.repMax && movement.repMax !== movement.repMin ? `-${movement.repMax}` : ""}` : ""} readOnly title="Parsed rep range; correct by editing the pasted source and parsing again" />
                              </div>
                            ))}
                          </div>
                          {day.movements.length === 0 && <p className="mt-2 text-[10px] text-white/30">No movements were interpreted for day {dayIndex + 1}.</p>}
                        </div>
                      ))}
                    </div>
                    <label className="mt-4 flex items-start gap-3 border-t border-white/[0.06] pt-3 text-[12px] leading-5 text-white/65"><input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-[#d5b15f]" checked={importReviewed} onChange={(event) => setImportReviewed(event.target.checked)} />I reviewed every interpreted day, movement, set, rep range, note, and uncertain field. Activate exactly this reviewed draft.</label>
                    <button type="button" disabled={!importReviewed || importDraft.days.length === 0} title={!importReviewed ? "Complete the member review confirmation" : importDraft.days.length === 0 ? "Paste program text to create reviewed days" : undefined} onClick={saveAndActivateImport} className="mt-3 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#d5b15f] px-4 py-2.5 font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-black disabled:cursor-not-allowed disabled:opacity-35"><Check size={12} /> Activate Reviewed Program</button>
                  </div>
                )}
              </ReserveDisclosure>
            </li>
          </ul>
        </section>
      </GlassPanel>
    </div>
  );
}
