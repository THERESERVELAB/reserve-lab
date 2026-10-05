"use client";

import { Bell, Menu, Pause, Play } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { useAthleteDashboardStore } from "@/lib/athlete-store";
import { SyncStatusChip } from "@/components/sync/SyncStatusChip";
import { RESERVE_SHELL_SLOT_ID } from "@/components/ui/reserve/ReserveShellPortal";
import { ReserveLiveNumber } from "@/components/ui/reserve/ReserveLiveNumber";
import { buildRecoverySnapshot } from "@/lib/recovery/engine";
import { canAccessCoachCommand } from "@/lib/coaching/entitlements";
import { currentCoachingMember, useCoachingStore } from "@/lib/coaching/store";
import { RESERVE } from "@/lib/design/tokens";
import { useIsPhone } from "@/lib/hooks/useMediaQuery";
import { viewLabel } from "@/lib/modules/registry";
import { useAmbientMotionStore } from "@/lib/ui/ambient-motion-store";

/** PERSONAL APEX / COACH COMMAND switch — rendered only for eligible
    Premium Coach accounts. Switching preserves all athlete-side state.
    On phones it lives in the More sheet. */
function CoachCommandSwitch() {
  const member = useCoachingStore(currentCoachingMember);
  const setWorkspace = useCoachingStore((s) => s.setWorkspace);
  if (!canAccessCoachCommand(member)) return null;
  return (
    <button
      type="button"
      onClick={() => setWorkspace("coach")}
      className="fba-target relative flex items-center gap-1.5 rounded-md border border-[#d5b15f]/25 bg-[#d5b15f]/[0.06] px-2.5 py-1.5 font-mono text-[8px] font-bold uppercase tracking-[0.16em] text-[#d5b15f]/85 transition-colors duration-150 hover:bg-[#d5b15f]/[0.13]"
    >
      Coach Command
    </button>
  );
}

/** Personalized avatar chip — display-only, so it stays a <div>, named as an
    image. The 44px hit area carries its name/goal tooltip. */
function AvatarChip({ name, goal }: { name: string; goal: string }) {
  return (
    <div
      className="fba-target relative flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md border border-[#d5b15f]/22 bg-[#d5b15f]/10 font-mono text-[10px] font-bold text-[#d5b15f]"
      style={{ boxShadow: "0 0 8px rgba(213,177,95,0.1)" }}
      role="img"
      aria-label={`${name}'s profile`}
      title={`${name} · ${goal}`}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

/**
 * Phones only: true once the page's h1 has scrolled up under the top bar, so
 * the bar can carry a compact room title. Watches <main> for the h1 of
 * whichever room is on screen, because rooms swap and render after the shell.
 */
function useRoomTitleCondensed(enabled: boolean): boolean {
  const [condensed, setCondensed] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const main = document.querySelector("main");
    if (!main) return;

    /* The top bar is 48px; an h1 counts as gone once it is fully behind it. */
    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1];
        setCondensed(!entry.isIntersecting && entry.boundingClientRect.top < 48);
      },
      { rootMargin: "-48px 0px 0px 0px" },
    );
    let observed: Element | null = null;
    let frame = 0;
    const attach = () => {
      frame = 0;
      const h1 = Array.from(main.querySelectorAll("h1")).find((el) => el.getClientRects().length > 0) ?? null;
      if (h1 === observed) return;
      if (observed) io.unobserve(observed);
      observed = h1;
      if (h1) io.observe(h1);
      else setCondensed(false);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(attach);
    };
    const mutations = new MutationObserver(schedule);
    mutations.observe(main, { childList: true, subtree: true });
    schedule();
    return () => {
      mutations.disconnect();
      io.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [enabled]);

  return enabled && condensed;
}

export function TopBar() {
  const activeView = useAthleteDashboardStore((state) => state.activeView);
  const toggleSidebar = useAthleteDashboardStore((state) => state.toggleSidebar);
  const sidebarCollapsed = useAthleteDashboardStore((state) => state.sidebarCollapsed);
  const motionPaused = useAmbientMotionStore((state) => state.paused);
  const motionAvailable = useAmbientMotionStore((state) => state.available);
  const toggleMotion = useAmbientMotionStore((state) => state.togglePaused);
  const isPhone = useIsPhone();
  const condensed = useRoomTitleCondensed(isPhone);
  /* The registry names every view, so the bar can never print a raw id. */
  const label = viewLabel(activeView);
  /* The centre belongs to the page on Apex, which fills the shell slot with
     its own status bus, and to the shell's default chips on every other
     view — never both. */
  const pageOwnsCentre = activeView === "dashboard";
  const profile = useAthleteDashboardStore((state) => state.profile);
  const recoveryCommand = useAthleteDashboardStore((state) => state.recoveryCommand);
  const trainingSessionMode = useAthleteDashboardStore((state) => state.trainingSession.sessionMode);
  const [time, setTime] = useState("");
  const [date, setDate] = useState("");

  useEffect(() => {
    function tick() {
      const now = new Date();
      setTime(
        now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })
      );
      setDate(
        now.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
      );
    }
    tick();
    const id = setInterval(tick, 10_000);
    return () => clearInterval(id);
  }, []);

  const recovery = useMemo(() => buildRecoverySnapshot(recoveryCommand), [recoveryCommand]);
  const outputLabel = trainingSessionMode === "live"
    ? "Live"
    : trainingSessionMode === "complete" || trainingSessionMode === "closed"
      ? "Closed"
      : "Staged";
  /* Readiness and sleep count to their new value after a member's log (ReserveLiveNumber). */
  const quickStats: Array<{ label: string; value: React.ReactNode; color: string; dot: string; title: string }> = [
    {
      label: "Readiness",
      value: recovery.hasData ? <ReserveLiveNumber value={recovery.reserve} /> : "—",
      color: recovery.hasData ? recovery.reserveColor : "rgba(255,255,255,0.45)",
      dot: recovery.hasData ? recovery.reserveColor : "#8ea0b8",
      title: recovery.hasData ? `Derived from logged recovery inputs · ${recovery.reserveLabel}` : "Evidence needed · complete a recovery check-in",
    },
    {
      label: "Output",
      value: outputLabel,
      color: trainingSessionMode === "live" ? "#d5b15f" : "#5fb7d5",
      dot: trainingSessionMode === "live" ? "#d5b15f" : "#5fb7d5",
      title: `Training session state · ${outputLabel}`,
    },
    {
      label: "Sleep",
      value: recovery.sleepLastNight === null ? "—" : (
        <>
          <ReserveLiveNumber value={recovery.sleepLastNight} decimals={1} />h
        </>
      ),
      color: recovery.sleepLastNight === null ? "rgba(255,255,255,0.45)" : "#6ee7b7",
      dot: recovery.sleepLastNight === null ? "#8ea0b8" : "#6ee7b7",
      title: recovery.sleepLastNight === null ? "Evidence needed · no sleep log" : "Most recent member-entered sleep log",
    },
  ];
  const systemLabel = trainingSessionMode === "live" ? "Session Live" : recovery.hasData ? recovery.reserveLabel : "Evidence Needed";

  return (
    /* Phones: sticky over the scrolling document, 48px plus the top safe
       area, on a solid ground. From md up it is the static 52px bar. Both
       rows are always in the DOM and switched by CSS, so a phone's first
       paint is already the phone bar. */
    <header
      className="sticky top-0 z-30 flex-shrink-0 border-b border-white/[0.06] bg-[#08090e] pt-[env(safe-area-inset-top,0px)] md:static md:z-auto md:pt-0"
      style={{ boxShadow: "inset 0 -1px 0 rgba(213,177,95,0.09)" }}
    >
      {/* ── Phone: brand + room, then the avatar. Nothing else. ── */}
      <div data-shell="topbar-phone" className="flex h-[47px] items-center gap-3 px-3 md:hidden">
        <div className="relative h-full min-w-0 flex-1">
          <div
            className="absolute inset-0 flex min-w-0 items-center gap-2.5 transition-opacity duration-200"
            style={{ opacity: condensed ? 0 : 1 }}
            aria-hidden={condensed || undefined}
          >
            <span
              className="flex-shrink-0 font-mono text-[9px] font-bold uppercase tracking-[0.32em]"
              style={{ color: RESERVE.gold }}
            >
              RESERVE
            </span>
            <span className="h-4 w-px flex-shrink-0" style={{ background: "rgba(213,177,95,0.18)" }} aria-hidden="true" />
            <span className="min-w-0 truncate whitespace-nowrap font-mono text-[9px] uppercase tracking-[0.18em] text-white/55">
              {label}
            </span>
          </div>
          {/* The compact room title, once the page's own h1 has scrolled away. */}
          <p
            className="absolute inset-0 flex min-w-0 items-center transition-opacity duration-200"
            style={{ opacity: condensed ? 1 : 0 }}
            aria-hidden={!condensed || undefined}
          >
            <span className="min-w-0 truncate whitespace-nowrap text-[14px] font-semibold tracking-[-0.005em]" style={{ color: RESERVE.ivory }}>
              {label}
            </span>
          </p>
        </div>
        <AvatarChip name={profile.name} goal={profile.goal} />
      </div>

      {/* ── md and up: unchanged desktop bar ── */}
      <div className="hidden h-[51px] items-center justify-between gap-4 px-4 md:flex">
        {/* Left: menu + breadcrumb */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={toggleSidebar}
            /* fba-target lifts the hit area to 44px without moving a pixel. */
            className="fba-target relative rounded-md p-1.5 text-white/30 transition-all duration-150 hover:bg-white/[0.05] hover:text-white/65"
            aria-label="Toggle sidebar"
            aria-expanded={!sidebarCollapsed}
          >
            <Menu size={15} />
          </button>

          {/* Brand lockup */}
          <div className="flex items-center gap-2.5">
            <div className="flex flex-col">
              <span
                className="font-mono text-[9px] font-bold uppercase tracking-[0.32em]"
                style={{ color: "#d5b15f", letterSpacing: "0.32em" }}
                title="THE RESERVE METHOD"
              >
                RESERVE
              </span>
            </div>
            <div className="h-4 w-px" style={{ background: "rgba(213,177,95,0.18)" }} />
            <span className="whitespace-nowrap font-mono text-[9px] uppercase tracking-[0.18em] text-white/55">
              {label}
            </span>
          </div>
        </div>

        {/* Center: the page's slot on Apex, the shell's live chips elsewhere.
            The slot always renders, because a page portal needs a host that
            exists at mount and never changes identity; where the chips own the
            centre it simply collapses. */}
        <div
          id={RESERVE_SHELL_SLOT_ID.topbar}
          className={pageOwnsCentre ? "hidden min-w-0 flex-1 items-center justify-center md:flex" : "hidden"}
        />

        {!pageOwnsCentre && (
          <div className="hidden items-center gap-2.5 md:flex">
            {quickStats.map(({ label: statLabel, value, color, dot, title }) => (
              <div
                key={statLabel}
                title={title}
                className="flex items-center gap-2 rounded-md border border-white/[0.07] bg-white/[0.025] px-2.5 py-1.5 transition-colors duration-150 hover:border-white/12 hover:bg-white/[0.04]"
              >
                <span
                  className="h-1.5 w-1.5 flex-shrink-0 rounded-full fba-breath"
                  style={{ background: dot, boxShadow: `0 0 4px ${dot}55` }}
                />
                <span className="font-mono text-[8px] uppercase tracking-[0.16em] text-white/30">
                  {statLabel}
                </span>
                <span className="font-mono text-[11px] font-semibold" style={{ color }}>
                  {value}
                </span>
              </div>
            ))}

            {/* System status */}
            <div className="flex items-center gap-1.5 rounded-md border border-emerald-400/12 bg-emerald-400/[0.04] px-2.5 py-1.5">
              <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-emerald-400 fba-pulse" />
              <span className="font-mono text-[8px] uppercase tracking-[0.18em] text-emerald-400/60">
                {systemLabel}
              </span>
            </div>
          </div>
        )}

        {/* Right: coach switch + clock + actions */}
        <div className="flex items-center gap-3">
          <CoachCommandSwitch />

          <div className="flex flex-col items-end">
            <span className="font-mono text-[11px] font-semibold tabular-nums text-[#ece8df]/85">
              {time}
            </span>
            <span className="font-mono text-[7.5px] uppercase tracking-[0.16em] text-white/35">
              {date}
            </span>
          </div>

          <div className="h-4 w-px bg-white/[0.08]" />

          {/* Cloud sync state — honest: "Saved" only after cloud confirmation. */}
          <SyncStatusChip />

          {/* WCAG 2.2.2: background motion that starts on its own needs a way to
              pause it. Shown only while something would move; the choice is
              remembered on this device. On phones it lives in More. */}
          {motionAvailable && (
            <button
              type="button"
              onClick={toggleMotion}
              aria-label={motionPaused ? "Play background motion" : "Pause background motion"}
              title={motionPaused ? "Play background motion" : "Pause background motion"}
              className="fba-target relative rounded-md p-1.5 text-white/55 transition-colors hover:text-white/85"
            >
              {motionPaused ? <Play size={13} aria-hidden="true" /> : <Pause size={13} aria-hidden="true" />}
            </button>
          )}

          <button
            type="button"
            disabled
            title="Alert center is not connected yet"
            className="fba-target relative block cursor-not-allowed rounded-md p-1.5 text-white/20"
            aria-label="Alerts"
          >
            <Bell size={13} />
          </button>

          <AvatarChip name={profile.name} goal={profile.goal} />
        </div>
      </div>
    </header>
  );
}
