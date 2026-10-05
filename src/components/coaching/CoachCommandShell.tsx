"use client";

/* ════════════════════════════════════════════════════════════════════════
   COACH COMMAND SHELL — the coach workspace inside the same Reserve account.

   Entirely separate chrome from Personal Apex: its own navigation, wider
   command layout, and its own data scope. The coach's personal athlete
   state stays untouched in the background — switching back restores it
   exactly as it was.

   Overlays (sheets) portal to <body> above this chrome, so the phone tab bar
   can never sit on top of a form's Save button.
   ════════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  Bell,
  CalendarClock,
  ClipboardCheck,
  Dumbbell,
  LayoutDashboard,
  Layers,
  MessageSquare,
  MoreHorizontal,
  User,
  Users,
  Utensils,
  Zap,
} from "lucide-react";

import { ReserveBottomSheet } from "@/components/ui/reserve";
import { canAccessCoachCommand } from "@/lib/coaching/entitlements";
import { currentCoachingMember, useCoachingStore, type CoachView } from "@/lib/coaching/store";
import { AlertsView } from "./AlertsView";
import { ClientCommand } from "./ClientCommand";
import { ClientRoster } from "./ClientRoster";
import { CoachDashboard } from "./CoachDashboard";
import { CoachMessagesView } from "./CoachMessagesView";
import { LiveDecisionsView } from "./LiveDecisionsView";
import { PrescriptionsView } from "./PrescriptionsView";
import { ReviewQueueView } from "./ReviewQueueView";
import { TemplatesView } from "./TemplatesView";
import { MicroLabel } from "./ui";

type NavItem = { view: CoachView; label: string; icon: React.ComponentType<{ size?: number; className?: string; "aria-hidden"?: boolean }> };

const NAV_ITEMS: NavItem[] = [
  { view: "command", label: "Command", icon: LayoutDashboard },
  { view: "clients", label: "Clients", icon: Users },
  { view: "messages", label: "Messages", icon: MessageSquare },
  { view: "reviews", label: "Reviews", icon: ClipboardCheck },
  { view: "programs", label: "Programs", icon: Dumbbell },
  { view: "nutrition", label: "Nutrition", icon: Utensils },
  { view: "schedules", label: "Schedules", icon: CalendarClock },
  { view: "live", label: "Live Decisions", icon: Zap },
  { view: "alerts", label: "Alerts", icon: Bell },
  { view: "templates", label: "Templates", icon: Layers },
];

const MOBILE_PRIMARY: CoachView[] = ["command", "clients", "messages", "reviews"];

export function CoachCommandShell() {
  const coachView = useCoachingStore((s) => s.coachView);
  const setCoachView = useCoachingStore((s) => s.setCoachView);
  const setWorkspace = useCoachingStore((s) => s.setWorkspace);
  const alerts = useCoachingStore((s) => s.alerts);
  const unreadTotal = useCoachingStore((s) => s.unreadTotal);
  const lastError = useCoachingStore((s) => s.lastError);
  const clearError = useCoachingStore((s) => s.clearError);
  const member = useCoachingStore(currentCoachingMember);
  const coachProfile = useCoachingStore((s) =>
    s.db.coachProfiles.find((c) => c.memberId === s.actorId),
  );
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const closeMore = useCallback(() => setMobileMoreOpen(false), []);

  // Entitlement guard: never render the coach workspace without eligibility.
  useEffect(() => {
    if (member && !canAccessCoachCommand(member)) setWorkspace("personal");
  }, [member, setWorkspace]);

  useEffect(() => {
    if (!lastError) return;
    const t = setTimeout(clearError, 6000);
    return () => clearTimeout(t);
  }, [lastError, clearError]);

  const openAlerts = alerts.filter((a) => a.status === "open").length;

  const badgeFor = (view: CoachView): number =>
    view === "messages" ? unreadTotal : view === "alerts" ? openAlerts : 0;
  const badgeText = (view: CoachView, n: number) =>
    view === "messages" ? `${n} unread` : `${n} open`;

  /* Development fixtures are synthetic people. Say so wherever they show. */
  const sample = Boolean(member?.isDemo);

  return (
    <div data-coach-shell className="safe-x relative flex h-dvh flex-col overflow-hidden bg-[#07080c]">
      {/* Header */}
      <header
        className="safe-top z-20 flex min-h-[56px] flex-shrink-0 items-center justify-between gap-3 border-b border-white/[0.06] bg-[#08090e] px-3 sm:px-4"
        style={{ boxShadow: "inset 0 -1px 0 rgba(213,177,95,0.1)" }}
      >
        <div className="flex min-w-0 items-center gap-3">
          <Zap size={15} className="shrink-0 text-[#d5b15f]" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-[13px] font-black uppercase tracking-[0.14em] text-[#f2eee6]">Coach Command</p>
            {sample ? (
              <p data-coach="sample-label" className="font-mono text-[9px] uppercase tracking-[0.18em] text-[#e8c87a]">
                Sample clients · development data
              </p>
            ) : (
              <MicroLabel className="max-sm:hidden">Your coaching workspace</MicroLabel>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setWorkspace("personal")}
            className="flex min-h-[44px] items-center gap-1.5 rounded-lg px-3 font-mono text-[9px] uppercase tracking-[0.14em] text-white/60 transition-colors hover:text-white/90"
          >
            <User size={12} aria-hidden="true" />
            <span>Personal Apex</span>
          </button>
          <div className="hidden items-center gap-2.5 md:flex">
            <div className="text-right">
              <p className="text-[11px] font-bold text-[#f2eee6]">{member?.name ?? "Coach"}</p>
              {coachProfile?.headline && <MicroLabel tone="champagne">{coachProfile.headline}</MicroLabel>}
            </div>
          </div>
        </div>
      </header>

      <div className="relative z-10 flex min-h-0 flex-1">
        {/* Desktop nav rail */}
        <nav aria-label="Coach workspace" className="hidden w-[196px] flex-shrink-0 flex-col border-r border-white/[0.05] bg-[#090a10] py-3 md:flex">
          {NAV_ITEMS.map((item) => {
            const active = coachView === item.view || (item.view === "clients" && coachView === "client");
            const badge = badgeFor(item.view);
            return (
              <button
                key={item.view}
                type="button"
                aria-current={active ? "page" : undefined}
                onClick={() => setCoachView(item.view)}
                className={`mx-2 mb-0.5 flex min-h-[40px] items-center justify-between rounded-lg px-3 text-left transition-colors duration-150 ${
                  active ? "bg-[#d5b15f]/[0.09] text-[#d5b15f]" : "text-white/55 hover:bg-white/[0.04] hover:text-white/85"
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <item.icon size={14} aria-hidden />
                  <span className="font-mono text-[10px] font-bold uppercase tracking-[0.12em]">{item.label}</span>
                </span>
                {badge > 0 && (
                  <span className="tnum font-mono text-[10px] font-bold text-[#5fb7d5]">
                    {badge}
                    <span className="sr-only"> {badgeText(item.view, badge)}</span>
                  </span>
                )}
              </button>
            );
          })}
          <div className="mt-auto px-4 pt-3">
            <ActorSwitcher />
          </div>
        </nav>

        {/* Main surface. On phones the bottom padding clears the tab bar and the home indicator. */}
        <main className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden pb-[calc(88px+env(safe-area-inset-bottom,0px))] md:pb-0">
          <div key={coachView}>
            <CoachViewRouter view={coachView} />
          </div>
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav
        aria-label="Coach workspace"
        data-coach="tab-bar"
        className="safe-bottom fixed inset-x-0 bottom-0 z-30 flex border-t border-white/[0.07] bg-[#08090e]/95 backdrop-blur-md md:hidden"
      >
        {MOBILE_PRIMARY.map((view) => {
          const item = NAV_ITEMS.find((n) => n.view === view)!;
          const active = coachView === view || (view === "clients" && coachView === "client");
          const badge = badgeFor(view);
          return (
            <button
              key={view}
              type="button"
              aria-current={active ? "page" : undefined}
              onClick={() => setCoachView(view)}
              className={`relative flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1 ${active ? "text-[#d5b15f]" : "text-white/55"}`}
            >
              <item.icon size={16} aria-hidden />
              <span className="font-mono text-[9px] uppercase tracking-[0.1em]">{item.label}</span>
              {badge > 0 && (
                <>
                  <span aria-hidden="true" className="absolute right-[22%] top-2 h-1.5 w-1.5 rounded-full bg-[#5fb7d5]" />
                  <span className="sr-only">{badgeText(view, badge)}</span>
                </>
              )}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setMobileMoreOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={mobileMoreOpen}
          className={`flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1 ${
            !MOBILE_PRIMARY.includes(coachView) && coachView !== "client" ? "text-[#d5b15f]" : "text-white/55"
          }`}
        >
          <MoreHorizontal size={16} aria-hidden="true" />
          <span className="font-mono text-[9px] uppercase tracking-[0.1em]">More</span>
        </button>
      </nav>

      <ReserveBottomSheet open={mobileMoreOpen} onClose={closeMore} title="More coach screens">
        <ul className="flex flex-col [&>li+li]:border-t [&>li+li]:border-white/[0.05]">
          {NAV_ITEMS.filter((item) => !MOBILE_PRIMARY.includes(item.view)).map((item) => {
            const badge = badgeFor(item.view);
            return (
              <li key={item.view}>
                <button
                  type="button"
                  aria-current={coachView === item.view ? "page" : undefined}
                  onClick={() => {
                    setCoachView(item.view);
                    setMobileMoreOpen(false);
                  }}
                  className={`flex min-h-[52px] w-full items-center gap-3 text-left ${coachView === item.view ? "text-[#d5b15f]" : "text-white/75"}`}
                >
                  <item.icon size={15} aria-hidden />
                  <span className="flex-1 text-[14px] font-medium">{item.label}</span>
                  {badge > 0 && <span className="tnum font-mono text-[11px] text-[#5fb7d5]">{badgeText(item.view, badge)}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      </ReserveBottomSheet>

      {/* Error surface */}
      {lastError && (
        <div
          role="alert"
          className="fixed bottom-[calc(72px+env(safe-area-inset-bottom,0px))] left-1/2 z-50 max-w-[calc(100vw-24px)] -translate-x-1/2 rounded-xl border border-[#ef7d55]/30 bg-[#0d0e14] px-4 py-2.5 md:bottom-6"
          style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.6)" }}
        >
          <span className="text-[12px] text-[#ef7d55]">{lastError}</span>
        </div>
      )}
    </div>
  );
}

function CoachViewRouter({ view }: { view: CoachView }) {
  switch (view) {
    case "command": return <CoachDashboard />;
    case "clients": return <ClientRoster />;
    case "client": return <ClientCommand />;
    case "messages": return <CoachMessagesView />;
    case "reviews": return <ReviewQueueView />;
    case "programs": return <PrescriptionsView category="training" />;
    case "nutrition": return <PrescriptionsView category="nutrition" />;
    case "schedules": return <PrescriptionsView category="schedule" />;
    case "live": return <LiveDecisionsView />;
    case "alerts": return <AlertsView />;
    case "templates": return <TemplatesView />;
    default: return <CoachDashboard />;
  }
}

/** Development-only fixture switcher — never rendered in production builds. */
function ActorSwitcher() {
  const actorId = useCoachingStore((s) => s.actorId);
  const setActor = useCoachingStore((s) => s.setActor);
  const members = useCoachingStore((s) => s.db.members);
  if (process.env.NODE_ENV !== "development") return null;
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.2em] text-white/45">
        <Activity size={9} aria-hidden="true" /> Development actor
      </span>
      <select
        value={actorId}
        onChange={(e) => setActor(e.target.value)}
        className="w-full rounded-md border border-white/10 bg-[#0b0c12] px-2 py-1.5 font-mono text-[10px] text-white/65 outline-none"
      >
        {members.map((m) => (
          <option key={m.id} value={m.id}>{m.name}</option>
        ))}
      </select>
    </label>
  );
}
