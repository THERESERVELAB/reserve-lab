"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useSyncExternalStore } from "react";

import { useAthleteDashboardStore, usePreviewInitialView, type DashboardView } from "@/lib/athlete-store";
import { canAccessCoachCommand } from "@/lib/coaching/entitlements";
import { currentCoachingMember, resolveActorParam, useCoachingStore } from "@/lib/coaching/store";
import { useIsPhone } from "@/lib/hooks/useMediaQuery";
import { isTabView, resolvePhoneNavigation } from "@/lib/modules/phone-tabs";
import { getDateKey } from "@/lib/retention-config";
import { useSyncStatusStore } from "@/lib/sync/sync-status";
import { useShellStore } from "@/lib/ui/shell-store";
import { scrollShellToTop } from "@/lib/ui/shell-scroll";
import { AuthProvider, useAuth } from "./auth/AuthProvider";
import { CapabilitiesProvider } from "./authz/CapabilitiesProvider";
import { ReserveConfigRequired, ReserveEntry, ReserveRestoring } from "./auth/ReserveEntry";
import { BottomTicker } from "./BottomTicker";
import { LogMomentHost } from "./ui/reserve/log-moment/LogMomentHost";
import { UiSoundHost } from "./ui/reserve/log-moment/UiSoundHost";
import { MoreSheet } from "./nav/MoreSheet";
import { PhoneTabBar } from "./nav/PhoneTabBar";
import { useMemberNavGroups } from "./nav/useMemberNavGroups";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { AnimatedBackground } from "./ui/AnimatedBackground";
import { RESERVE_SHELL_SLOT_ID } from "./ui/reserve/ReserveShellPortal";
import { ReserveSignalAnnouncer, ReserveSignalTrace } from "./ui/reserve/ReserveSignal";
import { clearSystemsOnline } from "@/lib/ui/systems-online";

/* Coach Command is separate chrome for eligible accounts, and the wizard only
   opens for a member who has not finished onboarding. Neither belongs in the
   bundle a member downloads before their room becomes tappable. */
const CoachCommandShell = dynamic(() => import("./coaching/CoachCommandShell").then((m) => m.CoachCommandShell), { ssr: false, loading: () => <ReserveRestoring label="Opening Coach Command" /> });
const OnboardingWizard = dynamic(() => import("./onboarding/OnboardingWizard").then((m) => m.OnboardingWizard), { ssr: false, loading: () => null });

const subscribeToStaticRoute = () => () => undefined;
const readClientReady = () => true;
const readServerClientReady = () => false;
const readDemoActorRoute = () => {
  if (process.env.NODE_ENV !== "development" || typeof window === "undefined") return false;
  const actorParam = new URLSearchParams(window.location.search).get("actor");
  return Boolean(actorParam && resolveActorParam(actorParam));
};
const readServerDemoActorRoute = () => false;

/* The fixed bottom stack's height, published for the phone layout: <main>
   pads by it and scroll anchors stop above it, so nothing ever sits under the
   tab bar or a docked action. A ref callback rather than an effect, so it
   re-attaches when the shell remounts after Coach Command. */
const measureBottomStack = (el: HTMLDivElement | null) => {
  if (!el) return;
  const root = document.documentElement;
  const write = () => root.style.setProperty("--fba-shell-bottom-h", `${el.offsetHeight}px`);
  write();
  const observer = new ResizeObserver(write);
  observer.observe(el);
  return () => {
    observer.disconnect();
    root.style.removeProperty("--fba-shell-bottom-h");
  };
};

/* The member's own state lives in localStorage and is restored on the client.
   Until that has happened there is nothing truthful to draw: every number in
   every room would be a store default, not the member's. So the shell holds
   the same restoration screen the launch path already uses, and the room is
   drawn once — with the member's own values. */
const subscribeRehydrated = (onChange: () => void) => useAthleteDashboardStore.persist.onFinishHydration(onChange);
const readRehydrated = () => useAthleteDashboardStore.persist.hasHydrated();
const readServerRehydrated = () => false;

function RestoredMemberShell({ children }: { children: React.ReactNode }) {
  const restored = useSyncExternalStore(subscribeRehydrated, readRehydrated, readServerRehydrated);
  if (!restored) return <ReserveRestoring label="Restoring your Reserve profile" />;
  return <MemberShell>{children}</MemberShell>;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <CapabilitiesProvider>
        <AuthenticatedShell>{children}</AuthenticatedShell>
      </CapabilitiesProvider>
    </AuthProvider>
  );
}

/**
 * Launch gate. Order matters:
 *   unconfigured prod → config screen · unconfigured dev → local mode
 *   resolving/restoring → restoration screen · signed-out/error → Reserve entry
 *   signed-in → onboarding if incomplete, else the command center.
 */
function AuthenticatedShell({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const syncStatus = useSyncStatusStore((s) => s.status);

  if (status === "unconfigured") {
    if (process.env.NODE_ENV === "production") return <ReserveConfigRequired />;
    // Development without Supabase env: full app, device-local persistence.
    return <RestoredMemberShell>{children}</RestoredMemberShell>;
  }
  if (status === "resolving") return <ReserveRestoring label="Restoring your Reserve profile" />;
  if (status === "signing-out") return <ReserveRestoring label="Closing your session" />;
  if (status === "signed-out" || status === "error") return <ReserveEntry />;
  if (syncStatus === "restoring") return <ReserveRestoring label="Restoring your Reserve profile" />;

  return <RestoredMemberShell>{children}</RestoredMemberShell>;
}

function MemberShell({ children }: { children: React.ReactNode }) {
  /* Dev preview only: applies the pinned starting view after mount, so it
     cannot desynchronise the server and client renders. Inert in production. */
  usePreviewInitialView();

  const setSidebarCollapsed = useAthleteDashboardStore((s) => s.setSidebarCollapsed);
  const recordAppOpen = useAthleteDashboardStore((s) => s.recordAppOpen);
  const rolloverNutritionDay = useAthleteDashboardStore((s) => s.rolloverNutritionDay);
  const onboardingStatus = useAthleteDashboardStore((s) => s.onboarding.status);
  const needsOnboarding = onboardingStatus !== "complete";
  const activeView = useAthleteDashboardStore((s) => s.activeView);
  const setActiveView = useAthleteDashboardStore((s) => s.setActiveView);

  /* Phones navigate with the tab bar and the More sheet instead of the rail.
     The rail, the tab bar and the phone top bar are all switched by CSS
     breakpoints, so a phone's first paint is already the phone shell;
     `useIsPhone` (false on the server and during hydration) only gates the
     More sheet, which is closed on first paint anyway. */
  const isPhone = useIsPhone();
  /* `navOpen` is the phone navigation: since the tab bar, that is More. */
  const navOpen = useShellStore((s) => s.navOpen);
  const setNavOpen = useShellStore((s) => s.setNavOpen);
  /* Stable on purpose: ReserveBottomSheet re-runs its focus effect whenever
     `onClose` changes identity, which would pull focus back to the panel
     from wherever the member is in the list. */
  const closeNav = useCallback(() => setNavOpen(false), [setNavOpen]);
  const openNav = useCallback(() => setNavOpen(true), [setNavOpen]);

  const navGroups = useMemberNavGroups();
  const { tabs, moreGroups } = resolvePhoneNavigation(navGroups);
  const selectTab = useCallback(
    (view: DashboardView) => {
      /* Tapping the room you are in takes you to its top, as on the hardware. */
      if (view === useAthleteDashboardStore.getState().activeView) scrollShellToTop("smooth");
      else setActiveView(view);
    },
    [setActiveView],
  );
  const navigateFromMore = useCallback(
    (view: DashboardView) => {
      setActiveView(view);
      setNavOpen(false);
    },
    [setActiveView, setNavOpen],
  );

  /* Coaching OS: hydrate the coaching domain and honor the workspace mode.
     The coach workspace is separate chrome — the athlete state below stays
     mounted-ready and untouched while Coach Command is open. */
  const coachingBootstrap = useCoachingStore((s) => s.bootstrap);
  const workspace = useCoachingStore((s) => s.workspace);
  const coachingMember = useCoachingStore(currentCoachingMember);
  const clientReady = useSyncExternalStore(
    subscribeToStaticRoute,
    readClientReady,
    readServerClientReady,
  );
  const isDemoActorRoute = useSyncExternalStore(
    subscribeToStaticRoute,
    readDemoActorRoute,
    readServerDemoActorRoute,
  );
  // The wizard restores its draft once, at mount, from whatever the store holds.
  // AuthenticatedShell already withholds this entire shell while syncStatus is
  // "restoring", so by the time the wizard mounts the store holds the member's
  // real cloud progress rather than a stale local draft or an empty Step 1.
  const showOnboarding = clientReady && needsOnboarding && !(
    process.env.NODE_ENV === "development" && (coachingMember?.isDemo || isDemoActorRoute)
  );

  useEffect(() => {
    coachingBootstrap();
    // Development fixture switching: ?actor=anthony|jasmine|luis|noah|marcus
    if (process.env.NODE_ENV === "development") {
      const actorParam = new URLSearchParams(window.location.search).get("actor");
      const resolved = actorParam ? resolveActorParam(actorParam) : null;
      if (resolved && resolved !== useCoachingStore.getState().actorId) {
        useCoachingStore.getState().setActor(resolved);
      }
    }
  }, [coachingBootstrap]);

  /* Below 1024px the rail starts as 52px icons (labels on hover and in each
     item's accessible name). An expanded 212px rail squeezed the Pit Wall on
     tablets. Phones never show the rail. */
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const sync = () => setSidebarCollapsed(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, [setSidebarCollapsed]);

  /* More only exists below md. If the viewport widens while it is open — a
     phone turned to landscape — close it, so it cannot reappear unbidden when
     the viewport narrows again. */
  useEffect(() => {
    if (!isPhone) setNavOpen(false);
  }, [isPhone, setNavOpen]);

  /* Systems online belongs to the first Apex open only: on any other room the
     mark is cleared, so a later navigation to Apex never plays it. */
  useEffect(() => {
    if (activeView !== "dashboard") clearSystemsOnline();
  }, [activeView]);

  useEffect(() => {
    recordAppOpen();
    // Reset the daily nutrition log when the calendar day has changed so yesterday's
    // logged meals never carry over and mark today's meals as logged.
    rolloverNutritionDay(getDateKey());
  }, [recordAppOpen, rolloverNutritionDay]);

  // COACH COMMAND — separate premium workspace for eligible accounts.
  if (workspace === "coach" && canAccessCoachCommand(coachingMember)) {
    return <CoachCommandShell />;
  }

  return (
    /* Phones: the document scrolls (min-h-dvh, no inner scroll box), so the
       URL bar can collapse and a swipe is never trapped. From md up the shell
       keeps its fixed frame and <main> scrolls inside it. */
    <div className="safe-x relative flex min-h-dvh flex-col md:h-dvh md:overflow-hidden">
      <AnimatedBackground />
      {/* Signal received (md+): a member's log runs a light along the top of
          the screen. Phones carry it on the tab bar's top edge instead — and
          since the shell renders only once the member's state is restored,
          `isPhone` is already true here, so a phone never builds the desktop
          chrome it would only hide with CSS. */}
      {!isPhone && <ReserveSignalTrace placement="viewport" className="max-md:hidden" />}
      <ReserveSignalAnnouncer />
      {showOnboarding && <OnboardingWizard />}

      {/* Content. On phones the sticky top bar carries the top safe area
          itself, so its ground runs under the status bar. */}
      <div className="relative z-10 flex min-h-0 flex-1 md:pt-[env(safe-area-inset-top,0px)]">
        {!isPhone && <Sidebar />}
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar />
          <main className="fba-shell-main flex-1 overflow-x-clip md:overflow-y-auto md:overflow-x-hidden">
            {children}
          </main>
        </div>
      </div>

      {/* The bottom of the screen: a page's docked action (the dock slot
          always renders, empty by default), then the ticker (md+) or the tab
          bar (phones). In flow from md up; fixed to the screen on phones,
          where it hides while a sheet or drawer is open (globals.css). */}
      {/* The one log moment: every member log lands here, so moments never stack. */}
      <LogMomentHost />
      <UiSoundHost />

      <div ref={measureBottomStack} className="fba-shell-bottom" data-shell="bottom-stack">
        <div id={RESERVE_SHELL_SLOT_ID.dock} />
        {/* Apex carries the ticker's log-only lines in its own footer, and a
            phone has no room for a scrolling strip. */}
        {!isPhone && activeView !== "dashboard" && (
          <div className="hidden md:block">
            <BottomTicker />
          </div>
        )}
        <PhoneTabBar
          tabs={tabs}
          activeView={activeView}
          moreOpen={isPhone && navOpen}
          moreHoldsActive={!isTabView(tabs, activeView)}
          onSelect={selectTab}
          onOpenMore={openNav}
        />
      </div>

      <MoreSheet
        open={isPhone && navOpen}
        onClose={closeNav}
        groups={moreGroups}
        activeView={activeView}
        onNavigate={navigateFromMore}
      />
    </div>
  );
}
