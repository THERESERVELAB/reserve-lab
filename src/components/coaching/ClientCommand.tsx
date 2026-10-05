"use client";

/* CLIENT COMMAND — one client: a statement from their real state, the one
   decision that comes next, then seven tabs. Every section renders only what
   the athlete's permissions allow, and the repositories enforce the same
   rules underneath. */

import { useCallback, useMemo, useState } from "react";
import { ArrowLeft, NotebookPen } from "lucide-react";

import { ReserveDisclosure } from "@/components/ui/reserve";
import {
  canSuggest,
  canView,
  canViewPhotos,
  canAnnotatePhotos,
  PERMISSION_CATEGORY_LABELS,
  PERMISSION_LEVEL_LABELS,
  PHOTO_ACCESS_LABELS,
} from "@/lib/coaching/permissions";
import { useCoachingStore } from "@/lib/coaching/store";
import type { CoachNoteCategory, CoachPrescription, PrescriptionCategory, WeeklyCheckIn } from "@/lib/coaching/types";
import { resolveClientBrief, type CoachBrief } from "@/lib/coaching/workspace-brief";
import { focusCoachTarget, setCoachIntent } from "./coach-actions";
import { CheckInCard } from "./CheckInReview";
import { ChatThread } from "./ChatThread";
import { CoachOverridePanel } from "./CoachOverridePanel";
import { LiveStatus } from "./LiveDecisionsView";
import { ConflictResolver, LiveDayEventLog, OriginalLiveToggle, OverrideDetails } from "./LiveDayShared";
import { PhotoWorkspace } from "./PhotoWorkspace";
import { PrescriptionCard } from "./PrescriptionCard";
import { PrescriptionComposer, type ComposerSeed } from "./PrescriptionComposer";
import { WeightTrendPanel } from "./WeightTrendPanel";
import { OperationsHub } from "./operations/OperationsHub";
import {
  CoachHero,
  CoachPage,
  CoachSection,
  CommandButton,
  EmptyState,
  Field,
  MicroLabel,
  RowList,
  SegmentedControl,
  inputClass,
  relativeTime,
} from "./ui";

type ClientTab = "overview" | "plans" | "checkins" | "progress" | "messages" | "operations" | "history";

const TABS: Array<{ id: ClientTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "plans", label: "Plans" },
  { id: "checkins", label: "Check-ins" },
  { id: "progress", label: "Progress" },
  { id: "messages", label: "Messages" },
  { id: "operations", label: "Operations" },
  { id: "history", label: "History" },
];

export function ClientCommand() {
  const athleteId = useCoachingStore((s) => s.activeClientId);
  const setCoachView = useCoachingStore((s) => s.setCoachView);
  const clients = useCoachingStore((s) => s.clients);
  const [tab, setTab] = useState<ClientTab>("overview");
  const [planCategory, setPlanCategory] = useState<PrescriptionCategory>("training");
  const [composer, setComposer] = useState<ComposerSeed | null>(null);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [startReview, setStartReview] = useState<{ id: string; nonce: number } | null>(null);
  const closeComposer = useCallback(() => setComposer(null), []);
  const closeOverride = useCallback(() => setOverrideOpen(false), []);

  const db = useCoachingStore((s) => s.db);
  const actorId = useCoachingStore((s) => s.actorId);
  const run = useCoachingStore((s) => s.run);
  const client = useCoachingStore((s) => s.clients.find((c) => c.athleteId === s.activeClientId) ?? null);

  const relationship = useMemo(
    () =>
      db.relationships.find(
        (r) => r.coachId === actorId && r.athleteId === athleteId && r.status !== "revoked",
      ) ?? null,
    [db.relationships, actorId, athleteId],
  );
  const active = relationship?.status === "active" ? relationship : null;

  if (!athleteId || !client || !relationship) {
    const noClients = clients.length === 0;
    const brief: CoachBrief = {
      statement: noClients ? "No clients yet." : "No client selected.",
      support: noClients ? "A client's workspace opens once they accept your invitation." : "Open a client from your roster.",
      primary: noClients ? { kind: "invite-client", label: "Invite your first client" } : { kind: "open-clients", label: "Open clients" },
    };
    return (
      <CoachPage screen="client">
        <CoachHero
          title="Client"
          brief={brief}
          reads={[]}
          onPrimary={() => {
            if (noClients) setCoachIntent({ kind: "invite" });
            setCoachView("clients");
          }}
        />
      </CoachPage>
    );
  }

  const thread = db.conversations.find((c) => c.relationshipId === relationship.id) ?? null;
  const checkIns = db.checkIns
    .filter((c) => c.athleteId === athleteId)
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  const reviewed = (c: WeeklyCheckIn) => db.reviews.some((r) => r.id === c.reviewId && r.completedAt);
  const prescriptions = db.prescriptions.filter((p) => p.athleteId === athleteId && p.coachId === actorId);
  const day = db.activeDayPlans
    .filter((p) => p.athleteId === athleteId)
    .sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;
  const dayOverrides = day
    ? db.liveDayOverrides.filter((o) => o.athleteId === athleteId && o.date === day.date)
    : [];
  const pendingOverride = dayOverrides.find((o) => o.id === day?.activeOverrideId && o.status === "proposed") ?? null;
  const notes = db.notes.filter((n) => n.coachId === actorId && n.athleteId === athleteId);
  const weights = canView(active, "weightTrends")
    ? db.weightEntries.filter((w) => w.athleteId === athleteId).sort((a, b) => a.date.localeCompare(b.date))
    : [];
  const photos = canViewPhotos(active) ? db.photos.filter((p) => p.athleteId === athleteId) : [];
  const unread = thread
    ? db.messages.filter((m) => m.threadId === thread.id && m.senderId !== actorId && m.sentAt > (thread.lastReadAt[actorId] ?? "")).length
    : 0;
  const planToRevise = prescriptions
    .filter((p) => p.status === "revision_requested" || p.status === "rejected")
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];

  const brief = resolveClientBrief(
    {
      name: client.name,
      relationshipStatus: relationship.status,
      liveDecision: day?.status === "conflict" ? "conflict" : pendingOverride && pendingOverride.source !== "coach" ? "change" : null,
      checkInAwaiting: checkIns.find((c) => !reviewed(c)) ?? null,
      planToRevise: planToRevise ? { id: planToRevise.id, title: planToRevise.title, category: planToRevise.category } : null,
      threadId: thread?.id ?? null,
      canMessage: canSuggest(active, "messaging"),
      unread,
    },
    athleteId,
  );

  const sendRequest = async (kind: "checkin_request" | "photo_request") => {
    if (!thread) return;
    const isPhotos = kind === "photo_request";
    await run((r) => r.messaging.sendMessage({
      threadId: thread.id,
      senderId: actorId,
      body: isPhotos ? "Please add the requested physique-photo set when your setup is ready." : "Please complete your weekly check-in.",
      action: {
        kind,
        title: isPhotos ? "PHOTO SET REQUESTED" : "CHECK-IN REQUESTED",
        rows: [{ label: "Requested", value: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }) }],
        ctaLabel: isPhotos ? "OPEN PHOTOS" : "OPEN CHECK-IN",
        ctaTarget: isPhotos ? "photos" : "checkin",
        status: "pending",
      },
    }));
  };

  const openComposer = (category: PrescriptionCategory, editing?: CoachPrescription, revisingFrom?: CoachPrescription) =>
    setComposer({ category, athleteId, editing, revisingFrom, initialPayload: revisingFrom?.payload });

  const onPrimary = () => {
    const action = brief.primary;
    if (!action) return;
    switch (action.kind) {
      case "resolve-conflict":
      case "review-live-change":
        setTab("overview");
        focusCoachTarget("client-today", "button");
        return;
      case "review-check-in":
        setTab("checkins");
        setStartReview((prev) => ({ id: action.checkInId, nonce: (prev?.nonce ?? 0) + 1 }));
        return;
      case "revise-plan": {
        const rx = prescriptions.find((p) => p.id === action.prescriptionId);
        if (rx) openComposer(rx.category, undefined, rx);
        return;
      }
      case "open-thread":
        setTab("messages");
        focusCoachTarget("client-messages", "input");
        return;
    }
  };

  const firstName = client.name.split(" ")[0];
  const grantedCount = (Object.keys(PERMISSION_CATEGORY_LABELS) as Array<keyof typeof PERMISSION_CATEGORY_LABELS>).filter(
    (category) => relationship.permissions[category] !== "none",
  ).length;
  const categoryCount = Object.keys(PERMISSION_CATEGORY_LABELS).length;

  return (
    <CoachPage screen="client">
      <CoachHero
        eyebrow={`Client · ${client.phase} · Week ${client.phaseWeek} of ${client.phaseTotalWeeks}`}
        title={client.name}
        brief={brief}
        before={
          <button
            type="button"
            onClick={() => setCoachView("clients")}
            className="-ml-1 mb-1 flex min-h-[44px] w-fit items-center gap-1.5 px-1 font-mono text-[10px] uppercase tracking-[0.16em] text-white/55 transition-colors hover:text-white/85"
          >
            <ArrowLeft size={12} aria-hidden="true" /> Clients
          </button>
        }
        reads={[
          { label: "Adherence", value: client.adherencePct === null ? null : `${client.adherencePct}%`, empty: "Not reported" },
          { label: "Check-in", value: client.lastCheckInAt ? relativeTime(client.lastCheckInAt) : null, empty: "None yet" },
          { label: "Access", value: `${grantedCount}/${categoryCount}` },
        ]}
        onPrimary={onPrimary}
        after={
          <ReserveDisclosure summary="Client actions">
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap gap-1.5">
                <CommandButton disabled={!canSuggest(active, "training")} disabledReason="Training access not granted" onClick={() => openComposer("training")}>
                  New program
                </CommandButton>
                <CommandButton variant="ghost" disabled={!canSuggest(active, "nutrition")} disabledReason="Nutrition access not granted" onClick={() => openComposer("nutrition")}>
                  Nutrition plan
                </CommandButton>
                <CommandButton variant="teal" disabled={!canSuggest(active, "liveDayOverrides")} disabledReason="Live-day access not granted" onClick={() => setOverrideOpen(true)}>
                  Adjust today
                </CommandButton>
                <CommandButton
                  variant="ghost"
                  disabled={!thread || !canSuggest(active, "messaging") || !canSuggest(active, "checkIns")}
                  disabledReason="Check-in and messaging access are required"
                  onClick={() => void sendRequest("checkin_request")}
                >
                  Request check-in
                </CommandButton>
                <CommandButton
                  variant="ghost"
                  disabled={!thread || !canSuggest(active, "messaging") || !relationship.permissions.physiquePhotos.mayRequestUploads}
                  disabledReason="Photo-request and messaging access are required"
                  onClick={() => void sendRequest("photo_request")}
                >
                  Request photos
                </CommandButton>
              </div>
              <label className="flex items-center gap-2">
                <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/55">Coaching status</span>
                <select
                  value={relationship.status === "revoked" ? "archived" : relationship.status}
                  onChange={(event) => void run((r) => r.coaching.setRelationshipStatus(
                    relationship.id,
                    event.target.value as "active" | "paused" | "archived",
                    actorId,
                  ))}
                  className="min-h-[44px] rounded-lg border border-white/10 bg-[#0b0c12] px-2.5 font-mono text-[11px] uppercase tracking-[0.1em] text-white/70 outline-none md:min-h-[36px]"
                >
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="archived">Archived</option>
                </select>
              </label>
            </div>
          </ReserveDisclosure>
        }
      />

      {/* Tabs */}
      <div className="-mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0">
        <div role="tablist" aria-label={`${client.name} workspace`} className="flex min-w-max gap-1 border-b border-white/[0.06]">
          {TABS.map((t) => (
            <button
              key={t.id}
              id={`client-tab-${t.id}`}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              aria-controls="client-tabpanel"
              onClick={() => setTab(t.id)}
              className={`min-h-[44px] whitespace-nowrap px-3 font-mono text-[10px] font-bold uppercase tracking-[0.12em] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#d5b15f]/45 ${
                tab === t.id ? "border-b-2 border-[#d5b15f] text-[#f2eee6]" : "border-b-2 border-transparent text-white/55 hover:text-white/85"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div id="client-tabpanel" role="tabpanel" aria-labelledby={`client-tab-${tab}`} className="flex flex-col gap-5 lg:gap-6">
        {tab === "overview" && (
          <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr] xl:items-start">
            <div className="flex flex-col gap-5">
              <CoachSection label="Today" action={day ? <LiveStatus status={day.status} /> : undefined}>
                <div id="client-today" tabIndex={-1} className="scroll-mt-24 outline-none">
                  {!day ? (
                    <EmptyState title="No live day" body={`Today's plan starts when ${firstName} opens their day.`} />
                  ) : day.status === "conflict" ? (
                    <ConflictResolver day={day} overrides={dayOverrides} />
                  ) : pendingOverride ? (
                    <OverrideDetails override={pendingOverride} viewer="coach" showStatus={day.status !== "awaiting_approval"} />
                  ) : (
                    <ReserveDisclosure summary="Today's plan">
                      <OriginalLiveToggle day={day} />
                    </ReserveDisclosure>
                  )}
                </div>
              </CoachSection>

              {checkIns[0] && (
                <CoachSection label="Latest check-in">
                  <CheckInCard
                    checkIn={checkIns[0]}
                    viewer="coach"
                    onAdjust={(category, checkInId) => setComposer({ category, athleteId, sourceCheckInId: checkInId })}
                  />
                </CoachSection>
              )}
            </div>

            <div className="flex flex-col gap-5">
              <CoachSection label="Profile">
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                  <Fact label="Goal" value={client.goal} />
                  <Fact label="Program" value={client.programName ?? "None active"} />
                  <Fact
                    label="Weight trend"
                    value={client.weightTrend.weeklyDeltaLb !== null ? `${client.weightTrend.weeklyDeltaLb > 0 ? "+" : ""}${client.weightTrend.weeklyDeltaLb} lb/wk` : "No trend yet"}
                  />
                  <Fact label="New photos" value={client.newPhotoSets > 0 ? `${client.newPhotoSets} set${client.newPhotoSets === 1 ? "" : "s"}` : "None"} />
                </dl>
                <div className="mt-3">
                  <ReserveDisclosure summary={`Access granted · ${grantedCount} of ${categoryCount}`}>
                    <RowList label="Access by category">
                      {(Object.keys(PERMISSION_CATEGORY_LABELS) as Array<keyof typeof PERMISSION_CATEGORY_LABELS>).map((category) => (
                        <li key={category} className="flex items-center justify-between gap-3 py-1.5">
                          <span className="text-[12px] text-white/65">{PERMISSION_CATEGORY_LABELS[category]}</span>
                          <span className="font-mono text-[10px] uppercase tracking-wide text-white/70">
                            {PERMISSION_LEVEL_LABELS[relationship.permissions[category]]}
                          </span>
                        </li>
                      ))}
                      <li className="flex items-center justify-between gap-3 py-1.5">
                        <span className="text-[12px] text-white/65">Physique images</span>
                        <span className="font-mono text-[10px] uppercase tracking-wide text-white/70">
                          {PHOTO_ACCESS_LABELS[relationship.permissions.physiquePhotos.access]}
                        </span>
                      </li>
                    </RowList>
                    <p className="mt-2 text-[11.5px] text-white/55">Only the athlete grants or changes access.</p>
                  </ReserveDisclosure>
                </div>
              </CoachSection>

              <PrivateNotes athleteId={athleteId} notes={notes.filter((note) => note.category === "general")} />
            </div>
          </div>
        )}

        {tab === "plans" && (
          <CoachSection
            label="Plans"
            action={
              <SegmentedControl
                label="Plan type"
                options={[
                  { value: "training", label: "Training" },
                  { value: "nutrition", label: "Nutrition" },
                  { value: "schedule", label: "Schedule" },
                ]}
                value={planCategory}
                onChange={setPlanCategory}
              />
            }
          >
            <PrescriptionTab
              category={planCategory}
              prescriptions={prescriptions.filter((p) => p.category === planCategory).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))}
              canCreate={canSuggest(active, planCategory)}
              onCreate={() => openComposer(planCategory)}
              onEdit={(rx) => openComposer(planCategory, rx)}
              onRevise={(rx) => openComposer(planCategory, undefined, rx)}
            />
          </CoachSection>
        )}

        {tab === "checkins" && (
          <>
            <CoachSection label={`Check-ins · ${checkIns.length}`}>
              {checkIns.length === 0 ? (
                <EmptyState title="No check-ins yet" body={`${firstName}'s weekly check-ins appear here for review.`} />
              ) : (
                <ul className="flex flex-col gap-4">
                  {checkIns.map((checkIn) => {
                    const start = startReview?.id === checkIn.id;
                    return (
                      <li key={`${checkIn.id}-${start ? startReview?.nonce : 0}`}>
                        <CheckInCard
                          checkIn={checkIn}
                          viewer="coach"
                          startReview={start}
                          onAdjust={(category, checkInId) => setComposer({ category, athleteId, sourceCheckInId: checkInId })}
                        />
                      </li>
                    );
                  })}
                </ul>
              )}
            </CoachSection>
            <CoachSection label="Recovery">
              {canView(active, "recovery") ? (
                <RecoveryEvidence checkIns={checkIns} />
              ) : (
                <EmptyState title="Recovery access not granted" body={`${firstName}'s recovery logs stay private until they grant access.`} />
              )}
            </CoachSection>
          </>
        )}

        {tab === "progress" && (
          <>
            <CoachSection label="Weight">
              {canView(active, "weightTrends") ? (
                <div className="flex flex-col gap-4">
                  <WeightTrendPanel
                    entries={weights}
                    phaseLabel={client.phase}
                    goalNote={`Goal: ${client.goal}. Reserve shows the trend; reading it is yours.`}
                  />
                  <PrivateNotes
                    athleteId={athleteId}
                    notes={notes.filter((note) => note.category === "weight")}
                    category="weight"
                    title="Weight notes"
                    inline
                  />
                </div>
              ) : (
                <EmptyState title="Weight access not granted" body={`${firstName} has not shared weight trends. Ask them to update access.`} />
              )}
            </CoachSection>
            <CoachSection label="Photos">
              {canViewPhotos(active) ? (
                <PhotoWorkspace
                  photos={photos}
                  canAnnotate={canAnnotatePhotos(active)}
                  canRequestUploads={relationship.permissions.physiquePhotos.mayRequestUploads}
                  viewerIsCoach
                />
              ) : (
                <EmptyState title="Photo access not granted" body="Photo access is always the athlete's own, separate decision." />
              )}
            </CoachSection>
          </>
        )}

        {tab === "messages" && (
          <CoachSection label={`Messages · ${firstName}`}>
            <div id="client-messages" className="flex h-[min(560px,70dvh)] flex-col">
              {thread ? (
                <ChatThread
                  thread={thread}
                  onOpenTarget={(target) => {
                    if (target === "live_day") setTab("overview");
                    if (target === "checkin") setTab("checkins");
                    if (target === "photos") setTab("progress");
                    if (target === "prescription") setTab("plans");
                  }}
                />
              ) : (
                <EmptyState title="No conversation" body="The channel opens when coaching is active." />
              )}
            </div>
          </CoachSection>
        )}

        {tab === "operations" && (
          <OperationsHub athleteId={athleteId} athleteName={client.name} phaseLabel={client.phase} relationship={active} />
        )}

        {tab === "history" && (
          <div className="grid gap-5 xl:grid-cols-2 xl:items-start">
            <CoachSection label="Plan versions">
              {prescriptions.length === 0 ? (
                <EmptyState title="No plans yet" body="Every sent plan and each earlier version is kept here." />
              ) : (
                <RowList label="Plan versions">
                  {[...prescriptions]
                    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
                    .map((rx) => (
                      <li key={rx.id} className="flex items-center justify-between gap-3 py-2">
                        <span className="min-w-0">
                          <span className="block truncate text-[12.5px] font-medium text-white/80">{rx.title}</span>
                          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/50">
                            {rx.category} · v{rx.version} · {relativeTime(rx.updatedAt)}
                          </span>
                        </span>
                        <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-white/65">{rx.status.replace(/_/g, " ")}</span>
                      </li>
                    ))}
                </RowList>
              )}
            </CoachSection>
            <div className="flex flex-col gap-5">
              <CoachSection label="Access changes">
                <RowList label="Access changes">
                  {db.permissionAudit
                    .filter((a) => a.relationshipId === relationship.id)
                    .sort((a, b) => b.at.localeCompare(a.at))
                    .map((audit) => (
                      <li key={audit.id} className="flex items-center justify-between gap-3 py-1.5 text-[12px]">
                        <span className="capitalize text-white/65">{audit.action} by athlete</span>
                        <span className="tnum font-mono text-[10px] text-white/50">{relativeTime(audit.at)}</span>
                      </li>
                    ))}
                </RowList>
              </CoachSection>
              {day && (
                <CoachSection label="Today's log">
                  <LiveDayEventLog athleteId={athleteId} date={day.date} />
                </CoachSection>
              )}
            </div>
          </div>
        )}
      </div>

      {composer && <PrescriptionComposer seed={composer} onClose={closeComposer} />}
      {overrideOpen && <CoachOverridePanel athleteId={athleteId} onClose={closeOverride} />}
    </CoachPage>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/50">{label}</dt>
      <dd className="mt-0.5 text-[12.5px] font-medium text-[#f2eee6]">{value}</dd>
    </div>
  );
}

/** A 1–5 answer, or plainly unanswered. */
function scaleText(value: number | null): string {
  return value === null ? "Not answered" : `${value}/5`;
}

function RecoveryEvidence({ checkIns }: { checkIns: WeeklyCheckIn[] }) {
  const latest = checkIns[0];
  if (!latest) {
    return <EmptyState title="No recovery entries" body="Recovery answers arrive with the athlete's first check-in." />;
  }
  return (
    <div>
      <MicroLabel className="mb-2">From the check-in sent {relativeTime(latest.submittedAt).toLowerCase()}</MicroLabel>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
        <Fact label="Recovery" value={scaleText(latest.recovery)} />
        <Fact label="Sleep quality" value={scaleText(latest.sleepQuality)} />
        <Fact label="Energy" value={scaleText(latest.energy)} />
        <Fact label="Stress" value={scaleText(latest.stress)} />
      </dl>
      <p className="mt-3 text-[12px] leading-[1.5] text-white/60">
        {latest.painObservations || "No pain was noted."} Shown as the athlete answered it.
      </p>
    </div>
  );
}

function PrescriptionTab({
  category,
  prescriptions,
  canCreate,
  onCreate,
  onEdit,
  onRevise,
}: {
  category: PrescriptionCategory;
  prescriptions: CoachPrescription[];
  canCreate: boolean;
  onCreate: () => void;
  onEdit: (rx: CoachPrescription) => void;
  onRevise: (rx: CoachPrescription) => void;
}) {
  const label = category === "training" ? "program" : category === "nutrition" ? "nutrition plan" : "schedule";
  return (
    <div className="flex flex-col gap-4">
      <CommandButton
        className="self-start"
        disabled={!canCreate}
        disabledReason={`The athlete has not granted ${category} access`}
        onClick={onCreate}
      >
        New {label} draft
      </CommandButton>
      {prescriptions.length === 0 ? (
        <EmptyState title={`No ${label}s yet`} body="Draft one, check the athlete view, then send it for their approval." />
      ) : (
        <ul className="flex flex-col gap-4">
          {prescriptions.map((rx) => (
            <li key={rx.id}>
              <PrescriptionCard prescription={rx} viewer="coach" onEdit={onEdit} onRevise={onRevise} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PrivateNotes({
  athleteId,
  notes,
  category = "general",
  title = "Private notes",
  inline = false,
}: {
  athleteId: string;
  notes: Array<{ id: string; body: string; category: string; createdAt: string; visibility: string }>;
  category?: CoachNoteCategory;
  title?: string;
  /** Inside another section: no surface of its own. */
  inline?: boolean;
}) {
  const run = useCoachingStore((s) => s.run);
  const actorId = useCoachingStore((s) => s.actorId);
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);

  const save = async () => {
    if (!draft.trim()) return;
    await run((r) =>
      r.tracking.addNote({
        coachId: actorId,
        athleteId,
        category,
        body: draft.trim(),
        visibility: "private",
      }, actorId),
    );
    setDraft("");
    setAdding(false);
  };

  const toggle = (
    <button
      type="button"
      onClick={() => setAdding((v) => !v)}
      aria-expanded={adding}
      aria-label={adding ? `Close the new ${title.toLowerCase()} form` : `Add to ${title.toLowerCase()}`}
      className="grid min-h-[44px] min-w-[44px] place-items-center rounded-lg text-white/55 transition-colors hover:text-[#d5b15f]"
    >
      <NotebookPen size={14} aria-hidden="true" />
    </button>
  );

  const body = (
    <div className="flex flex-col gap-2">
      {adding && (
        <div className="flex flex-col gap-2">
          <Field label="Private note (the athlete never sees it)">
            <textarea className={`${inputClass} min-h-[56px] resize-none`} value={draft} onChange={(e) => setDraft(e.target.value)} />
          </Field>
          <CommandButton className="self-start" disabled={!draft.trim()} disabledReason="Write the note first" onClick={() => void save()}>
            Save note
          </CommandButton>
        </div>
      )}
      {notes.length === 0 && !adding ? (
        <p className="text-[12px] text-white/55">No notes yet. Private notes never reach the athlete.</p>
      ) : (
        <RowList label={title}>
          {notes.map((note) => (
            <li key={note.id} className="py-2">
              <p className="text-[12.5px] leading-[1.5] text-white/75">{note.body}</p>
              <MicroLabel className="mt-1">{relativeTime(note.createdAt)}</MicroLabel>
            </li>
          ))}
        </RowList>
      )}
    </div>
  );

  if (inline) {
    return (
      <div className="border-t border-white/[0.05] pt-3">
        <div className="flex items-center justify-between">
          <MicroLabel>{title}</MicroLabel>
          {toggle}
        </div>
        {body}
      </div>
    );
  }
  return (
    <CoachSection label={title} action={toggle}>
      {body}
    </CoachSection>
  );
}
