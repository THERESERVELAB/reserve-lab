"use client";

/* ════════════════════════════════════════════════════════════════════════
   MY COACH — the athlete side of Reserve Coaching OS.

   A utility screen. The hero reads the real connection state from the
   coaching data layer (no coach · request pending · a coach asked · connected)
   and carries one gold action chosen by `resolveMyCoachPrimaryAction`.

   The member owns every grant. Reviewing a coach's request and managing a
   connected coach's access both open a sheet, so the permission choices get
   the whole phone screen and the confirm button can never sit under the tab
   bar.

   The weekly check-in keeps its honesty rules: adherence is required, every
   scale starts unset, and an unset scale reaches the coach as not answered.

   Shared coaching surfaces (live day, prescriptions, operations, the chat
   thread) belong to the coach workspace and render as they are.
   ════════════════════════════════════════════════════════════════════════ */

import { useCallback, useMemo, useState } from "react";
import { Handshake, ShieldCheck } from "lucide-react";

import { AthleteOperations } from "@/components/coaching/operations/AthleteOperations";
import { ChatThread } from "@/components/coaching/ChatThread";
import { LiveDayPanel } from "@/components/coaching/LiveDayPanel";
import { PermissionEditor } from "@/components/coaching/PermissionEditor";
import { PrescriptionCard } from "@/components/coaching/PrescriptionCard";
import { Panel, PanelHeader, relativeTime } from "@/components/coaching/ui";
import { GlassPanel } from "@/components/ui/GlassPanel";
import {
  DETAIL_BAND_BLEED,
  ReserveBottomSheet,
  ReserveButton,
  ReserveDetailImage,
  ReserveSection,
  ReserveSectionHeader,
  ReserveSheetClose,
  useDirtySnapshot,
} from "@/components/ui/reserve";
import { RecordFact, RecordList, RecordRow, RecordTag } from "@/components/views/records/RecordRows";
import { useAthleteDashboardStore } from "@/lib/athlete-store";
import { todayKey, dateKeyOffset } from "@/lib/coaching/ids";
import { PHOTO_ACCESS_LABELS, clonePermissions } from "@/lib/coaching/permissions";
import { currentCoachingMember, useCoachingStore } from "@/lib/coaching/store";
import type { CoachingInvitation, CoachingPermissions, CoachingRelationship } from "@/lib/coaching/types";
import { RESERVE } from "@/lib/design/tokens";
import { resolveMyCoachPrimaryAction, type MyCoachPrimaryAction } from "@/lib/my-coach/primary-action";

import { ViewShell } from "./ViewShell";
import { UtilityHero, focusSection } from "./utility/UtilityHero";

/* 16px on phones: below it iOS zooms on focus (accessibility.md). */
const INPUT =
  "min-h-[44px] w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[16px] text-[#f2eee6] outline-none transition-colors placeholder:text-white/30 focus:border-[#d5b15f]/45 md:text-[13px]";
const LABEL = "mb-1.5 block font-mono text-[11px] uppercase tracking-[0.16em] text-white/55";

const ANCHOR = {
  requests: "my-coach-requests",
  connection: "my-coach-connection",
  plans: "my-coach-plans",
  checkIn: "my-coach-check-in",
  channel: "my-coach-channel",
} as const;

/** Monday of the current week, as the check-in store keys it. */
function currentWeekKey(): string {
  const today = todayKey();
  const dayOfWeek = new Date(`${today}T12:00:00`).getDay(); // 0=Sun
  return dateKeyOffset(today, dayOfWeek === 0 ? -6 : 1 - dayOfWeek);
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className={LABEL}>{label}</span>
      {children}
    </label>
  );
}

export function MyCoachView() {
  const scheduleProfile = useAthleteDashboardStore((s) => s.scheduleProfile);
  const db = useCoachingStore((s) => s.db);
  const actorId = useCoachingStore((s) => s.actorId);
  const member = useCoachingStore(currentCoachingMember);
  const [checkInOpen, setCheckInOpen] = useState(false);

  const relationship = useMemo(
    () => db.relationships.find((r) => r.athleteId === actorId && r.status === "active") ?? null,
    [db.relationships, actorId],
  );
  const invitations = useMemo(
    () =>
      db.invitations.filter(
        (i) =>
          i.direction === "coach_to_athlete" &&
          (i.status === "sent" || i.status === "viewed") &&
          (i.athleteMemberId === actorId ||
            (member && i.athleteEmail.toLowerCase() === member.email.toLowerCase())),
      ),
    [db.invitations, actorId, member],
  );
  const outgoingRequests = useMemo(
    () => db.invitations.filter((i) => i.direction === "athlete_to_coach" && i.athleteMemberId === actorId && i.status === "sent"),
    [db.invitations, actorId],
  );

  const coach = relationship ? db.members.find((m) => m.id === relationship.coachId) ?? null : null;
  const coachProfile = relationship ? db.coachProfiles.find((c) => c.memberId === relationship.coachId) ?? null : null;
  const thread = relationship ? db.conversations.find((c) => c.relationshipId === relationship.id) ?? null : null;
  const myPrescriptions = db.prescriptions
    .filter((p) => p.athleteId === actorId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const inbox = myPrescriptions.filter((p) => p.status === "sent");
  const activePlans = myPrescriptions.filter((p) => p.status === "active" || p.status === "accepted");

  const weekKey = currentWeekKey();
  const existingCheckIn = relationship
    ? db.checkIns.find((c) => c.athleteId === actorId && c.relationshipId === relationship.id && c.weekOf === weekKey) ?? null
    : null;

  const connected = Boolean(relationship && coach);
  const plan = resolveMyCoachPrimaryAction({
    coachName: connected ? coach!.name : null,
    pendingInvitations: invitations.length,
    outgoingRequests: outgoingRequests.length,
    plansAwaitingApproval: inbox.length,
    checkInSubmitted: Boolean(existingCheckIn),
    hasChannel: Boolean(thread),
  });

  function run(action: MyCoachPrimaryAction) {
    switch (action.kind) {
      case "connect":
        focusSection(ANCHOR.connection, "input");
        break;
      case "review-invitation":
        focusSection(ANCHOR.requests, "button");
        break;
      case "review-plan":
        focusSection(ANCHOR.plans, "button");
        break;
      case "start-check-in":
        setCheckInOpen(true);
        /* The form mounts on the next frame; focus lands in it once it exists. */
        requestAnimationFrame(() => focusSection(ANCHOR.checkIn, "input"));
        break;
      case "message-coach":
        focusSection(ANCHOR.channel, "textarea, input");
        break;
      case "manage-access":
        focusSection(ANCHOR.connection, "button");
        break;
    }
  }

  const checkInRead = connected ? (existingCheckIn ? (existingCheckIn.reviewId ? "Reviewed" : "Sent") : "Not sent") : null;

  return (
    <ViewShell
      accentColor={RESERVE.steel}
      label="Coaching"
      title="My Coach"
      icon={Handshake}
      roomHero
      command="Connect with your coach, send your weekly check-in, and control what they can see."
      disclaimer="Coaching on Reserve is training, nutrition structure, scheduling, and accountability — never medical care. You control every permission and can revoke access at any time."
    >
      <UtilityHero
        testId="my-coach"
        accent={RESERVE.steel}
        eyebrow={`Coaching · ${
          plan.connection === "connected" ? "Connected" : plan.connection === "invited" ? "Request received" : plan.connection === "requested" ? "Request sent" : "No coach"
        }`}
        statement={plan.statement}
        support={plan.support}
        reads={[
          {
            label: "Coach",
            value: connected ? coach!.name : null,
            empty: plan.connection === "requested" ? "Request pending" : plan.connection === "invited" ? "Awaiting your review" : "None connected",
          },
          { label: "This week's check-in", value: checkInRead, empty: "Needs a connected coach" },
          { label: "Plans awaiting you", value: connected ? String(inbox.length) : null, empty: "Needs a connected coach" },
        ]}
        action={plan.primary ? { label: plan.primary.label, onClick: () => run(plan.primary!) } : null}
        noAction="Nothing to do until the coach answers. Both sides must approve before anything is shared."
      />

      {invitations.length > 0 && (
        <GlassPanel accent={RESERVE.gold} phone="flush">
          <section id={ANCHOR.requests} aria-label="Coach requests" className="scroll-mt-24">
            <ReserveSectionHeader label={`Coach requests · ${invitations.length}`} accent={RESERVE.gold} />
            <RecordList label="Coach requests">
              {invitations.map((invitation) => (
                <RecordRow key={invitation.id}>
                  <InvitationReview invitation={invitation} />
                </RecordRow>
              ))}
            </RecordList>
          </section>
        </GlassPanel>
      )}

      <GlassPanel accent={RESERVE.steel} phone="flush">
        <ReserveDetailImage id="coach-suite" className={DETAIL_BAND_BLEED} />
        <section id={ANCHOR.connection} aria-label="Your coach" className="scroll-mt-24">
          {relationship && coach ? (
            <CoachConnection relationship={relationship} coachName={coach.name} headline={coachProfile?.headline} />
          ) : (
            <ConnectWithCoach pending={outgoingRequests.length > 0} />
          )}
        </section>
      </GlassPanel>

      {inbox.length > 0 && (
        <ReserveSection label={`Awaiting your approval · ${inbox.length}`} accent={RESERVE.steel}>
          <div id={ANCHOR.plans} className="flex scroll-mt-24 flex-col gap-2">
            {inbox.map((rx) => (
              <PrescriptionCard key={rx.id} prescription={rx} viewer="athlete" />
            ))}
          </div>
        </ReserveSection>
      )}

      {activePlans.length > 0 && (
        <ReserveSection label={`Active coach plans · ${activePlans.length}`}>
          <div className="flex flex-col gap-2">
            {activePlans.map((rx) => (
              <PrescriptionCard key={rx.id} prescription={rx} viewer="athlete" />
            ))}
          </div>
        </ReserveSection>
      )}

      {relationship && (
        <GlassPanel accent={RESERVE.gold} phone="flush">
          <section id={ANCHOR.checkIn} aria-label="Weekly check-in" className="scroll-mt-24">
            <CheckInForm
              relationship={relationship}
              weekKey={weekKey}
              existing={existingCheckIn ? { reviewed: Boolean(existingCheckIn.reviewId) } : null}
              open={checkInOpen}
              onOpenChange={setCheckInOpen}
            />
          </section>
        </GlassPanel>
      )}

      {relationship && (
        <GlassPanel accent={RESERVE.slate} phone="flush">
          <section aria-label="Daily weight">
            <DailyWeightForm />
          </section>
        </GlassPanel>
      )}

      {/* Performance operations — directive, protocol moments, meal logging,
          grocery, and athlete-owned clinical consent */}
      {relationship && <AthleteOperations relationship={relationship} />}

      {relationship && thread && (
        <div id={ANCHOR.channel} className="scroll-mt-24">
          <Panel className="flex h-[480px] flex-col">
            <PanelHeader label="Channel" title={`Coach ${coach?.name?.split(" ")[0] ?? ""}`} />
            <ChatThread thread={thread} />
          </Panel>
        </div>
      )}

      {/* Today's operating plan — real, and secondary to the connection itself. */}
      <LiveDayPanel scheduleProfile={scheduleProfile} />
    </ViewShell>
  );
}

/* ─── Invitation review ───────────────────────────────────────────────── */

function InvitationReview({ invitation }: { invitation: CoachingInvitation }) {
  const run = useCoachingStore((s) => s.run);
  const actorId = useCoachingStore((s) => s.actorId);
  const coachName = useCoachingStore(
    (s) => s.db.members.find((m) => m.id === invitation.coachId)?.name ?? "A Reserve coach",
  );
  const [reviewing, setReviewing] = useState(false);
  const [granted, setGranted] = useState<CoachingPermissions>(() => clonePermissions(invitation.requestedPermissions));
  const close = useCallback(() => setReviewing(false), []);
  /* Adjusted access outlives the sheet, so dirty is measured against what the
     coach requested, and Discard puts that back. */
  const dirty = useDirtySnapshot(granted);

  return (
    <div>
      <p className="text-[15px] font-semibold text-[#f2eee6]">{coachName} wants to connect to your Reserve profile.</p>
      {invitation.welcomeNote && (
        <p className="mt-2 max-w-[64ch] text-[13px] italic leading-[1.55] text-white/60">“{invitation.welcomeNote}”</p>
      )}
      <p className="tnum mt-2 text-[12px] leading-[1.5] text-white/50">
        Received {relativeTime(invitation.createdAt)} · Expires{" "}
        {new Date(invitation.expiresAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })} · Nothing is shared until you approve.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <ReserveButton tier="secondary" accent={RESERVE.gold} size="sm" onClick={() => setReviewing(true)}>
          Review access
        </ReserveButton>
        <ReserveButton tier="danger" size="sm" onClick={() => void run((r) => r.coaching.declineInvitation(invitation.id, actorId))}>
          Decline
        </ReserveButton>
      </div>

      <ReserveBottomSheet
        open={reviewing}
        onClose={close}
        title={`Review ${coachName.split(" ")[0]}'s access`}
        dirty={dirty}
        onDiscard={() => {
          setGranted(clonePermissions(invitation.requestedPermissions));
          close();
        }}
        footer={
          <div className="flex items-center justify-between gap-3">
            <ReserveSheetClose fallback={close}>
              {(requestClose) => (
                <ReserveButton tier="quiet" size="md" onClick={requestClose}>
                  Back
                </ReserveButton>
              )}
            </ReserveSheetClose>
            <ReserveButton
              tier="secondary"
              accent={RESERVE.gold}
              size="md"
              onClick={() =>
                void run((r) =>
                  r.coaching.acceptInvitation({ invitationId: invitation.id, athleteId: actorId, grantedPermissions: granted }),
                )
              }
            >
              Accept with this access
            </ReserveButton>
          </div>
        }
      >
        <p className="mb-3 text-[13px] leading-[1.55] text-white/65">
          This is what {coachName.split(" ")[0]} requested. Adjust anything before granting — you stay in control of every
          category, and image access is always separate.
        </p>
        <PermissionEditor value={granted} onChange={setGranted} requested={invitation.requestedPermissions} />
      </ReserveBottomSheet>
    </div>
  );
}

/* ─── Connected coach + access management ─────────────────────────────── */

function CoachConnection({
  relationship,
  coachName,
  headline,
}: {
  relationship: CoachingRelationship;
  coachName: string;
  headline?: string;
}) {
  const run = useCoachingStore((s) => s.run);
  const actorId = useCoachingStore((s) => s.actorId);
  const [managing, setManaging] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [draft, setDraft] = useState<CoachingPermissions>(() => clonePermissions(relationship.permissions));
  const close = useCallback(() => setManaging(false), []);
  const dirty = useDirtySnapshot(draft, managing);

  return (
    <>
      <ReserveSectionHeader label="Your coach · Connected" accent={RESERVE.steel} />
      <p className="text-[18px] font-semibold text-[#f2eee6]">{coachName}</p>
      {headline && <p className="mt-1 max-w-[64ch] text-[13px] leading-[1.55] text-white/60">{headline}</p>}

      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <RecordFact label="Access" value={<span className="inline-flex items-center gap-1.5"><ShieldCheck size={13} aria-hidden="true" /> You control it</span>} />
        <RecordFact label="Images" value={PHOTO_ACCESS_LABELS[relationship.permissions.physiquePhotos.access]} />
        <RecordFact
          label="Since"
          value={new Date(relationship.startedAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <ReserveButton
          tier="secondary"
          accent={RESERVE.slate}
          size="sm"
          onClick={() => {
            setDraft(clonePermissions(relationship.permissions));
            setManaging(true);
          }}
        >
          Manage access
        </ReserveButton>
        {!confirmRevoke ? (
          <ReserveButton tier="danger" size="sm" onClick={() => setConfirmRevoke(true)}>
            Revoke access
          </ReserveButton>
        ) : (
          <div role="group" aria-label="Confirm revoking access" className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] text-[#ef9b7d]">End this coaching relationship?</span>
            <ReserveButton tier="danger" size="sm" onClick={() => void run((r) => r.coaching.revokeRelationship(relationship.id, actorId))}>
              Yes, revoke
            </ReserveButton>
            <ReserveButton tier="quiet" size="sm" onClick={() => setConfirmRevoke(false)}>
              Keep
            </ReserveButton>
          </div>
        )}
      </div>

      <ReserveBottomSheet
        open={managing}
        onClose={close}
        title={`${coachName.split(" ")[0]}'s access`}
        dirty={dirty}
        footer={
          <div className="flex items-center justify-between gap-3">
            <ReserveSheetClose fallback={close}>
              {(requestClose) => (
                <ReserveButton tier="quiet" size="md" onClick={requestClose}>
                  Cancel
                </ReserveButton>
              )}
            </ReserveSheetClose>
            <ReserveButton
              tier="secondary"
              accent={RESERVE.gold}
              size="md"
              onClick={() => {
                void run((r) => r.coaching.updatePermissions(relationship.id, draft, actorId));
                setManaging(false);
              }}
            >
              Save access changes
            </ReserveButton>
          </div>
        }
      >
        <PermissionEditor value={draft} onChange={setDraft} />
      </ReserveBottomSheet>
    </>
  );
}

/* ─── Athlete-initiated connection ────────────────────────────────────── */

function ConnectWithCoach({ pending }: { pending: boolean }) {
  const run = useCoachingStore((s) => s.run);
  const actorId = useCoachingStore((s) => s.actorId);
  const [reference, setReference] = useState("");
  const [sent, setSent] = useState(false);

  const submit = async () => {
    const result = await run((r) => r.coaching.requestConnection({ athleteId: actorId, reference }));
    if (result) setSent(true);
  };

  return (
    <>
      <ReserveSectionHeader label={pending ? "Connection · Request pending" : "Connection"} accent={RESERVE.steel} />
      {pending ? (
        <p className="max-w-[64ch] text-[13.5px] leading-[1.6] text-white/70">
          Your connection request is with the coach. Both sides must approve before anything is shared — knowing a
          coach&apos;s handle never grants access by itself.
        </p>
      ) : sent ? (
        <p role="status" className="text-[13.5px] text-white/70">Request sent — the coach must approve it before anything connects.</p>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (reference.trim()) void submit();
          }}
        >
          <p className="max-w-[64ch] text-[13.5px] leading-[1.6] text-white/70">
            Enter an invitation code from your coach, or a coach code, email, or handle. Every connection requires
            approval from both sides.
          </p>
          <div className="mt-3.5 flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1 sm:max-w-md">
              <Field label="Invitation code · coach code · email · handle">
                <input
                  className={INPUT}
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="RSV-XXXX or @coachhandle"
                  autoComplete="off"
                />
              </Field>
            </div>
            {reference.trim() ? (
              <ReserveButton type="submit" tier="secondary" accent={RESERVE.steel} size="md">
                Connect
              </ReserveButton>
            ) : (
              <ReserveButton type="submit" tier="secondary" accent={RESERVE.steel} size="md" disabled disabledReason="Enter a code or reference">
                Connect
              </ReserveButton>
            )}
          </div>
        </form>
      )}
    </>
  );
}

/* ─── Weekly check-in ─────────────────────────────────────────────────── */

/** "" clears the field; anything else is clamped to a whole 0–100. */
function parseAdherencePct(raw: string): number | null {
  if (raw.trim() === "") return null;
  const value = Math.round(Number(raw));
  return Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : null;
}

type ScaleKey = "sleepQuality" | "energy" | "recovery" | "stress" | "hunger" | "digestion";
const SCALE_LABELS: Record<ScaleKey, string> = {
  sleepQuality: "Sleep",
  energy: "Energy",
  recovery: "Recovery",
  stress: "Stress",
  hunger: "Hunger",
  digestion: "Digestion",
};

function CheckInForm({
  relationship,
  weekKey,
  existing,
  open,
  onOpenChange,
}: {
  relationship: CoachingRelationship;
  weekKey: string;
  existing: { reviewed: boolean } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const run = useCoachingStore((s) => s.run);
  const actorId = useCoachingStore((s) => s.actorId);
  const [submitted, setSubmitted] = useState(false);
  const [weight, setWeight] = useState("");
  /* Nothing starts filled in: the coach sees only what the athlete entered.
     Adherence is required; a scale left unset reaches the coach as "Not answered". */
  const [training, setTraining] = useState<number | null>(null);
  const [nutrition, setNutrition] = useState<number | null>(null);
  const [scales, setScales] = useState<Record<ScaleKey, 1 | 2 | 3 | 4 | 5 | null>>({
    sleepQuality: null, energy: null, recovery: null, stress: null, hunger: null, digestion: null,
  });
  const adherenceReady = training !== null && nutrition !== null;
  const [pain, setPain] = useState("");
  const [cardio, setCardio] = useState("");
  const [steps, setSteps] = useState("");
  const [update, setUpdate] = useState("");
  const [questions, setQuestions] = useState("");
  const isSubmitted = submitted || Boolean(existing);

  const submit = async () => {
    if (training === null || nutrition === null) return;
    const result = await run((r) =>
      r.tracking.submitCheckIn({
        athleteId: actorId,
        relationshipId: relationship.id,
        weekOf: weekKey,
        weightLb: weight ? Number(weight) : null,
        weeklyAvgWeightLb: null,
        trainingAdherencePct: training,
        nutritionAdherencePct: nutrition,
        sleepQuality: scales.sleepQuality,
        energy: scales.energy,
        recovery: scales.recovery,
        stress: scales.stress,
        hunger: scales.hunger,
        digestion: scales.digestion,
        painObservations: pain,
        cardioCompleted: cardio,
        stepsAvg: steps ? Number(steps) : null,
        update,
        questionsForCoach: questions,
      }, actorId),
    );
    if (result) {
      setSubmitted(true);
      onOpenChange(false);
    }
  };

  return (
    <>
      <ReserveSectionHeader
        label={`Weekly check-in · ${isSubmitted ? (existing?.reviewed ? "Reviewed" : "Submitted") : "Not sent"}`}
        accent={RESERVE.gold}
      />
      {!open ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-[64ch] text-[13.5px] leading-[1.6] text-white/70">
            {isSubmitted
              ? "This week's check-in is with your coach."
              : "Send your weekly numbers, context, and questions to your coach."}
          </p>
          {!isSubmitted && (
            <ReserveButton tier="secondary" accent={RESERVE.gold} size="sm" onClick={() => onOpenChange(true)}>
              Start check-in
            </ReserveButton>
          )}
        </div>
      ) : (
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="Training adherence %">
              <input className={INPUT} type="number" inputMode="numeric" min={0} max={100} placeholder="0–100" required value={training ?? ""} onChange={(e) => setTraining(parseAdherencePct(e.target.value))} />
            </Field>
            <Field label="Nutrition adherence %">
              <input className={INPUT} type="number" inputMode="numeric" min={0} max={100} placeholder="0–100" required value={nutrition ?? ""} onChange={(e) => setNutrition(parseAdherencePct(e.target.value))} />
            </Field>
            <Field label="Weight (lb)">
              <input className={INPUT} type="number" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} />
            </Field>
            <Field label="Steps avg">
              <input className={INPUT} type="number" inputMode="numeric" value={steps} onChange={(e) => setSteps(e.target.value)} />
            </Field>
          </div>

          <fieldset>
            <legend className={LABEL}>How the week felt · optional</legend>
            <RecordList label="Weekly scales">
              {(Object.keys(scales) as ScaleKey[]).map((key) => (
                <RecordRow key={key} className="flex flex-wrap items-center justify-between gap-2">
                  <span className="min-w-[88px] text-[13.5px] font-semibold text-white/80">{SCALE_LABELS[key]}</span>
                  <span className="flex items-center gap-1" role="group" aria-label={`${SCALE_LABELS[key]}, 1 to 5`}>
                    {[1, 2, 3, 4, 5].map((n) => {
                      const on = scales[key] !== null && n <= scales[key]!;
                      return (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setScales((prev) => ({ ...prev, [key]: prev[key] === n ? null : (n as 1 | 2 | 3 | 4 | 5) }))}
                          className="grid h-11 w-9 place-items-center"
                          aria-label={`${key} ${n} of 5`}
                          aria-pressed={scales[key] === n}
                        >
                          <span className={`h-5 w-4 rounded-sm transition-colors ${on ? "bg-[#d5b15f]/75" : "bg-white/[0.09]"}`} />
                        </button>
                      );
                    })}
                  </span>
                  <span className="tnum w-[92px] text-right font-mono text-[11px] uppercase tracking-[0.12em] text-white/55">
                    {scales[key] === null ? "Not set" : `${scales[key]}/5`}
                  </span>
                </RecordRow>
              ))}
            </RecordList>
            <p className="mt-2 text-[12px] text-white/55">Scales you leave unset reach your coach as not answered.</p>
          </fieldset>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Cardio completed">
              <input className={INPUT} value={cardio} onChange={(e) => setCardio(e.target.value)} placeholder="e.g. 2 of 3 sessions" />
            </Field>
            <Field label="Pain observations">
              <input className={INPUT} value={pain} onChange={(e) => setPain(e.target.value)} placeholder="Anything worth flagging" />
            </Field>
          </div>
          <Field label="Weekly update">
            <textarea className={`${INPUT} min-h-[72px] resize-none`} value={update} onChange={(e) => setUpdate(e.target.value)} />
          </Field>
          <Field label="Questions for your coach">
            <input className={INPUT} value={questions} onChange={(e) => setQuestions(e.target.value)} />
          </Field>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <ReserveButton tier="quiet" size="md" onClick={() => onOpenChange(false)}>
              Cancel
            </ReserveButton>
            {adherenceReady ? (
              <ReserveButton type="submit" tier="secondary" accent={RESERVE.gold} size="md">
                Submit check-in
              </ReserveButton>
            ) : (
              <ReserveButton type="submit" tier="secondary" accent={RESERVE.gold} size="md" disabled disabledReason="Enter your training and nutrition adherence first">
                Submit check-in
              </ReserveButton>
            )}
          </div>
        </form>
      )}
    </>
  );
}

function DailyWeightForm() {
  const run = useCoachingStore((s) => s.run);
  const actorId = useCoachingStore((s) => s.actorId);
  const weightEntries = useCoachingStore((s) => s.db.weightEntries);
  const latest = useMemo(
    () => weightEntries.filter((entry) => entry.athleteId === actorId).sort((a, b) => b.date.localeCompare(a.date))[0] ?? null,
    [weightEntries, actorId],
  );
  const [weight, setWeight] = useState("");
  const [saved, setSaved] = useState(false);
  const valid = Boolean(weight) && Number(weight) > 0;

  const save = async () => {
    const value = Number(weight);
    if (!Number.isFinite(value) || value <= 0) return;
    const result = await run((r) =>
      r.tracking.addWeight({ athleteId: actorId, date: todayKey(), weightLb: value, note: "Daily entry" }, actorId),
    );
    if (result) {
      setWeight("");
      setSaved(true);
    }
  };

  return (
    <>
      <ReserveSectionHeader label={latest ? `Daily weight · Latest ${latest.weightLb.toFixed(1)} lb` : "Daily weight"} accent={RESERVE.slate} />
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <div className="w-40">
          <Field label="Today (lb)">
            <input
              className={INPUT}
              type="number"
              inputMode="decimal"
              min="1"
              step="0.1"
              value={weight}
              onChange={(event) => {
                setWeight(event.target.value);
                setSaved(false);
              }}
            />
          </Field>
        </div>
        {valid ? (
          <ReserveButton type="submit" tier="secondary" accent={RESERVE.slate} size="md">
            Save entry
          </ReserveButton>
        ) : (
          <ReserveButton type="submit" tier="secondary" accent={RESERVE.slate} size="md" disabled disabledReason="Enter today's weight">
            Save entry
          </ReserveButton>
        )}
        {saved && <span role="status"><RecordTag accent={RESERVE.green}>Saved</RecordTag></span>}
      </form>
    </>
  );
}
