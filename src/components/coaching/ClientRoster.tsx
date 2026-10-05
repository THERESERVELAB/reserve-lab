"use client";

/* CLIENT ROSTER — one statement about the roster, one gold action (invite,
   or review an athlete's request), then clients and invitations as rows.
   The invitation flow is a sheet that never closes on an outside click once
   something is typed (FormCloseGuard). */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, ChevronRight, Copy, Search } from "lucide-react";

import { ReserveBottomSheet, ReserveSheetClose, useDirtySnapshot, useReportDirty } from "@/components/ui/reserve";
import { DEFAULT_REQUESTED_PERMISSIONS, clonePermissions } from "@/lib/coaching/permissions";
import { useCoachingStore } from "@/lib/coaching/store";
import type { ClientSummary, CoachingInvitation, CoachingPermissions } from "@/lib/coaching/types";
import { resolveRosterBrief } from "@/lib/coaching/workspace-brief";
import { clearCoachIntent, focusCoachTarget, peekCoachIntent, useCoachDecisionInput, useRunCoachAction } from "./coach-actions";
import { PermissionEditor } from "./PermissionEditor";
import {
  CoachHero,
  CoachPage,
  CoachSection,
  CommandButton,
  EmptyState,
  Field,
  RowList,
  SegmentedControl,
  StatusChip,
  inputClass,
  relativeTime,
} from "./ui";

type RosterFilter = "all" | "active" | "pending" | "paused" | "archived";

const FILTERS: Array<{ value: RosterFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "pending", label: "Invited" },
  { value: "paused", label: "Paused" },
  { value: "archived", label: "Archived" },
];

export function ClientRoster() {
  const clients = useCoachingStore((s) => s.clients);
  const invitations = useCoachingStore((s) => s.db.invitations);
  const actorId = useCoachingStore((s) => s.actorId);
  const input = useCoachDecisionInput();
  const run = useRunCoachAction();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<RosterFilter>("all");
  const [addOpen, setAddOpen] = useState(() => peekCoachIntent("invite") !== null);
  const [reviewingId, setReviewingId] = useState<string | null>(() => peekCoachIntent("review-request")?.invitationId ?? null);
  const closeAdd = useCallback(() => setAddOpen(false), []);

  useEffect(() => {
    const request = peekCoachIntent("review-request");
    if (request) focusCoachTarget(`invite-${request.invitationId}`);
    clearCoachIntent("invite");
    clearCoachIntent("review-request");
  }, []);

  const brief = resolveRosterBrief(input);
  const pendingInvites = invitations.filter(
    (i) => i.coachId === actorId && (i.status === "sent" || i.status === "viewed"),
  );

  const visible = useMemo(() => {
    let list = clients;
    if (filter !== "all" && filter !== "pending") list = list.filter((c) => c.status === filter);
    if (filter === "pending") list = [];
    const q = query.trim().toLowerCase();
    if (q) list = list.filter((c) => c.name.toLowerCase().includes(q) || c.goal.toLowerCase().includes(q));
    return list;
  }, [clients, filter, query]);

  const onPrimary = () => {
    const action = brief.primary;
    if (!action) return;
    if (action.kind === "invite-client") setAddOpen(true);
    else if (action.kind === "review-athlete-request") {
      setFilter("all");
      setReviewingId(action.invitationId);
      focusCoachTarget(`invite-${action.invitationId}`);
    } else run(action);
  };

  return (
    <CoachPage screen="clients">
      <CoachHero
        title="Clients"
        brief={brief}
        reads={[
          { label: "Active", value: String(input.activeClients.length) },
          { label: "Invited", value: String(input.pendingInvitations) },
          { label: "Requests", value: String(input.athleteRequests.length) },
        ]}
        onPrimary={onPrimary}
      />

      {(clients.length > 0 || pendingInvites.length > 0) && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="relative block min-w-0 flex-1 sm:max-w-xs">
            <span className="sr-only">Search clients</span>
            <Search size={14} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search clients" className={`${inputClass} pl-9`} />
          </label>
          <SegmentedControl label="Filter clients" options={FILTERS} value={filter} onChange={setFilter} />
        </div>
      )}

      {filter !== "pending" && (
        <CoachSection label={clients.length > 0 ? `Clients · ${visible.length}` : "Clients"}>
          {clients.length === 0 ? (
            <EmptyState
              title="No clients connected"
              body="An invitation becomes a client once the athlete accepts it."
              requirements={["The athlete's name and email", "The access you want to ask for", "The athlete's approval"]}
            />
          ) : visible.length === 0 ? (
            <EmptyState title="No matches" body="No client matches this search or filter." />
          ) : (
            <RowList label="Clients">
              {visible.map((client) => (
                <ClientRow key={client.relationshipId} client={client} />
              ))}
            </RowList>
          )}
        </CoachSection>
      )}

      {(filter === "all" || filter === "pending") && pendingInvites.length > 0 && (
        <CoachSection label={`Invitations · ${pendingInvites.length}`}>
          <RowList label="Pending invitations">
            {pendingInvites.map((invite) => (
              <InvitationRow
                key={invite.id}
                invite={invite}
                reviewing={reviewingId === invite.id}
                onToggleReview={() => setReviewingId((id) => (id === invite.id ? null : invite.id))}
              />
            ))}
          </RowList>
        </CoachSection>
      )}

      <AddClientSheet open={addOpen} onClose={closeAdd} />
    </CoachPage>
  );
}

/* ─── Client row ──────────────────────────────────────────────────────── */

function ClientRow({ client }: { client: ClientSummary }) {
  const openClient = useCoachingStore((s) => s.openClient);
  const trend = client.weightTrend.weeklyDeltaLb;
  return (
    <li>
      <button
        type="button"
        onClick={() => openClient(client.athleteId)}
        className="group flex min-h-[64px] w-full items-center gap-3 py-3 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-[14px] font-semibold text-[#f2eee6]">{client.name}</span>
            {client.status !== "active" && <StatusChip tone="neutral">{client.status}</StatusChip>}
            {client.liveDayState === "conflict" && <StatusChip tone="red">Conflict</StatusChip>}
            {client.liveDayState === "awaiting_review" && <StatusChip tone="teal">Live review</StatusChip>}
          </span>
          <span className="mt-0.5 block truncate text-[12px] text-white/60">
            {client.goal} · Week {client.phaseWeek} of {client.phaseTotalWeeks}
          </span>
          <span className="tnum mt-1 block text-[11.5px] text-white/55">
            {trend === null ? "No weight trend" : `${trend > 0 ? "+" : ""}${trend} lb / wk`}
            {" · "}
            {client.adherencePct === null ? "Adherence not reported" : `${client.adherencePct}% adherence`}
            {" · "}Check-in {relativeTime(client.lastCheckInAt).toLowerCase()}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {client.unreadMessages > 0 && <StatusChip tone="teal">{client.unreadMessages} unread</StatusChip>}
          <ChevronRight size={14} aria-hidden="true" className="text-white/35 transition-colors group-hover:text-[#d5b15f]" />
        </span>
      </button>
    </li>
  );
}

/* ─── Pending invitation row ──────────────────────────────────────────── */

function InvitationRow({
  invite,
  reviewing,
  onToggleReview,
}: {
  invite: CoachingInvitation;
  reviewing: boolean;
  onToggleReview: () => void;
}) {
  const run = useCoachingStore((s) => s.run);
  const actorId = useCoachingStore((s) => s.actorId);
  const [copied, setCopied] = useState<"link" | "code" | null>(null);
  const [requested, setRequested] = useState<CoachingPermissions>(() => clonePermissions(DEFAULT_REQUESTED_PERMISSIONS));

  const copy = async (kind: "link" | "code") => {
    try {
      await navigator.clipboard.writeText(kind === "link" ? invite.invitationLink : invite.connectionCode);
      setCopied(kind);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      /* Clipboard denied — the values remain visible for manual copy. */
    }
  };

  const fromAthlete = invite.direction === "athlete_to_coach";

  return (
    <li id={`invite-${invite.id}`} tabIndex={-1} className="scroll-mt-24 py-3 outline-none">
      <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2">
            <span className="text-[14px] font-semibold text-[#f2eee6]">{invite.athleteName}</span>
            <StatusChip tone={fromAthlete ? "champagne" : "neutral"}>{fromAthlete ? "Asked to be coached" : "Awaiting athlete"}</StatusChip>
          </p>
          <p className="tnum mt-0.5 text-[12px] text-white/60">
            {invite.athleteEmail} · Sent {relativeTime(invite.createdAt).toLowerCase()} · Expires{" "}
            {new Date(invite.expiresAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </p>
          {!fromAthlete && (
            <p className="mt-0.5 font-mono text-[11px] text-white/60">
              Code <span className="text-[#f2eee6]">{invite.connectionCode}</span>
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {fromAthlete ? (
            <>
              <CommandButton onClick={onToggleReview}>{reviewing ? "Close review" : "Review request"}</CommandButton>
              <CommandButton variant="danger" onClick={() => void run((r) => r.coaching.declineInvitation(invite.id, actorId))}>
                Decline
              </CommandButton>
            </>
          ) : (
            <>
              <CommandButton variant="ghost" ariaLabel={`Copy invitation link for ${invite.athleteName}`} onClick={() => void copy("link")}>
                {copied === "link" ? <Check size={12} aria-hidden="true" /> : <Copy size={12} aria-hidden="true" />} Link
              </CommandButton>
              <CommandButton variant="ghost" ariaLabel={`Copy connection code for ${invite.athleteName}`} onClick={() => void copy("code")}>
                {copied === "code" ? <Check size={12} aria-hidden="true" /> : <Copy size={12} aria-hidden="true" />} Code
              </CommandButton>
              <CommandButton variant="ghost" onClick={() => void run((r) => r.coaching.resendInvitation(invite.id, actorId))}>
                Resend
              </CommandButton>
              <CommandButton variant="danger" onClick={() => void run((r) => r.coaching.revokeInvitation(invite.id, actorId))}>
                Revoke
              </CommandButton>
            </>
          )}
        </div>
      </div>
      {fromAthlete && reviewing && (
        <div className="mt-3 border-l-2 border-[#d5b15f]/30 pl-3.5">
          <p className="mb-3 max-w-[60ch] text-[12.5px] leading-[1.5] text-white/65">
            Choose the access to ask for. The athlete reviews it and decides; nothing is shared yet.
          </p>
          <PermissionEditor value={requested} onChange={setRequested} />
          <div className="mt-3 flex justify-end">
            <CommandButton
              onClick={() => {
                void run((r) => r.coaching.approveConnectionRequest(invite.id, actorId, requested));
                onToggleReview();
              }}
            >
              Send access request
            </CommandButton>
          </div>
        </div>
      )}
    </li>
  );
}

/* ─── Add client (sheet) ──────────────────────────────────────────────── */

type AddStep = "details" | "access" | "created";

/* The form mounts only while the sheet is open, so it starts clean every time. */
function AddClientSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [dirty, setDirty] = useState(false);
  const [step, setStep] = useState<AddStep>("details");
  const title = step === "details" ? "Invite a client" : step === "access" ? "Access to ask for" : "Invitation ready";
  const close = useCallback(() => {
    setDirty(false);
    setStep("details");
    onClose();
  }, [onClose]);
  return (
    <ReserveBottomSheet open={open} onClose={close} title={title} dirty={dirty}>
      {open && <AddClientForm onClose={close} step={step} setStep={setStep} onDirtyChange={setDirty} />}
    </ReserveBottomSheet>
  );
}

function AddClientForm({
  onClose,
  step,
  setStep,
  onDirtyChange,
}: {
  onClose: () => void;
  step: AddStep;
  setStep: (step: AddStep) => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const run = useCoachingStore((s) => s.run);
  const actorId = useCoachingStore((s) => s.actorId);
  const coachProfile = useCoachingStore((s) => s.db.coachProfiles.find((c) => c.memberId === s.actorId));
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [permissions, setPermissions] = useState<CoachingPermissions>(clonePermissions(DEFAULT_REQUESTED_PERMISSIONS));
  const [created, setCreated] = useState<CoachingInvitation | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  /* Once the invitation exists, closing loses nothing. */
  const changed = useDirtySnapshot({ name, email, phone, note, permissions });
  const dirty = step !== "created" && changed;
  useReportDirty(dirty, onDirtyChange);

  const detailsValid = name.trim().length > 1 && /.+@.+\..+/.test(email.trim());

  const generate = async () => {
    const invitation = await run((r) =>
      r.coaching.createInvitation({
        coachId: actorId,
        athleteName: name,
        athleteEmail: email,
        athletePhone: phone || undefined,
        requestedPermissions: permissions,
        welcomeNote: note || undefined,
      }),
    );
    if (invitation) {
      setCreated(invitation);
      setStep("created");
    }
  };

  const copy = async (value: string, key: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      /* values stay visible for manual copy */
    }
  };

  if (step === "details") {
    return (
      <div className="flex flex-col gap-3 pb-1">
        <Field label="Client name">
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" autoComplete="off" />
        </Field>
        <Field label="Client email" hint="The invitation link and code are tied to this email.">
          <input className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@email.com" type="email" autoComplete="off" />
        </Field>
        <Field label="Phone (optional)" hint="Kept for later reminders. Email stays the identity.">
          <input className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 …" autoComplete="off" />
        </Field>
        <Field label="Welcome note (optional)">
          <textarea className={`${inputClass} min-h-[64px] resize-none`} value={note} onChange={(e) => setNote(e.target.value)} placeholder="A short note shown on the invitation" />
        </Field>
        <div className="flex gap-2">
          <ReserveSheetClose fallback={onClose}>{(close) => <CommandButton variant="ghost" onClick={close}>Cancel</CommandButton>}</ReserveSheetClose>
          <CommandButton className="flex-1" disabled={!detailsValid} disabledReason="Name and a valid email are required" onClick={() => setStep("access")}>
            Choose access
          </CommandButton>
        </div>
      </div>
    );
  }

  if (step === "access") {
    return (
      <div className="flex flex-col gap-4 pb-1">
        <p className="text-[12.5px] leading-[1.5] text-white/65">
          This is what you ask for. {name.split(" ")[0] || "The athlete"} decides what to grant. Photo access is always a separate decision.
        </p>
        <PermissionEditor value={permissions} onChange={setPermissions} />
        <div className="flex gap-2">
          <CommandButton variant="ghost" onClick={() => setStep("details")}>Back</CommandButton>
          <CommandButton className="flex-1" onClick={() => void generate()}>Create invitation</CommandButton>
        </div>
      </div>
    );
  }

  if (!created) return null;
  return (
    <div className="flex flex-col gap-3 pb-1">
      <CopyRow label="Invitation link" value={created.invitationLink} copied={copied === "link"} onCopy={() => void copy(created.invitationLink, "link")} />
      <CopyRow label="Connection code" value={created.connectionCode} copied={copied === "code"} onCopy={() => void copy(created.connectionCode, "code")} />
      <p className="text-[12px] leading-[1.5] text-white/60">
        Reserve does not email this yet. Share the link or code with {created.athleteName.split(" ")[0]} yourself. Expires{" "}
        {new Date(created.expiresAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}.
      </p>
      <div className="border-l-2 border-[#d5b15f]/30 pl-3.5">
        <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/50">What {created.athleteName.split(" ")[0]} sees</p>
        <p className="mt-1.5 text-[13px] font-semibold text-[#f2eee6]">
          {coachProfile?.displayName ?? "Your coach"} wants to connect to your Reserve profile.
        </p>
        {created.welcomeNote && <p className="mt-1 text-[12px] italic text-white/60">“{created.welcomeNote}”</p>}
        <p className="mt-1 text-[12px] text-white/55">They review the access, change anything, then accept or decline.</p>
      </div>
      <CommandButton onClick={onClose}>Done</CommandButton>
    </div>
  );
}

function CopyRow({ label, value, copied, onCopy }: { label: string; value: string; copied: boolean; onCopy: () => void }) {
  return (
    <div className="flex items-center justify-between gap-2 border-t border-white/[0.06] pt-2.5">
      <div className="min-w-0">
        <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/50">{label}</p>
        <p className="truncate font-mono text-[12px] text-white/75">{value}</p>
      </div>
      <button
        type="button"
        onClick={onCopy}
        aria-label={copied ? `${label} copied` : `Copy ${label.toLowerCase()}`}
        className="grid min-h-[44px] min-w-[44px] shrink-0 place-items-center rounded-lg border border-white/10 text-white/60 transition-colors hover:text-[#d5b15f]"
      >
        {copied ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
      </button>
    </div>
  );
}
