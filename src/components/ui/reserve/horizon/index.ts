/* ════════════════════════════════════════════════════════════════════════
   THE SHARED HORIZON — one component for the day on one clock.

   Apex's mission timeline, and the Training, Nutrition, Recovery and Schedule
   horizons all draw from here. `ReserveHorizon` is the room section; the
   pieces below it are exported for surfaces that compose their own header or
   geometry (the Pit Wall's timeline and phone spine, Training's session
   blocks). Geometry lives in `@/lib/apex/horizon-projection`.
   ════════════════════════════════════════════════════════════════════════ */

export { ReserveHorizon } from "./ReserveHorizon";
export type { ReserveHorizonView } from "./ReserveHorizon";

export { HorizonTrack, HorizonTicks, HorizonNowPill } from "./HorizonTrack";
export type { HorizonLane } from "./HorizonTrack";

export { HorizonFloor } from "./HorizonFloor";

export { HorizonSpine, roomSpineFooter } from "./HorizonSpine";
export type { SpineFooterState } from "./HorizonSpine";

export { HorizonItemSheet } from "./HorizonItemSheet";
export type { HorizonSheetAction } from "./HorizonItemSheet";

export { APEX_HORIZON_LOOK, roomHorizonLook } from "./horizon-look";
export type { HorizonLook } from "./horizon-look";

export {
  HORIZON_LABEL_COL_PX,
  HORIZON_SPINE_ROWS,
  chipFace,
  describeHorizonItems,
  horizonTrackHeightPx,
  isLiveStatus,
  isSettledStatus,
  labelFits,
  spineWindow,
} from "./horizon-model";
export type { ChipFace, HorizonItem, SpineWindow } from "./horizon-model";

export { useTrackWidth } from "./useTrackWidth";
