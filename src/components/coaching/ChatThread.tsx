"use client";

/* Operational chat thread — a performance operations channel, not a
   generic messenger. Regular messages plus structured action cards, with
   a manual action composer on the coach side. Rimless: messages separate by
   alignment and a thin rule, never by bubbles inside a panel. */

import { useEffect, useMemo, useRef, useState } from "react";
import { Send, Zap } from "lucide-react";

import { useCoachingStore } from "@/lib/coaching/store";
import type { ChatMessage, Conversation, StructuredMessageAction } from "@/lib/coaching/types";
import { CommandButton, MicroLabel, StatusChip, inputClass, relativeTime } from "./ui";

export function ChatThread({
  thread,
  onOpenTarget,
}: {
  thread: Conversation;
  /** Where the action card CTA routes (live day / prescriptions / check-in). */
  onOpenTarget?: (target: StructuredMessageAction["ctaTarget"]) => void;
}) {
  const actorId = useCoachingStore((s) => s.actorId);
  const run = useCoachingStore((s) => s.run);
  const messages = useCoachingStore((s) => s.db.messages);
  const members = useCoachingStore((s) => s.db.members);
  const [draft, setDraft] = useState("");
  const [composerOpen, setComposerOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const threadMessages = useMemo(
    () => messages.filter((m) => m.threadId === thread.id).sort((a, b) => a.sentAt.localeCompare(b.sentAt)),
    [messages, thread.id],
  );

  const isCoach = actorId === thread.coachId;
  const otherId = isCoach ? thread.athleteId : thread.coachId;
  const otherName = members.find((m) => m.id === otherId)?.name ?? "Member";

  useEffect(() => {
    // Opening (or receiving in) a thread marks it read for the viewer.
    void run((r) => r.messaging.markRead(thread.id, actorId));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mark-read on open + new arrivals only
  }, [thread.id, threadMessages.length]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [threadMessages.length]);

  const send = async () => {
    const body = draft.trim();
    if (!body) return;
    setDraft("");
    await run((r) => r.messaging.sendMessage({ threadId: thread.id, senderId: actorId, body }));
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Messages */}
      <div ref={scrollRef} role="log" aria-label={`Messages with ${otherName}`} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto py-2 pr-1">
        {threadMessages.length === 0 && (
          <div className="m-auto text-center">
            <MicroLabel>Channel</MicroLabel>
            <p className="mt-1 text-[12px] text-white/55">Messages and plan updates with {otherName} appear here.</p>
          </div>
        )}
        {threadMessages.map((message) => (
          <MessageItem key={message.id} message={message} own={message.senderId === actorId} onOpenTarget={onOpenTarget} />
        ))}
      </div>

      {/* Composer */}
      <div className="border-t border-white/[0.06] pt-3">
        {composerOpen && isCoach && <ActionComposer thread={thread} onClose={() => setComposerOpen(false)} />}
        <div className="flex items-center gap-2">
          {isCoach && (
            <button
              type="button"
              onClick={() => setComposerOpen((v) => !v)}
              aria-label={composerOpen ? "Close structured request" : "Send a structured request"}
              aria-expanded={composerOpen}
              className={`grid min-h-[44px] min-w-[44px] place-items-center rounded-lg border transition-colors ${
                composerOpen ? "border-white/25 text-[#f2eee6]" : "border-white/10 text-white/55 hover:text-[#d5b15f]"
              }`}
            >
              <Zap size={15} aria-hidden="true" />
            </button>
          )}
          <input
            className={`${inputClass} flex-1`}
            aria-label={`Message ${otherName}`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
            placeholder={`Message ${otherName.split(" ")[0]}`}
          />
          <button
            type="button"
            onClick={() => void send()}
            disabled={!draft.trim()}
            aria-label="Send message"
            title={draft.trim() ? "Send message" : "Write a message first"}
            className="grid min-h-[44px] min-w-[44px] place-items-center rounded-lg border border-[#5fb7d5]/35 text-[#5fb7d5] transition-colors hover:bg-[#5fb7d5]/[0.08] disabled:opacity-35"
          >
            <Send size={15} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}

function MessageItem({
  message,
  own,
  onOpenTarget,
}: {
  message: ChatMessage;
  own: boolean;
  onOpenTarget?: (target: StructuredMessageAction["ctaTarget"]) => void;
}) {
  const side = own ? "ml-auto border-r-2 pr-3 text-right" : "mr-auto border-l-2 pl-3";
  if (message.action) {
    return (
      <div className={`w-full max-w-[360px] ${side} border-[#5fb7d5]/45`}>
        <div className={`flex items-center gap-2 ${own ? "justify-end" : "justify-between"}`}>
          <MicroLabel tone="teal">{message.action.title}</MicroLabel>
          {message.action.status === "pending" && <StatusChip tone="teal">Open</StatusChip>}
        </div>
        <dl className="mt-1.5 flex flex-col gap-1">
          {message.action.rows.map((row) => (
            <div key={row.label} className="flex items-start justify-between gap-3 text-left">
              <dt className="text-[11.5px] text-white/55">{row.label}</dt>
              <dd className="text-right text-[12px] font-medium text-[#f2eee6]">{row.value}</dd>
            </div>
          ))}
        </dl>
        {message.body && <p className="mt-1.5 text-[12px] leading-[1.45] text-white/70">{message.body}</p>}
        {message.action.ctaTarget !== "none" && onOpenTarget && (
          <CommandButton variant="teal" className="mt-2 w-full" onClick={() => onOpenTarget(message.action!.ctaTarget)}>
            {message.action.ctaLabel}
          </CommandButton>
        )}
        <MicroLabel className="mt-1.5">{relativeTime(message.sentAt)}</MicroLabel>
      </div>
    );
  }
  return (
    <div className={`max-w-[80%] ${side} ${own ? "border-[#d5b15f]/40" : "border-white/15"}`}>
      <p className="text-[13px] leading-[1.5] text-[#f2eee6]/90">{message.body}</p>
      <MicroLabel className="mt-0.5">{relativeTime(message.sentAt)}</MicroLabel>
    </div>
  );
}

/* ─── Manual action composer (coach) ──────────────────────────────────── */

type ComposerKind = "checkin_request" | "photo_request" | "weight_update_request" | "readiness_request" | "recovery_assignment";

const COMPOSER_OPTIONS: Array<{ kind: ComposerKind; label: string; title: string; cta: string; target: StructuredMessageAction["ctaTarget"] }> = [
  { kind: "checkin_request", label: "Check-in", title: "CHECK-IN REQUESTED", cta: "OPEN CHECK-IN", target: "checkin" },
  { kind: "photo_request", label: "Photos", title: "PHOTO SET REQUESTED", cta: "OPEN PHOTOS", target: "photos" },
  { kind: "weight_update_request", label: "Weight update", title: "WEIGHT UPDATE REQUESTED", cta: "LOG WEIGHT", target: "checkin" },
  { kind: "readiness_request", label: "Readiness", title: "READINESS UPDATE REQUESTED", cta: "REPORT READINESS", target: "checkin" },
  { kind: "recovery_assignment", label: "Recovery task", title: "RECOVERY ASSIGNMENT", cta: "REVIEW", target: "none" },
];

function ActionComposer({ thread, onClose }: { thread: Conversation; onClose: () => void }) {
  const actorId = useCoachingStore((s) => s.actorId);
  const run = useCoachingStore((s) => s.run);
  const [kind, setKind] = useState<ComposerKind>("checkin_request");
  const [detail, setDetail] = useState("");

  const sendAction = async () => {
    const option = COMPOSER_OPTIONS.find((o) => o.kind === kind)!;
    await run((r) =>
      r.messaging.sendMessage({
        threadId: thread.id,
        senderId: actorId,
        body: detail.trim(),
        action: {
          kind,
          title: option.title,
          rows: [
            { label: "Requested", value: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }) },
            ...(detail.trim() ? [{ label: "Note", value: detail.trim() }] : []),
          ],
          ctaLabel: option.cta,
          ctaTarget: option.target,
          status: "pending",
        },
      }),
    );
    setDetail("");
    onClose();
  };

  return (
    <div className="mb-3 border-l-2 border-white/[0.12] pl-3">
      <MicroLabel className="mb-2">Request</MicroLabel>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Request type">
        {COMPOSER_OPTIONS.map((option) => (
          <button
            key={option.kind}
            type="button"
            aria-pressed={kind === option.kind}
            onClick={() => setKind(option.kind)}
            className={`min-h-[40px] rounded-md px-2.5 font-mono text-[9px] uppercase tracking-[0.1em] transition-colors ${
              kind === option.kind ? "bg-white/[0.08] text-[#f2eee6]" : "text-white/55 hover:text-white/80"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <input
          className={`${inputClass} flex-1`}
          aria-label="Note attached to the request"
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
          placeholder="Optional note"
        />
        <CommandButton variant="teal" onClick={() => void sendAction()}>Send</CommandButton>
      </div>
    </div>
  );
}
