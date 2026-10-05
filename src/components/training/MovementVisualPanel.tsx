"use client";

/* ════════════════════════════════════════════════════════════════════════
   RESERVE MOVEMENT VISUAL PANEL v2 — image + slow-motion loop, gender-aware.
   ------------------------------------------------------------------------
   Premium dark-glass media surface. Selects a gender-aware variant, then
   renders, by mode:
     • Slow Demo → silent autolooping <video> (WebM + MP4, video-first)
     • Still     → art-directed <picture> (mobile 9:16 · tablet 4:5 · desktop 16:9)
     • Anatomy   → hands back to the anatomy HUD (premium pending state here)
   Default = Slow Demo when a loop is ready, else Still, else Anatomy. Reserve
   branding is drawn by THIS frame (never relied on inside AI media). Any media
   load failure degrades gracefully (loop → still → pending). No runtime AI.
   ════════════════════════════════════════════════════════════════════════ */

import { useState } from "react";
import { Scan, ImageIcon, Waves, Dumbbell, Play, Image as ImageIc, Activity } from "lucide-react";
import {
  selectMediaVariant,
  type MovementVisual,
  type MovementMediaGender,
} from "@/lib/training/movement-visuals";

const GOLD = "#d5b15f";
const STEEL = "#5fb7d5";
const VIOLET = "#a78bfa";

const ASPECT_RATIO: Record<MovementVisual["aspect"], string> = { "16:9": "16 / 9", "4:5": "4 / 5", "1:1": "1 / 1", "9:16": "9 / 16" };
const STYLE_LABEL: Record<MovementVisual["visualStyle"], string> = { "cinematic-4k": "Cinematic 4K", "studio-demo": "Studio Demo", "anatomy-hud": "Anatomy HUD" };

type MediaMode = "slow" | "still" | "anatomy";

/* ─── Reserve branding overlay — drawn by the app, never baked into AI media ── */
function ReserveWatermark({ visual }: { visual: MovementVisual }) {
  const b = visual.reserveBranding;
  if (!b?.watermark || !b.showInMediaFrame) return null;
  const pos =
    b.position === "top-left" ? "left-2.5 top-2.5"
    : b.position === "bottom-right" ? "right-2.5 bottom-2.5"
    : "left-2.5 bottom-2.5";
  return (
    <div className={`pointer-events-none absolute ${pos} z-10 flex items-center gap-1 rounded-md border border-white/[0.14] bg-black/45 px-1.5 py-0.5 backdrop-blur-sm`}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: `linear-gradient(135deg, ${GOLD}, ${STEEL})` }} />
      <span className="font-mono text-[7px] uppercase tracking-[0.22em] text-white/75">{b.label}</span>
    </div>
  );
}

/* ─── Media surface (loop / still / pending / support) ────────────────────── */
export function MovementVisualMedia({
  visual,
  gender = "neutral",
  accent = GOLD,
  compact = false,
  allowOpposite = false,
}: {
  visual: MovementVisual;
  gender?: MovementMediaGender;
  accent?: string;
  compact?: boolean;
  allowOpposite?: boolean;
}) {
  const sel = selectMediaVariant(visual, gender, { allowOpposite });
  const variant = sel.variant;
  const loopReady = Boolean(variant?.ready && variant.loop && (variant.loop.mp4 || variant.loop.webm));
  const imageReady = Boolean(variant?.ready && variant.image && (variant.image.desktop || variant.image.mobile));

  const [mode, setMode] = useState<MediaMode>(loopReady ? "slow" : imageReady ? "still" : "anatomy");
  const [videoFailed, setVideoFailed] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const aspect = ASPECT_RATIO[visual.aspect] ?? "16 / 9";

  // Support / recovery blocks never show an athlete demo.
  if (visual.kind !== "exercise") {
    return (
      <div className="relative grid w-full place-items-center overflow-hidden rounded-xl text-center" style={{ aspectRatio: compact ? "16 / 7" : "16 / 9", borderColor: `${VIOLET}33`, background: `linear-gradient(150deg, ${VIOLET}14, rgba(8,9,13,0.96) 70%)` }}>
        <ReserveWatermark visual={visual} />
        <div className="px-4">
          <Waves size={compact ? 18 : 22} style={{ color: VIOLET }} className="mx-auto" />
          <p className="mt-1.5 font-mono text-[8px] uppercase tracking-[0.24em]" style={{ color: `${VIOLET}cc` }}>Recovery · Support Block</p>
          <p className="mt-1 text-[12px] font-semibold text-[#f2eee6]">{visual.movementName}</p>
          {!compact && <p className="mx-auto mt-1 max-w-[18rem] text-[10.5px] leading-[1.5] text-white/45">A support block — easy conditioning, abs, or sauna if tolerated. Not a lift, so no demonstration media.</p>}
        </div>
      </div>
    );
  }

  const showLoop = mode === "slow" && loopReady && !videoFailed;
  const showStill = !showLoop && mode !== "anatomy" && imageReady && !imgFailed;

  // Available mode chips: Slow (if loop) · Still (if image) · Anatomy (always).
  const chips: { key: MediaMode; label: string; icon: typeof Play }[] = [];
  if (loopReady) chips.push({ key: "slow", label: "Slow Demo", icon: Play });
  if (imageReady) chips.push({ key: "still", label: "Still", icon: ImageIc });
  chips.push({ key: "anatomy", label: "Anatomy", icon: Activity });

  return (
    <div className="relative w-full overflow-hidden rounded-xl" style={{ aspectRatio: aspect, borderColor: `${accent}28`, background: "linear-gradient(160deg, rgba(12,14,20,0.96), rgba(6,7,11,0.99))" }}>
      <ReserveWatermark visual={visual} />

      {showLoop && variant?.loop ? (
        <video
          key={variant.loop.webm ?? variant.loop.mp4}
          className="absolute inset-0 h-full w-full object-cover"
          autoPlay loop muted playsInline preload="metadata"
          poster={variant.loop.poster}
          aria-label={variant.loop.alt}
          onError={() => setVideoFailed(true)}
        >
          {variant.loop.webm && <source src={variant.loop.webm} type="video/webm" />}
          {variant.loop.mp4 && <source src={variant.loop.mp4} type="video/mp4" />}
        </video>
      ) : showStill && variant?.image ? (
        <picture>
          {variant.image.mobile && <source media="(max-width: 640px)" srcSet={variant.image.mobile} />}
          {variant.image.tablet && <source media="(max-width: 1024px)" srcSet={variant.image.tablet} />}
          {/* Art-directed responsive crops require <picture>/<img>; assets are local & pre-stored. */}
          <img src={variant.image.desktop ?? variant.image.mobile} alt={variant.image.alt} loading="lazy" decoding="async" onError={() => setImgFailed(true)} className="absolute inset-0 h-full w-full object-cover" />
        </picture>
      ) : (
        /* Premium "Visual Pending" — no request fires; anatomy HUD remains the fallback below. */
        <div className="absolute inset-0 grid place-items-center">
          <div className="pointer-events-none absolute inset-0 opacity-[0.5]" style={{ backgroundImage: `linear-gradient(${accent}0c 1px, transparent 1px), linear-gradient(90deg, ${accent}0c 1px, transparent 1px)`, backgroundSize: "22px 22px" }} />
          <div className="pointer-events-none absolute inset-0" style={{ background: `radial-gradient(circle at 50% 35%, ${accent}14, transparent 60%)` }} />
          <div className="relative text-center">
            <div className="mx-auto grid h-9 w-9 place-items-center rounded-full border" style={{ borderColor: `${accent}40`, background: `${accent}12` }}>
              <ImageIcon size={15} style={{ color: accent }} />
            </div>
            <p className="mt-2 font-mono text-[8px] uppercase tracking-[0.26em]" style={{ color: `${accent}cc` }}>{mode === "anatomy" ? "Anatomy View · HUD Below" : "Visual Pending"}</p>
            <p className="mt-0.5 text-[11px] font-semibold text-[#f2eee6]">{STYLE_LABEL[visual.visualStyle]} demonstration loading</p>
          </div>
        </div>
      )}

      {/* cinematic grade when media is showing */}
      {(showLoop || showStill) && (
        <>
          <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse at 50% 0%, transparent 55%, rgba(6,7,11,0.55) 100%)" }} />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3" style={{ background: "linear-gradient(to top, rgba(6,7,11,0.8), transparent)" }} />
        </>
      )}

      {/* corner ticks */}
      <div className="pointer-events-none absolute left-2 top-2 h-2.5 w-2.5 border-l border-t" style={{ borderColor: `${accent}55` }} />
      <div className="pointer-events-none absolute right-2 top-2 h-2.5 w-2.5 border-r border-t" style={{ borderColor: `${STEEL}55` }} />
      <div className="pointer-events-none absolute bottom-2 left-2 h-2.5 w-2.5 border-b border-l" style={{ borderColor: `${STEEL}55` }} />
      <div className="pointer-events-none absolute bottom-2 right-2 h-2.5 w-2.5 border-b border-r" style={{ borderColor: `${accent}55` }} />

      {/* mode label + subtle gender-demo hint */}
      <div className="absolute right-2 top-2 z-10 flex items-center gap-1">
        {(showLoop || showStill) && sel.resolvedGender && sel.resolvedGender !== "neutral" && (
          <span className="rounded-md border border-white/[0.12] bg-black/40 px-1.5 py-0.5 font-mono text-[7px] uppercase tracking-[0.16em] text-white/55">{sel.resolvedGender === "female" ? "Female Demo" : "Male Demo"}</span>
        )}
      </div>

      {/* mode chips — only meaningful modes are offered */}
      {chips.length > 1 && (
        <div className="absolute inset-x-0 bottom-2 z-10 flex justify-center gap-1.5">
          {chips.map((c) => {
            const active = mode === c.key;
            const Icon = c.icon;
            return (
              <button key={c.key} type="button" onClick={() => setMode(c.key)} aria-pressed={active}
                className="flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[7.5px] uppercase tracking-[0.16em] transition"
                style={active ? { borderColor: `${accent}88`, background: `${accent}1f`, color: "#f2eee6" } : { borderColor: "rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.4)", color: "rgba(255,255,255,0.5)" }}>
                <Icon size={8} />{c.label}
              </button>
            );
          })}
        </div>
      )}

      <div className="absolute left-2.5 top-2.5 z-10 flex items-center gap-1.5">
        <Scan size={10} style={{ color: `${accent}c0` }} />
        <span className="font-mono text-[7px] uppercase tracking-[0.22em]" style={{ color: `${accent}cc` }}>{showLoop ? "Movement Loop" : showStill ? STYLE_LABEL[visual.visualStyle] : "Movement Visual"}</span>
      </div>
    </div>
  );
}

/* ─── Coaching field ──────────────────────────────────────────────────────── */
function Field({ label, value, accent = GOLD }: { label: string; value: string; accent?: string }) {
  if (!value) return null;
  return (
    <div className="rounded-lg bg-white/[0.02] px-2.5 py-1.5">
      <p className="font-mono text-[7px] uppercase tracking-[0.2em]" style={{ color: `${accent}b0` }}>{label}</p>
      <p className="mt-0.5 text-[10.5px] leading-[1.4] text-white/70">{value}</p>
    </div>
  );
}

export type MovementVisualPanelData = {
  visual: MovementVisual;
  gender?: MovementMediaGender;
  primaryMuscles?: string[];
  secondaryMuscles?: string[];
  stabilizers?: string[];
  equipment?: string;
  roleLabel?: string;
  tempo?: string;
  repCue?: string;
  commonError?: string;
  goalImpact?: string;
};

/**
 * Full responsive panel — media + coaching grid.
 *   mobile: media full width, details below · tablet: media top + stat grid
 *   desktop / ultra-wide: media left, coaching data right
 */
export function MovementVisualPanel({ data, accent = GOLD }: { data: MovementVisualPanelData; accent?: string }) {
  const { visual } = data;
  return (
    <div className="relative overflow-hidden rounded-2xl" style={{ borderColor: `${accent}26`, background: "linear-gradient(168deg, rgba(10,12,18,0.94), rgba(6,7,11,0.99))", boxShadow: `0 12px 36px rgba(0,0,0,0.42), 0 0 30px ${accent}0e` }}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${accent}80, transparent)` }} />
      <div className="grid gap-3 p-3 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <MovementVisualMedia visual={visual} gender={data.gender} accent={accent} />
          {visual.kind === "exercise" && (data.roleLabel || data.equipment) && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {data.roleLabel && <span className="rounded-full border px-2 py-0.5 font-mono text-[7.5px] uppercase tracking-[0.16em]" style={{ borderColor: `${accent}55`, background: `${accent}14`, color: accent }}>{data.roleLabel}</span>}
              {data.equipment && <span className="rounded-full border border-white/[0.1] bg-white/[0.03] px-2 py-0.5 font-mono text-[7.5px] uppercase tracking-[0.16em] text-white/55"><Dumbbell size={8} className="mr-1 inline" />{data.equipment}</span>}
            </div>
          )}
        </div>
        <div className="min-w-0">
          <div className="grid grid-cols-2 gap-1.5">
            <Field label="Primary" value={(data.primaryMuscles ?? visual.primaryMuscles).join(" · ")} accent={GOLD} />
            <Field label="Secondary" value={(data.secondaryMuscles ?? []).join(" · ")} accent={STEEL} />
            <Field label="Stabilizers" value={(data.stabilizers ?? []).join(" · ")} accent={VIOLET} />
            <Field label="Phase Role" value={data.roleLabel ?? ""} accent={GOLD} />
            <Field label="Tempo" value={data.tempo ?? ""} accent={STEEL} />
            <Field label="Rep Cue" value={data.repCue ?? ""} accent={GOLD} />
          </div>
          {(data.commonError || data.goalImpact) && (
            <div className="mt-1.5 grid gap-1.5">
              <Field label="Common Compensation" value={data.commonError ?? ""} accent={"#e0894a"} />
              <Field label="Goal Impact" value={data.goalImpact ?? ""} accent={"#6fcf73"} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
