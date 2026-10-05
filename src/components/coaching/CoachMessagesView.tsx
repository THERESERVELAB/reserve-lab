"use client";

/* Coach messages — one statement about what is unread, conversations as
   rows, and the selected channel beside them. */

import { useEffect } from "react";

import { useCoachingStore } from "@/lib/coaching/store";
import { resolveMessagesBrief } from "@/lib/coaching/workspace-brief";
import { ChatThread } from "./ChatThread";
import { clearCoachIntent, focusCoachTarget, peekCoachIntent, useCoachDecisionInput, useRunCoachAction } from "./coach-actions";
import { CoachHero, CoachPage, CoachSection, EmptyState, relativeTime } from "./ui";

export function CoachMessagesView() {
  const db = useCoachingStore((s) => s.db);
  const actorId = useCoachingStore((s) => s.actorId);
  const activeThreadId = useCoachingStore((s) => s.activeThreadId);
  const setActiveThread = useCoachingStore((s) => s.setActiveThread);
  const setCoachView = useCoachingStore((s) => s.setCoachView);
  const openClient = useCoachingStore((s) => s.openClient);
  const input = useCoachDecisionInput();
  const runAction = useRunCoachAction();

  useEffect(() => {
    if (peekCoachIntent("thread")) focusCoachTarget("coach-thread", "input");
    clearCoachIntent("thread");
  }, []);

  const threads = db.conversations
    .filter((c) => {
      if (c.coachId !== actorId && c.athleteId !== actorId) return false;
      // Ended relationships leave the channel list; message history stays stored.
      const rel = db.relationships.find((r) => r.id === c.relationshipId);
      return !!rel && rel.status !== "revoked" && rel.status !== "archived";
    })
    .sort((a, b) => (b.lastMessageAt ?? b.createdAt).localeCompare(a.lastMessageAt ?? a.createdAt));

  const selected = threads.find((t) => t.id === activeThreadId) ?? threads[0] ?? null;
  const brief = resolveMessagesBrief(input, threads.length);
  const unreadTotal = input.unreadThreads.reduce((sum, t) => sum + t.unread, 0);

  return (
    <CoachPage screen="messages">
      <CoachHero
        title="Messages"
        brief={brief}
        reads={[
          { label: "Unread", value: String(unreadTotal) },
          { label: "Conversations", value: String(threads.length) },
        ]}
        onPrimary={() => {
          const action = brief.primary;
          if (!action) return;
          if (action.kind === "open-thread") {
            setActiveThread(action.threadId);
            focusCoachTarget("coach-thread", "input");
          } else runAction(action);
        }}
      />

      {threads.length === 0 ? (
        <CoachSection label="Conversations">
          <EmptyState
            title="No conversations"
            body="A channel opens by itself when an athlete accepts your invitation."
            requirements={["An invitation the athlete accepts"]}
          />
        </CoachSection>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[300px_1fr] lg:items-start">
          <CoachSection label={`Conversations · ${threads.length}`}>
            <ul className="flex flex-col [&>li+li]:border-t [&>li+li]:border-white/[0.05]">
              {threads.map((thread) => {
                const otherId = thread.coachId === actorId ? thread.athleteId : thread.coachId;
                const other = db.members.find((m) => m.id === otherId);
                const unread = db.messages.filter(
                  (m) => m.threadId === thread.id && m.senderId !== actorId && m.sentAt > (thread.lastReadAt[actorId] ?? ""),
                ).length;
                const active = selected?.id === thread.id;
                return (
                  <li key={thread.id}>
                    <button
                      type="button"
                      aria-current={active ? "true" : undefined}
                      onClick={() => setActiveThread(thread.id)}
                      className={`flex min-h-[56px] w-full flex-col justify-center py-2.5 text-left transition-colors ${active ? "text-[#f2eee6]" : "text-white/70 hover:text-white/90"}`}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className={`text-[13.5px] font-semibold ${active ? "text-[#d5b15f]" : ""}`}>{other?.name ?? "Member"}</span>
                        {unread > 0 ? (
                          <span className="tnum font-mono text-[10px] text-[#5fb7d5]">{unread} unread</span>
                        ) : (
                          <span className="tnum font-mono text-[10px] text-white/45">{relativeTime(thread.lastMessageAt)}</span>
                        )}
                      </span>
                      <span className="mt-0.5 truncate text-[12px] text-white/55">{thread.lastMessagePreview ?? "No messages yet"}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </CoachSection>

          <CoachSection label={selected ? `Channel · ${db.members.find((m) => m.id === (selected.coachId === actorId ? selected.athleteId : selected.coachId))?.name ?? "Member"}` : "Channel"}>
            <div id="coach-thread" className="flex h-[min(560px,70dvh)] flex-col">
              {selected && (
                <ChatThread
                  thread={selected}
                  onOpenTarget={(target) => {
                    const athleteId = selected.coachId === actorId ? selected.athleteId : selected.coachId;
                    if (target === "live_day") setCoachView("live");
                    else if (target === "checkin") setCoachView("reviews");
                    else openClient(athleteId);
                  }}
                />
              )}
            </div>
          </CoachSection>
        </div>
      )}
    </CoachPage>
  );
}
