"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect } from "react";

import { useAthleteDashboardStore } from "@/lib/athlete-store";
import { isWhoopReturn } from "@/lib/devices/whoop-return";
import { useIsPhone } from "@/lib/hooks/useMediaQuery";
import { scrollShellToTop } from "@/lib/ui/shell-scroll";
import { isFeatureEnabled, VIEW_FEATURE_MAP } from "@/lib/saas-config";
import { LockedPremiumModule } from "./LockedPremiumModule";
/* Every room is its own chunk - see ./view-chunks. */
import { PERSONA_CHUNKS, ROOM_CHUNKS, prefetchTabRooms, preloadRoom, type RoomChunkKey } from "./view-chunks";

/* The member's room is known as soon as the persisted store rehydrates, which
   happens while the rest of the first-load bundle is still executing. Starting
   its chunk here overlaps that download with hydration instead of queueing it
   behind the first commit. */
if (typeof window !== "undefined") {
  const kick = () => {
    const s = useAthleteDashboardStore.getState();
    preloadRoom(s.activeView, s.profile.persona);
  };
  if (useAthleteDashboardStore.persist.hasHydrated()) kick();
  else useAthleteDashboardStore.persist.onFinishHydration(kick);
}

/* ─── Persona dashboard with morph transition ───── */
function PersonaDashboard() {
  const persona          = useAthleteDashboardStore((s) => s.profile.persona);
  const shouldReduceMotion = useReducedMotion();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={persona}
        /* No exit, on purpose — see ViewTransition below: with mode="wait" a
           stalled exit means the incoming dashboard never mounts at all. */
        initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.985, filter: "blur(6px)" }}
        animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        {persona === "beginner" ? (
          <PERSONA_CHUNKS.beginner />
        ) : persona === "intermediate" ? (
          <PERSONA_CHUNKS.intermediate />
        ) : (
          <PERSONA_CHUNKS.advanced />
        )}
      </motion.div>
    </AnimatePresence>
  );
}

/* ─── View transition wrapper ─────────────────────
   Phones: the outgoing room is released at once, the page lands at its top
   while nothing is on screen, and the new room fades in over 240ms — opacity
   only, so nothing moves. The background plate keeps its own ≥1s cross-fade.
   The old 90ms step-out is gone: it could stall and strand the member between
   rooms, and `onExitComplete` still fires to land the page at its top.
   md and up keep the original rise. One AnimatePresence either way, so the
   hydration-time switch to the phone variant never remounts the room. */
const landAtTop = () => scrollShellToTop("instant");

function ViewTransition({ children, viewKey }: { children: React.ReactNode; viewKey: string }) {
  const shouldReduceMotion = useReducedMotion();
  const isPhone = useIsPhone();
  return (
    <AnimatePresence mode="wait" onExitComplete={isPhone ? landAtTop : undefined}>
      <motion.div
        key={viewKey}
        /* The room does NOT animate out, and that is the whole point.
           `mode="wait"` holds the incoming room until the outgoing one has
           finished leaving, and framer stalls mid-exit on a starved device —
           measured at 10x throttle, one animated value reached its target
           while another never moved. Everywhere else that cost a lingering
           overlay. HERE it would cost the member the room: they tap a
           destination and arrive nowhere, with no way to tell why.
           A room that steps out gracefully is worth less than a room that
           always arrives. It still fades IN, so the change is one direction
           of a transition, not the transition. */
        initial={shouldReduceMotion ? false : isPhone ? { opacity: 0 } : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: isPhone ? 0.24 : 0.25, ease: [0.22, 1, 0.36, 1] }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

/* A room resolved from the chunk registry. Split out so the lookup happens in
   a component, keeping the transition wrapper's children a stable element. */
function RoomChunk({ view }: { view: RoomChunkKey }) {
  const Room = ROOM_CHUNKS[view];
  return <Room />;
}

export function ViewRouter() {
  const { activeView, recordModuleView, subscriptionTier } = useAthleteDashboardStore();
  const feature = VIEW_FEATURE_MAP[activeView];

  useEffect(() => {
    recordModuleView(activeView);
  }, [activeView, recordModuleView]);

  /* The member's own room is on screen; the rooms one tap away can come in
     on idle time so the tab bar never waits on a download. */
  useEffect(() => prefetchTabRooms(), []);

  /* A member coming back from WHOOP's consent screen lands on whatever room
     they left open, which is not where the result of that decision is shown.
     The connection lives in Settings, so the return opens Settings. */
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isWhoopReturn(window.location.search)) return;
    useAthleteDashboardStore.getState().setActiveView("settings");
  }, []);

  if (!isFeatureEnabled(subscriptionTier, feature)) {
    return (
      <ViewTransition viewKey={`locked-${activeView}`}>
        <LockedPremiumModule feature={feature} />
      </ViewTransition>
    );
  }

  return (
    <ViewTransition viewKey={activeView}>
      {activeView in ROOM_CHUNKS ? (
        <RoomChunk view={activeView as RoomChunkKey} />
      ) : (
        <PersonaDashboard />
      )}
    </ViewTransition>
  );
}
