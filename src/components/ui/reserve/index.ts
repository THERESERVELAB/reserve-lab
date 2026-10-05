/* ════════════════════════════════════════════════════════════════════════
   THE RESERVE GOLDEN COMPONENT SET.

   One import path for every screen. If a surface needs something that is not
   exported here, the correct move is to EXTEND one of these — not to
   hand-roll a local variant. A bespoke <div onClick> beside the project's
   real button is a defect, not a shortcut (components.md).

   The surface primitive itself stays where it has always lived:
   `@/components/ui/GlassPanel`. It is not re-exported, because there is
   exactly one surface and it does not need a second name.
   ════════════════════════════════════════════════════════════════════════ */

export {
  ReservePage,
  ReserveCommandHeader,
  ReserveSectionHeader,
  ReserveSection,
  ReserveDisclosure,
  ReserveActionBar,
  ReserveContentRail,
} from "./ReserveLayout";

export { ReserveButton, ReserveIconButton } from "./ReserveButton";
export type { ReserveButtonProps, ReserveButtonTier } from "./ReserveButton";

export { ReserveSelect } from "./ReserveSelect";
export type { ReserveSelectOption } from "./ReserveSelect";

export { ReserveSegmented } from "./ReserveSegmented";
export type { ReserveSegment } from "./ReserveSegmented";

export {
  ReserveMetric,
  ReserveTrend,
  ReserveStatusChip,
  ReserveConfidence,
} from "./ReserveData";
export type {
  Provenance,
  ReserveStatus,
  ReserveTrendDirection,
  ReserveMetricProps,
} from "./ReserveData";

export {
  ReserveNotice,
  ReserveLoading,
  ReserveSaveStatus,
  ReserveBottomSheet,
  ReserveSheetClose,
  useReserveSheetClose,
} from "./ReserveSurfaces";
export type { NoticeTone } from "./ReserveSurfaces";

export { DiscardChangesBar, useDirtySnapshot, useFormCloseGuard, useReportDirty } from "./FormCloseGuard";
export type { FormCloseGuard } from "./FormCloseGuard";

export { ReserveLiveNumber } from "./ReserveLiveNumber";

export { ReserveSignalAnnouncer, ReserveSignalGlow, ReserveSignalTrace } from "./ReserveSignal";

export { ReserveDetailImage, DETAIL_BAND_BLEED, DETAIL_BAND_BLEED_GLASS } from "./ReserveDetailImage";
export type { DetailBandWidth } from "./ReserveDetailImage";

export { ReserveShellPortal, RESERVE_SHELL_SLOT_ID } from "./ReserveShellPortal";
export type { ReserveShellSlot } from "./ReserveShellPortal";
