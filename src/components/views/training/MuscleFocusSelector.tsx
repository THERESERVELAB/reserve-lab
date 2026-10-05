"use client";

import { Check, Crosshair, RotateCcw, Sparkles, Target } from "lucide-react";
import { useMemo, useState } from "react";

import { GlassPanel } from "@/components/ui/GlassPanel";
import { useAthleteDashboardStore } from "@/lib/athlete-store";
import { resolveFocusArchitecture, WOMENS_TRACKS } from "@/lib/protocol/architecture";
import {
  MUSCLE_PRIORITIES,
  musclePriorityLabel,
  type MusclePriority,
  type WomensTrack,
} from "@/lib/physique/types";
import {
  ACTIVITY_STACKS,
  SPORT_OPTIONS,
  activityStackLanguage,
} from "@/lib/training/activity-stack";
import {
  getPriorityOptionSet,
  findActivePriorityOption,
  priorityOptionMatches,
  type PriorityOption,
} from "@/lib/training/priority-options";

/* ════════════════════════════════════════════════════════════════════════
   MUSCLE FOCUS SELECTOR — Member Muscle Priority + Focus Engine.
   The member chooses Primary / Secondary / Support priorities; Reserve builds
   the architecture around that individual. Member-specific, never assumed from
   gender, never global. Premium command chips — no checkbox wall, no pink, no
   stereotypes. Instruction / organization only.
   ════════════════════════════════════════════════════════════════════════ */

const GOLD = "#d5b15f";
const GOLD_BRIGHT = "#e8c87a";
const VIOLET = "#a78bfa";
const STEEL = "#5fb7d5";

type Role = "primary" | "secondary" | "support";

/* Women's Performance physique tracks — strong, premium, multiple options
   (never one generic plan). Shape-frequency architecture, not a bro split. */
const WOMENS_TRACK_ORDER: WomensTrack[] = ["runway", "glute-quad", "lean-recomp", "glute-upper", "athletic-model", "lifestyle-shape", "signature-shape", "hybrid-pilates", "sport-strength"];

/* Outcome-driven goal identities now come from the profile-aware resolver in
   priority-options.ts (male / female / neutral sets). The member chooses an
   outcome; the muscle priorities + premium preview copy are set underneath —
   profile-selected, never gender-stereotyped, always editable. */

function Chip({
  label,
  active,
  tone,
  onClick,
  title,
}: {
  label: string;
  active: boolean;
  tone: string;
  onClick: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={title}
      className="rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-all duration-200"
      style={
        active
          ? { borderColor: `${tone}88`, background: `${tone}1f`, color: "#f2eee6", boxShadow: `0 0 18px ${tone}33` }
          : { borderColor: "rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.02)", color: "rgba(255,255,255,0.55)" }
      }
    >
      {label}
    </button>
  );
}

export function MuscleFocusSelector() {
  const focus = useAthleteDashboardStore((s) => s.physiqueCommand.focus);
  const womensEnabled = useAthleteDashboardStore((s) => s.womens.enabled);
  const setPhysiqueFocus = useAthleteDashboardStore((s) => s.setPhysiqueFocus);
  const clearPhysiqueFocus = useAthleteDashboardStore((s) => s.clearPhysiqueFocus);
  const activityStack = useAthleteDashboardStore((s) => s.activityStack);
  const activitySport = useAthleteDashboardStore((s) => s.activitySport);
  const setActivityStack = useAthleteDashboardStore((s) => s.setActivityStack);
  /* Profile signals → which priority option set the member sees. */
  const genderIdentity = useAthleteDashboardStore((s) => s.profile.coachingProfile?.genderIdentity);
  const profilePath = useAthleteDashboardStore((s) => s.modulePreferences.profilePath);
  const protocolCategory = useAthleteDashboardStore((s) => s.activeProtocol?.category ?? null);
  /* The active women's protocol surfaces its track in physiqueCommand.focus.track. */
  const protocolWomensTrack = focus?.track ?? null;

  const { options: priorityOptions } = useMemo(
    () => getPriorityOptionSet({ genderIdentity, womensEnabled, profilePath, protocolCategory, womensTrack: protocolWomensTrack }),
    [genderIdentity, womensEnabled, profilePath, protocolCategory, protocolWomensTrack],
  );

  /* Local draft — preview the architecture before applying. */
  const [primary, setPrimary] = useState<MusclePriority | null>(focus?.primary ?? null);
  const [secondary, setSecondary] = useState<MusclePriority[]>(focus?.secondary ?? []);
  const [support, setSupport] = useState<MusclePriority[]>(focus?.support ?? []);
  const [track, setTrack] = useState<WomensTrack | null>(focus?.track ?? null);

  const preview = useMemo(
    () => resolveFocusArchitecture({ primary, secondary, support, track, updatedAt: null }, { womensActive: womensEnabled }),
    [primary, secondary, support, track, womensEnabled],
  );

  const dirty =
    primary !== (focus?.primary ?? null) ||
    secondary.join() !== (focus?.secondary ?? []).join() ||
    support.join() !== (focus?.support ?? []).join() ||
    track !== (focus?.track ?? null);

  /* The active priority option (if the current draft matches one) drives the
     premium preview copy; otherwise the preview falls back to the resolver. */
  const activeOption = useMemo(
    () => findActivePriorityOption(priorityOptions, { primary, secondary, support, track }),
    [priorityOptions, primary, secondary, support, track],
  );

  /* A goal identity sets a women's track OR the muscle priorities underneath. */
  function applyGoalPreset(p: PriorityOption) {
    if (priorityOptionMatches(p, { primary, secondary, support, track })) {
      setPrimary(null);
      setSecondary([]);
      setSupport([]);
      setTrack(null);
      return;
    }
    if (p.track) {
      setTrack(p.track);
      setPrimary(null);
      setSecondary([]);
      setSupport([]);
      return;
    }
    setTrack(null);
    setPrimary(p.primary ?? null);
    setSecondary(p.secondary ?? []);
    setSupport(p.support ?? []);
  }

  /* Selecting a women's track takes precedence; it clears the muscle focus. */
  function pickTrack(t: WomensTrack) {
    setTrack((cur) => (cur === t ? null : t));
    setPrimary(null);
    setSecondary([]);
    setSupport([]);
  }

  /* Cross-exclusion keeps a muscle in one role at a time; any muscle pick clears a track. */
  function pickPrimary(m: MusclePriority) {
    setTrack(null);
    setPrimary((cur) => (cur === m ? null : m));
    setSecondary((s) => s.filter((x) => x !== m));
    setSupport((s) => s.filter((x) => x !== m));
  }
  function toggle(role: Role, m: MusclePriority) {
    setTrack(null);
    if (role === "primary") return pickPrimary(m);
    if (m === primary) setPrimary(null);
    if (role === "secondary") {
      setSupport((s) => s.filter((x) => x !== m));
      setSecondary((s) => (s.includes(m) ? s.filter((x) => x !== m) : [...s, m].slice(-3)));
    } else {
      setSecondary((s) => s.filter((x) => x !== m));
      setSupport((s) => (s.includes(m) ? s.filter((x) => x !== m) : [...s, m].slice(-4)));
    }
  }

  function apply() {
    setPhysiqueFocus({ primary, secondary, support, track });
  }
  function reset() {
    clearPhysiqueFocus();
    setPrimary(null);
    setSecondary([]);
    setSupport([]);
    setTrack(null);
  }

  return (
    <GlassPanel accent={GOLD} noPad className="overflow-hidden">
      <div className="relative p-5 sm:p-6">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full blur-3xl" style={{ background: `${GOLD}12` }} />
        <div className="relative">
          <div className="flex flex-wrap items-center gap-2">
            <Crosshair size={14} style={{ color: GOLD }} />
            <p className="font-mono text-[9px] uppercase tracking-[0.26em]" style={{ color: GOLD }}>Muscle Priority · Focus Engine</p>
          </div>
          <h2 className="mt-2 text-[clamp(20px,2.6vw,26px)] font-black uppercase leading-[0.98] tracking-tight text-[#f2eee6]">
            Choose Your Priority
          </h2>
          <p className="mt-1.5 max-w-md text-[11.5px] leading-[1.5] text-white/50">
            Your selection drives the architecture, weekly bias, session order, and recovery / fuel context. This is yours alone — Reserve never assumes a priority from gender.
          </p>

          {/* Goal identities — profile-aware outcome set; muscle priorities set underneath */}
          <div className="mt-5">
            <p className="font-mono text-[8px] uppercase tracking-[0.22em]" style={{ color: `${GOLD}cc` }}>Goal · choose an outcome</p>
            <p className="mt-1 text-[10px] leading-snug text-white/40">Pick what you&apos;re building. Reserve sets the priorities underneath — you can fine-tune them below.</p>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {priorityOptions.map((p) => (
                <Chip
                  key={p.id}
                  label={p.label}
                  active={priorityOptionMatches(p, { primary, secondary, support, track })}
                  tone={GOLD_BRIGHT}
                  title={p.description}
                  onClick={() => applyGoalPreset(p)}
                />
              ))}
            </div>
          </div>

          {/* Activity Stack — lifestyle / outside-training context */}
          <div className="mt-5">
            <p className="font-mono text-[8px] uppercase tracking-[0.22em]" style={{ color: `${STEEL}cc` }}>Activity Stack · life outside the gym</p>
            <p className="mt-1 text-[10px] leading-snug text-white/40">Tell Reserve what your week actually includes. Pilates, yoga, and sport change how the plan paces fatigue.</p>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {ACTIVITY_STACKS.map((s) => (
                <Chip
                  key={s.key}
                  label={s.label}
                  active={activityStack === s.key}
                  tone={STEEL}
                  title={s.blurb}
                  onClick={() => setActivityStack(s.key, activitySport)}
                />
              ))}
            </div>
            {(activityStack === "gym-sports" || activityStack === "gym-pilates-sports" || activityStack === "full-hybrid") && (
              <div className="mt-2">
                <p className="font-mono text-[7.5px] uppercase tracking-[0.18em] text-white/35">Sport</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {SPORT_OPTIONS.map((sp) => (
                    <Chip
                      key={sp.key}
                      label={sp.label}
                      active={activitySport === sp.key}
                      tone={GOLD}
                      onClick={() => setActivityStack(activityStack, activitySport === sp.key ? null : sp.key)}
                    />
                  ))}
                </div>
              </div>
            )}
            <p className="mt-2 text-[10.5px] leading-[1.5] text-white/45">{activityStackLanguage(activityStack, activitySport)}</p>
          </div>

          {/* Women's Performance physique tracks — premium, multiple options */}
          {womensEnabled && (
            <div className="mt-5">
              <p className="font-mono text-[8px] uppercase tracking-[0.22em]" style={{ color: `${VIOLET}cc` }}>Women&apos;s Physique Architecture</p>
              <p className="mt-1 text-[10px] leading-snug text-white/40">Shape-frequency architecture — glutes train across the week, not on one day.</p>
              <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
                {WOMENS_TRACK_ORDER.map((key) => {
                  const t = WOMENS_TRACKS[key];
                  const active = track === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => pickTrack(key)}
                      aria-pressed={active}
                      className="rounded-2xl border p-3.5 text-left transition-all duration-200"
                      style={active
                        ? { borderColor: `${VIOLET}66`, background: `linear-gradient(140deg, ${VIOLET}1a, rgba(255,255,255,0.012) 60%)`, boxShadow: `0 0 20px ${VIOLET}2a` }
                        : { borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" }}
                    >
                      <p className="text-[12.5px] font-black text-[#f2eee6]">{t.name}</p>
                      <p className="mt-1 text-[10.5px] font-semibold leading-snug" style={{ color: `${VIOLET}e6` }}>{t.desireHook}</p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {t.priorityMuscles.map((m) => (
                          <span key={m} className="rounded-full border px-1.5 py-0.5 font-mono text-[7px] uppercase tracking-[0.12em]" style={{ borderColor: `${VIOLET}33`, color: `${VIOLET}cc` }}>{m}</span>
                        ))}
                      </div>
                      <p className="mt-2 text-[9.5px] leading-[1.5] text-white/45">
                        <span className="font-mono text-[7px] uppercase tracking-[0.12em]" style={{ color: `${STEEL}cc` }}>The chase · </span>
                        {t.theChase}
                      </p>
                      <p className="mt-1.5 font-mono text-[7.5px] uppercase tracking-[0.12em] text-white/35">Weekly engine · {t.weeklyRhythm}</p>
                      <p className="mt-1.5 text-[9.5px] leading-[1.5] text-white/45">
                        <span className="font-mono text-[7px] uppercase tracking-[0.12em]" style={{ color: `${GOLD}cc` }}>Trend targets · </span>
                        {t.visibleTrendTargets.slice(0, 4).join(" · ")}
                      </p>
                      <p className="mt-1 text-[9.5px] leading-snug text-white/38">Perfect for · {t.bestFor}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Primary */}
          <div className="mt-5">
            <p className="font-mono text-[8px] uppercase tracking-[0.22em]" style={{ color: `${GOLD}cc` }}>Primary Focus · one</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {MUSCLE_PRIORITIES.map((m) => (
                <Chip key={m.id} label={m.label} active={primary === m.id} tone={GOLD} onClick={() => toggle("primary", m.id)} />
              ))}
            </div>
          </div>

          {/* Secondary */}
          <div className="mt-4">
            <p className="font-mono text-[8px] uppercase tracking-[0.22em]" style={{ color: `${VIOLET}cc` }}>Secondary Focus · up to 3</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {MUSCLE_PRIORITIES.map((m) => (
                <Chip key={m.id} label={m.label} active={secondary.includes(m.id)} tone={VIOLET} onClick={() => toggle("secondary", m.id)} />
              ))}
            </div>
          </div>

          {/* Support */}
          <div className="mt-4">
            <p className="font-mono text-[8px] uppercase tracking-[0.22em]" style={{ color: `${STEEL}cc` }}>Support / Maintenance</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {MUSCLE_PRIORITIES.map((m) => (
                <Chip key={m.id} label={m.label} active={support.includes(m.id)} tone={STEEL} onClick={() => toggle("support", m.id)} />
              ))}
            </div>
          </div>

          {/* Architecture preview */}
          {/* A leading accent rail, not a card inside this panel
              (components.md rule 1). */}
          <div
            className="mt-5 border-l-2 py-1 pl-4"
            style={{ borderColor: `${GOLD}4d`, background: `linear-gradient(135deg, ${GOLD}0e 0%, rgba(255,255,255,0.012) 60%)` }}
          >
            <div className="flex items-center gap-2">
              <Sparkles size={12} style={{ color: GOLD }} />
              <p className="font-mono text-[8px] uppercase tracking-[0.22em]" style={{ color: `${GOLD}cc` }}>Architecture Preview</p>
            </div>
            {(primary || track) ? (
              <>
                <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-white/55">
                  {track ? (
                    <span><span className="font-mono text-[7.5px] uppercase tracking-[0.14em] text-white/30">Focus · </span><span className="font-bold text-[#f2eee6]">{preview.focusLabel}</span></span>
                  ) : (
                    <>
                      <span><span className="font-mono text-[7.5px] uppercase tracking-[0.14em] text-white/30">Primary · </span><span className="font-bold text-[#f2eee6]">{primary ? musclePriorityLabel(primary) : "—"}</span></span>
                      {secondary.length > 0 && <span><span className="font-mono text-[7.5px] uppercase tracking-[0.14em] text-white/30">Secondary · </span>{secondary.map(musclePriorityLabel).join(" · ")}</span>}
                      {support.length > 0 && <span><span className="font-mono text-[7.5px] uppercase tracking-[0.14em] text-white/30">Support · </span>{support.map(musclePriorityLabel).join(" · ")}</span>}
                    </>
                  )}
                </div>
                <p className="mt-2 text-[15px] font-black leading-tight text-[#f2eee6]">{activeOption?.previewTitle ?? preview.architectureName}</p>
                {track && (
                  <p className="mt-1 text-[11px] leading-[1.5] text-white/55">
                    <span className="font-mono text-[7.5px] uppercase tracking-[0.14em]" style={{ color: `${GOLD}cc` }}>Built for · </span>{WOMENS_TRACKS[track].bestFor}
                  </p>
                )}
                <p className="mt-1 text-[11px] leading-[1.5] text-white/50">{activeOption?.previewExplanation ?? preview.weeklyBias}</p>
                {activeOption?.intent && (
                  <p className="mt-1 text-[10.5px] leading-[1.5] text-white/45">
                    <span className="font-mono text-[7.5px] uppercase tracking-[0.14em]" style={{ color: `${STEEL}cc` }}>Intent · </span>{activeOption.intent}
                  </p>
                )}
                {track && <p className="mt-1 text-[10.5px] leading-[1.5] text-white/45">{WOMENS_TRACKS[track].nutrition}</p>}
                <p className="mt-2 font-mono text-[8px] uppercase tracking-[0.16em] text-white/35">
                  This changes · weekly split · session order · movement emphasis · recovery + fuel context
                </p>
              </>
            ) : (
              <p className="mt-2 text-[11.5px] leading-[1.5] text-white/45">
                Select a women&apos;s physique track or a primary focus to preview your architecture. Without one, Reserve uses a balanced architecture.
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={apply}
              disabled={!dirty}
              /* Secondary: this panel's only consumer is Personal Command, whose
                 one gold action is the hero's. The sheen is primary-only (Bible §11). */
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl px-4 py-2.5 text-[12px] font-bold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-40"
              style={{ background: `${GOLD}14`, border: `1px solid ${GOLD}4d`, color: GOLD }}
              title={dirty ? "Apply this focus and rebuild your architecture" : "No changes to apply"}
            >
              <Check size={14} />{focus?.primary || focus?.track ? "Update Architecture" : "Apply Focus"}
            </button>
            {(primary || track || focus?.primary || focus?.track) && (
              <button
                type="button"
                onClick={reset}
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.1] px-3 py-2.5 font-mono text-[8.5px] uppercase tracking-[0.16em] text-white/45 transition hover:bg-white/[0.04] hover:text-white/70"
              >
                <RotateCcw size={11} />Clear
              </button>
            )}
            {(focus?.primary || focus?.track) && !dirty && (
              <span className="inline-flex items-center gap-1.5 font-mono text-[8px] uppercase tracking-[0.16em]" style={{ color: STEEL }}>
                <Target size={11} />Architecture Active
              </span>
            )}
          </div>
        </div>
      </div>
    </GlassPanel>
  );
}
