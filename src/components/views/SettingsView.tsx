"use client";

/* ════════════════════════════════════════════════════════════════════════
   SETTINGS — a utility screen.

   One h1, one statement of the member's account state, one gold action
   chosen by `resolveSettingsPrimaryAction`, then eight flush sections in
   the order a member looks for them:

     profile · training setup · schedule · modules · notifications ·
     data and sync · account · legal

   Every control from the previous screen is still here and still writes
   the same store field. What changed is the shape: a setting is a row, a
   choice is a control, and no card sits inside another card.

   Kept exactly as they behave today: the age correction (which closes the
   adults-only tools for an age under 18), real Stripe checkout and the
   billing portal, and the typed confirmation before account deletion.
   ════════════════════════════════════════════════════════════════════════ */

import { useState } from "react";
import { ArrowRight, Download, LogOut, Settings, Trash2 } from "lucide-react";

import {
  type AICoachStyle,
  type FatigueSensitivity,
  type FocusZone,
  type PhysiqueArchetype,
  type RecoveryAggression,
  type TrainingIntelligenceMode,
  useAthleteDashboardStore,
} from "@/lib/athlete-store";
import { PUBLIC_PRICING, USER_PERSONA_CONFIG, type UserPersona, publicTierFor, tierRequiredFor } from "@/lib/saas-config";
import { PROFILE_PATH_DESCRIPTIONS, PROFILE_PATH_LABELS, deriveProfilePath, type ProfilePath } from "@/lib/modules/registry";
import { SAFETY_SCOPE_LABEL } from "@/lib/modules/safety-copy";
import {
  MOBILITY_PREFERENCE_LABELS,
  PRE_WORKOUT_FUEL_LABELS,
  TRAINING_WINDOW_LABELS,
  type MobilityPreference,
  type PreWorkoutFuel,
  type TrainingWindow,
} from "@/lib/schedule/types";
import {
  EARLY_SESSION_WINDOW_MIN,
  POST_WORKOUT_HOME_BUFFER_MIN,
  POST_WORKOUT_MEAL_DELAY_MIN,
  formatTime12,
  isEarlySession,
} from "@/lib/schedule/engine";
import { HARDASS_COPY } from "@/lib/accountability/hardass-prep";
import { FUEL_GOAL_LABEL } from "@/lib/nutrition/fuel-plan";
import { PEAK_LOOKS, PEAK_LOOK_ORDER, type PeakLook } from "@/lib/nutrition/peak-mode";
import { RESERVE } from "@/lib/design/tokens";
import { SoundSettings } from "@/components/settings/SoundSettings";
import { resolveSettingsPrimaryAction, type SettingsPrimaryAction, type SettingsSection as SectionId } from "@/lib/settings/primary-action";
import { SYNC_STATUS_META, useSyncStatusStore } from "@/lib/sync/sync-status";
import { ReserveButton, ReserveSelect } from "@/components/ui/reserve";
import { useUpgradeCheckout } from "@/components/subscription/useUpgradeCheckout";
import { CloudRecoveryRow } from "@/components/settings/CloudRecoveryRow";
import { DeviceRecoveryRow } from "@/components/settings/DeviceRecoveryRow";
import { MenuLayoutPanel } from "@/components/settings/MenuLayoutPanel";
import { ProfileAgeField } from "@/components/settings/ProfileAgeField";
import { ProfileNameField } from "@/components/settings/ProfileNameField";
import { WhoopConnectionRow } from "@/components/settings/WhoopConnectionRow";
import {
  OptionButtons,
  SETTINGS_INPUT,
  SETTINGS_LABEL,
  SettingRow,
  SettingsSection,
  SwitchControl,
} from "@/components/settings/SettingsControls";
import { useAuth } from "@/components/auth/AuthProvider";
import { OwnerModeAccountLine } from "@/components/authz/OwnerResearchMode";

import { ViewShell } from "./ViewShell";
import { UtilityHero, focusSection } from "./utility/UtilityHero";

const TRAINING_WINDOWS: TrainingWindow[] = ["morning", "midday", "afternoon", "evening", "night"];
const MOBILITY_PREFERENCES: MobilityPreference[] = ["pre-session", "post-session", "both", "as-needed"];
const PROFILE_PATHS: ProfilePath[] = ["general-fitness", "physique", "mens-performance", "womens-performance", "enhanced-log-only"];

const SECTIONS: Array<{ id: SectionId; label: string }> = [
  { id: "profile", label: "Profile" },
  { id: "training", label: "Training setup" },
  { id: "schedule", label: "Schedule" },
  { id: "modules", label: "Modules" },
  { id: "notifications", label: "Notifications" },
  { id: "data", label: "Data and sync" },
  { id: "account", label: "Account" },
  { id: "legal", label: "Legal" },
];
const anchor = (id: SectionId) => `settings-${id}`;

const ARCHETYPE_OPTIONS: Array<{ value: PhysiqueArchetype; label: string; sub: string }> = [
  { value: "classic-physique", label: "Classic Physique", sub: "V-taper · symmetry · aesthetics" },
  { value: "mens-physique", label: "Men's Physique", sub: "Lean · upper-body aesthetics" },
  { value: "open-bodybuilding", label: "Open Bodybuilding", sub: "Maximum mass · full development" },
  { value: "powerbuilder", label: "Powerbuilder", sub: "Strength + hypertrophy hybrid" },
  { value: "hybrid-athlete", label: "Hybrid Athlete", sub: "Performance + physique balance" },
  { value: "functional-tactical", label: "Functional Tactical", sub: "Work capacity · athleticism" },
  { value: "fat-loss-transformation", label: "Fat Loss Transformation", sub: "Recomposition · deficit phase" },
  { value: "female-bikini", label: "Female Bikini", sub: "Glutes · waist · shoulder balance" },
  { value: "female-wellness", label: "Female Wellness", sub: "Lower development · full symmetry" },
  { value: "female-performance", label: "Female Performance", sub: "Athletic strength · physique" },
];

/* Peak Mode: the same look Compound Command sets. "off" clears it. */
const PEAK_OPTIONS: Array<{ value: PeakLook | "off"; label: string; sub: string }> = [
  { value: "off", label: "Off", sub: "Nutrition follows your goal" },
  ...PEAK_LOOK_ORDER.map((look) => ({ value: look, label: PEAK_LOOKS[look].label, sub: `Fuel goal: ${FUEL_GOAL_LABEL[PEAK_LOOKS[look].goal]}` })),
];

const AI_COACH_STYLE_OPTIONS: Array<{ value: AICoachStyle; label: string; sub: string }> = [
  { value: "operator", label: "Precision Analyst", sub: "Metrics, trends and decisions, stated plainly" },
  { value: "elite-coach", label: "Bodybuilding Coach", sub: "Volume and periodization first" },
  { value: "hardass-prep", label: HARDASS_COPY.optionLabel, sub: HARDASS_COPY.optionSub },
  { value: "recovery-scientist", label: "Recovery Scientist", sub: "Sleep and recovery load first" },
  { value: "lifestyle-strategist", label: "Lifestyle Strategist", sub: "Progress built around your actual life" },
];

const FOCUS_ZONE_OPTIONS: Array<{ value: FocusZone; label: string }> = [
  { value: "upper-chest", label: "Upper Chest" },
  { value: "delts", label: "Delts" },
  { value: "lats", label: "Lats" },
  { value: "arms", label: "Arms" },
  { value: "quads", label: "Quads" },
  { value: "hamstrings", label: "Hamstrings" },
  { value: "core", label: "Core" },
];

export function SettingsView() {
  const profile = useAthleteDashboardStore((s) => s.profile);
  const updateProfile = useAthleteDashboardStore((s) => s.updateProfile);
  const peakLook = useAthleteDashboardStore((s) => s.nutritionPrefs.peakLook);
  const setNutritionPrefs = useAthleteDashboardStore((s) => s.setNutritionPrefs);
  const setPersona = useAthleteDashboardStore((s) => s.setPersona);
  const setActiveView = useAthleteDashboardStore((s) => s.setActiveView);
  const subscriptionTier = useAthleteDashboardStore((s) => s.subscriptionTier);
  const settings = useAthleteDashboardStore((s) => s.settings);
  const updateSettings = useAthleteDashboardStore((s) => s.updateSettings);
  const age = useAthleteDashboardStore((s) => s.setupProfile.age);
  const { status: authStatus, user } = useAuth();
  const syncStatus = useSyncStatusStore((s) => s.status);
  const lastSavedAt = useSyncStatusStore((s) => s.lastSavedAt);

  const signedIn = authStatus === "signed-in" && Boolean(user);
  const plan = resolveSettingsPrimaryAction({ signedIn, syncStatus, age, name: profile.name });

  function run(action: SettingsPrimaryAction) {
    switch (action.kind) {
      case "review-sync":
        focusSection(anchor("data"));
        break;
      case "add-age":
        focusSection(anchor("profile"), 'input[data-settings-field="age"]');
        break;
      case "add-name":
        focusSection(anchor("profile"), 'input[data-settings-field="name"]');
        break;
      case "open-personal-command":
        setActiveView("protocol-command");
        break;
    }
  }

  return (
    <ViewShell
      label="Account"
      title="Settings"
      icon={Settings}
      accentColor={RESERVE.gold}
      roomHero
      command="Your profile, training setup, schedule defaults, modules and account, in one place."
    >
      <UtilityHero
        testId="settings"
        eyebrow={`Account · ${signedIn ? "Signed in" : "Local mode"}`}
        statement={plan.statement}
        support={plan.support}
        reads={[
          { label: "Plan", value: publicTierFor(subscriptionTier).label },
          {
            label: "Data",
            value: signedIn ? SYNC_STATUS_META[syncStatus].label : "This device",
            detail: signedIn && lastSavedAt ? `Last confirmed ${new Date(lastSavedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : undefined,
          },
          { label: "Profile", value: `${plan.profileDetails.have} of ${plan.profileDetails.need}`, detail: "Name and age" },
        ]}
        action={{ label: plan.primary.label, onClick: () => run(plan.primary), iconAfter: plan.primary.kind === "open-personal-command" ? ArrowRight : undefined }}
      />

      <nav aria-label="Settings sections" className="-mt-1 flex flex-wrap gap-x-1 gap-y-0.5">
        {SECTIONS.map((section) => (
          <a
            key={section.id}
            href={`#${anchor(section.id)}`}
            className="inline-flex min-h-[44px] items-center px-2.5 font-mono text-[11px] uppercase tracking-[0.16em] text-white/60 transition-colors hover:text-white/90"
          >
            {section.label}
          </a>
        ))}
      </nav>

      {/* ─── PROFILE ─── */}
      <SettingsSection id={anchor("profile")} label="Profile" purpose="Who Reserve is organized around.">
        <SettingRow label="Name">
          <ProfileNameField />
        </SettingRow>
        <SettingRow label="Age" description="The adults-only cycle and lab tools read it.">
          <ProfileAgeField />
        </SettingRow>
        <SettingRow label="Units">
          <OptionButtons
            label="Units"
            options={[{ value: "imperial", label: "Imperial" }, { value: "metric", label: "Metric" }]}
            value={settings.units}
            onChange={(v) => updateSettings({ units: v })}
          />
        </SettingRow>
        <SettingRow label="Experience level">
          <OptionButtons
            label="Experience level"
            options={(Object.keys(USER_PERSONA_CONFIG) as UserPersona[]).map((persona) => ({ value: persona, label: USER_PERSONA_CONFIG[persona].label }))}
            value={profile.persona}
            onChange={setPersona}
          />
        </SettingRow>
        <SettingRow label="Physique archetype" description="The physique direction your training and check-ins are framed around." stacked>
          <OptionButtons
            label="Physique archetype"
            columns={3}
            options={ARCHETYPE_OPTIONS}
            value={profile.physiqueArchetype}
            onChange={(v) => updateProfile({ physiqueArchetype: v })}
          />
        </SettingRow>
      </SettingsSection>

      {/* ─── TRAINING SETUP ─── */}
      <SettingsSection id={anchor("training")} label="Training setup" accent={RESERVE.steel} purpose="How Reserve frames your training days and recovery.">
        <SettingRow
          label="Recovery approach"
          description={
            profile.recoveryAggression === "conservative"
              ? "Full recovery before the next session. Longer rest windows."
              : profile.recoveryAggression === "aggressive"
                ? "Train through moderate fatigue. Higher volume tolerance assumed."
                : "Balanced. Standard recovery windows."
          }
        >
          <OptionButtons<RecoveryAggression>
            label="Recovery approach"
            accent={RESERVE.steel}
            options={[
              { value: "conservative", label: "Conservative" },
              { value: "moderate", label: "Moderate" },
              { value: "aggressive", label: "Aggressive" },
            ]}
            value={profile.recoveryAggression}
            onChange={(v) => updateProfile({ recoveryAggression: v })}
          />
        </SettingRow>
        <SettingRow
          label="Training intelligence"
          description={
            profile.trainingIntelligenceMode === "adaptive"
              ? "Suggestions adjust to your recovery signals and trends."
              : profile.trainingIntelligenceMode === "periodized"
                ? "Block-based periodization. Structured mesocycles."
                : "Manual control. Reserve observes only and makes no suggestions."
          }
        >
          <OptionButtons<TrainingIntelligenceMode>
            label="Training intelligence"
            accent={RESERVE.steel}
            options={[
              { value: "adaptive", label: "Adaptive" },
              { value: "periodized", label: "Periodized" },
              { value: "manual", label: "Manual" },
            ]}
            value={profile.trainingIntelligenceMode}
            onChange={(v) => updateProfile({ trainingIntelligenceMode: v })}
          />
        </SettingRow>
        <SettingRow label="Fatigue sensitivity">
          <OptionButtons<FatigueSensitivity>
            label="Fatigue sensitivity"
            accent={RESERVE.steel}
            options={[
              { value: "low", label: "Low" },
              { value: "medium", label: "Medium" },
              { value: "high", label: "High" },
            ]}
            value={profile.fatigueSensitivity}
            onChange={(v) => updateProfile({ fatigueSensitivity: v })}
          />
        </SettingRow>
        <SettingRow label="Peak Mode" description="The look you are building. Your Nutrition plan and the Peak Mode day in Compound Command follow it." stacked>
          <OptionButtons
            label="Peak Mode"
            accent={RESERVE.steel}
            columns={2}
            options={PEAK_OPTIONS}
            value={peakLook ?? "off"}
            onChange={(v) => setNutritionPrefs({ peakLook: v === "off" ? null : v })}
          />
        </SettingRow>
        <SettingRow label="Coach voice" description="How insights and feedback are worded. It does not change your data." stacked>
          <OptionButtons
            label="Coach voice"
            accent={RESERVE.steel}
            columns={3}
            options={AI_COACH_STYLE_OPTIONS}
            value={profile.aiCoachStyle}
            onChange={(v) => updateProfile({ aiCoachStyle: v })}
          />
          {profile.aiCoachStyle === "hardass-prep" && (
            <p data-settings="hardass-prep-note" className="mt-3 max-w-[72ch] text-[12.5px] leading-[1.6] text-white/60">
              {HARDASS_COPY.settingsNote}
            </p>
          )}
        </SettingRow>
        <SettingRow label="Priority areas" description="Areas you want treated as priorities. Select any that apply." stacked>
          <div role="group" aria-label="Priority areas" className="flex flex-wrap gap-1">
            {FOCUS_ZONE_OPTIONS.map((opt) => {
              const on = (profile.weakPoints ?? []).includes(opt.value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  aria-pressed={on}
                  onClick={() => {
                    const current = profile.weakPoints ?? [];
                    updateProfile({ weakPoints: on ? current.filter((z) => z !== opt.value) : [...current, opt.value] });
                  }}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-lg px-3 text-[13px] font-semibold transition-colors hover:bg-white/[0.04]"
                  style={{ background: on ? "rgba(95,183,213,0.12)" : undefined, color: on ? RESERVE.ivory : "rgba(255,255,255,0.65)" }}
                >
                  <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full" style={{ background: on ? RESERVE.steel : "rgba(255,255,255,0.18)" }} />
                  {opt.label}
                </button>
              );
            })}
          </div>
        </SettingRow>
        <SettingRow label="Body composition estimate" description="Your own estimate, for trend context only. Reserve does not interpret it.">
          <label className="block w-full max-w-[280px]">
            <span className="sr-only">Body composition estimate</span>
            <input
              type="text"
              value={profile.bodyFat}
              onChange={(e) => updateProfile({ bodyFat: e.target.value })}
              placeholder="e.g. 12% or 185 lbs"
              className={SETTINGS_INPUT}
            />
          </label>
        </SettingRow>
      </SettingsSection>

      <ScheduleSection />
      <ModulesSection />

      {/* ─── NOTIFICATIONS ─── */}
      <SettingsSection id={anchor("notifications")} label="Notifications" accent={RESERVE.violet}>
        <SoundSettings />
        <SettingRow
          label="Notifications"
          description="Reserve does not send notifications yet. This saves your preference for when it does."
        >
          <SwitchControl
            label="Notifications"
            checked={settings.notificationsEnabled}
            onChange={(next) => updateSettings({ notificationsEnabled: next })}
          />
        </SettingRow>
      </SettingsSection>

      <DataSection />
      <AccountSection />

      {/* ─── LEGAL ─── */}
      <SettingsSection
        id={anchor("legal")}
        label="Legal"
        accent={RESERVE.slate}
        purpose="Reserve is training, nutrition and recovery organization, tracking and trend observation. It is not medical care, and it never diagnoses or gives dosing guidance."
      >
        <SettingRow label="Open-source notices" description="The open-source software Reserve is built with, and its licenses.">
          <a
            href="/open-source"
            className="inline-flex min-h-[44px] items-center gap-2 px-1 font-mono text-[11px] uppercase tracking-[0.16em] text-white/65 transition hover:text-white"
          >
            Open-source notices <ArrowRight size={12} aria-hidden="true" />
          </a>
        </SettingRow>
      </SettingsSection>
    </ViewShell>
  );
}

/* ─── Schedule ───────────────────────────────────────────────────────── */

function ScheduleSection() {
  const setActiveView = useAthleteDashboardStore((s) => s.setActiveView);
  const scheduleProfile = useAthleteDashboardStore((s) => s.scheduleProfile);
  const updateScheduleProfile = useAthleteDashboardStore((s) => s.updateScheduleProfile);
  const updateMealWindow = useAthleteDashboardStore((s) => s.updateMealWindow);

  return (
    <SettingsSection
      id={anchor("schedule")}
      label="Schedule"
      accent={RESERVE.steel}
      purpose={`Defaults your days are built from. Training ${formatTime12(scheduleProfile.preferredTrainingStart)}–${formatTime12(scheduleProfile.preferredTrainingEnd)} · sleep target ${formatTime12(scheduleProfile.sleepTarget)}.`}
      action={
        <ReserveButton tier="quiet" size="sm" iconAfter={ArrowRight} onClick={() => setActiveView("schedule-command")}>
          Schedule Command
        </ReserveButton>
      }
    >
      <SettingRow label="Times" stacked>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {([
            { label: "Wake time", key: "wakeTime" as const, value: scheduleProfile.wakeTime },
            { label: "Sleep target", key: "sleepTarget" as const, value: scheduleProfile.sleepTarget },
            { label: "Training start", key: "preferredTrainingStart" as const, value: scheduleProfile.preferredTrainingStart },
            { label: "Training end", key: "preferredTrainingEnd" as const, value: scheduleProfile.preferredTrainingEnd },
          ]).map((f) => (
            <label key={f.key} className="block min-w-0">
              <span className={SETTINGS_LABEL}>{f.label}</span>
              <input
                type="time"
                value={f.value}
                onChange={(e) => updateScheduleProfile({ [f.key]: e.target.value })}
                className={`${SETTINGS_INPUT} mt-1.5`}
              />
            </label>
          ))}
        </div>
      </SettingRow>
      <SettingRow label="Training window and mobility" stacked>
        <div className="grid gap-3 sm:grid-cols-2">
          <ReserveSelect
            label="Training Window"
            value={scheduleProfile.trainingWindow}
            options={TRAINING_WINDOWS.map((w) => ({ value: w, label: TRAINING_WINDOW_LABELS[w] }))}
            onChange={(v) => updateScheduleProfile({ trainingWindow: v as TrainingWindow })}
          />
          <ReserveSelect
            label="Mobility Preference"
            value={scheduleProfile.mobilityPreference}
            options={MOBILITY_PREFERENCES.map((m) => ({ value: m, label: MOBILITY_PREFERENCE_LABELS[m] }))}
            onChange={(v) => updateScheduleProfile({ mobilityPreference: v as MobilityPreference })}
          />
        </div>
      </SettingRow>
      <SettingRow label="Each week" stacked>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {([
            { label: "Training days", key: "trainingDaysPerWeek" as const, value: scheduleProfile.trainingDaysPerWeek, max: 7 },
            { label: "Cardio days", key: "cardioDaysPerWeek" as const, value: scheduleProfile.cardioDaysPerWeek, max: 7 },
            { label: "Abs days", key: "absDaysPerWeek" as const, value: scheduleProfile.absDaysPerWeek, max: 7 },
            { label: "Sauna days", key: "saunaDaysPerWeek" as const, value: scheduleProfile.saunaDaysPerWeek, max: 7 },
            { label: "Mobility min", key: "preSessionMobilityMinutes" as const, value: scheduleProfile.preSessionMobilityMinutes, max: 30 },
          ]).map((f) => (
            <label key={f.key} className="block min-w-0">
              <span className={SETTINGS_LABEL}>{f.label}</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={f.max}
                value={f.value}
                onChange={(e) => updateScheduleProfile({ [f.key]: Math.max(0, Math.min(f.max, Number(e.target.value) || 0)) })}
                className={`${SETTINGS_INPUT} tnum mt-1.5`}
              />
            </label>
          ))}
        </div>
      </SettingRow>
      <SettingRow
        label="Before and after training"
        description={
          scheduleProfile.preWorkoutFuel
            ? "Your choice sets what is planned before a session. Food only."
            : `Auto: ${isEarlySession(scheduleProfile) ? `your session starts within ${EARLY_SESSION_WINDOW_MIN} min of waking, so you train fasted and meal 1 lands when you're home` : "a pre-workout meal lands about 90 min before your session"}.`
        }
        stacked
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <ReserveSelect
            label="Pre-workout fuel"
            value={scheduleProfile.preWorkoutFuel ?? "auto"}
            options={[
              { value: "auto", label: "Auto (from your times)" },
              ...(Object.keys(PRE_WORKOUT_FUEL_LABELS) as PreWorkoutFuel[]).map((f) => ({ value: f, label: PRE_WORKOUT_FUEL_LABELS[f] })),
            ]}
            onChange={(v) => updateScheduleProfile({ preWorkoutFuel: v === "auto" ? null : (v as PreWorkoutFuel) })}
          />
          <label className="block min-w-0">
            <span className={SETTINGS_LABEL}>Home after training (min)</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={180}
              placeholder={String(isEarlySession(scheduleProfile) ? POST_WORKOUT_HOME_BUFFER_MIN : POST_WORKOUT_MEAL_DELAY_MIN)}
              value={scheduleProfile.postWorkoutHomeMinutes ?? ""}
              onChange={(e) =>
                updateScheduleProfile({
                  postWorkoutHomeMinutes: e.target.value === "" ? null : Math.max(0, Math.min(180, Math.round(Number(e.target.value) || 0))),
                })
              }
              className={`${SETTINGS_INPUT} tnum mt-1.5`}
            />
          </label>
        </div>
      </SettingRow>
      <SettingRow label="Meal windows" description="Pre- and post-workout meals are timed around your training window automatically." stacked>
        <ul className="flex flex-col divide-y divide-white/[0.05]">
          {scheduleProfile.mealWindows.map((w) => {
            /* An early session makes meal 1 the post-workout breakfast, so the anchor is timed by the day too. */
            const anchorAuto = w.id === "morning-anchor" && isEarlySession(scheduleProfile);
            const auto = w.id === "pre-workout" || w.id === "post-workout" || anchorAuto;
            return (
              <li key={w.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2">
                <span className="min-w-[160px] flex-1 text-[13.5px] font-semibold text-white/85">{w.label}</span>
                <label className="block">
                  <span className="sr-only">{w.label} time</span>
                  <input
                    type="time"
                    value={w.time}
                    disabled={auto}
                    title={anchorAuto ? "Auto-timed: training right after waking makes meal 1 the post-workout breakfast" : auto ? "Auto-timed around your training window" : undefined}
                    onChange={(e) => updateMealWindow(w.id, { time: e.target.value })}
                    className={`${SETTINGS_INPUT} w-[140px]`}
                  />
                </label>
                <SwitchControl label={`${w.label} window`} checked={w.enabled} onChange={(next) => updateMealWindow(w.id, { enabled: next })} />
              </li>
            );
          })}
        </ul>
      </SettingRow>
    </SettingsSection>
  );
}

/* ─── Modules ────────────────────────────────────────────────────────── */

function ModulesSection() {
  const setActiveView = useAthleteDashboardStore((s) => s.setActiveView);
  const settings = useAthleteDashboardStore((s) => s.settings);
  const updateSettings = useAthleteDashboardStore((s) => s.updateSettings);
  const genderIdentity = useAthleteDashboardStore((s) => s.profile.coachingProfile?.genderIdentity);
  const womens = useAthleteDashboardStore((s) => s.womens);
  const setWomensEnabled = useAthleteDashboardStore((s) => s.setWomensEnabled);
  const updateFertilityModule = useAthleteDashboardStore((s) => s.updateFertilityModule);
  const updatePregnancyModule = useAthleteDashboardStore((s) => s.updatePregnancyModule);
  const modulePreferences = useAthleteDashboardStore((s) => s.modulePreferences);
  const setProfilePath = useAthleteDashboardStore((s) => s.setProfilePath);
  const setEnhancedLogOnly = useAthleteDashboardStore((s) => s.setEnhancedLogOnly);

  const effectiveProfilePath = modulePreferences.profilePath ?? deriveProfilePath(genderIdentity);
  const autoPath = deriveProfilePath(genderIdentity);
  const womensAutoOn = genderIdentity === "female" || effectiveProfilePath === "womens-performance";
  const womensActive = womens.enabled || womensAutoOn;

  const optional: Array<{
    key: string;
    label: string;
    scope: string;
    active: boolean;
    auto: boolean;
    disabledReason?: string;
    toggle: () => void;
  }> = [
    {
      key: "womens",
      label: "Women's Performance OS",
      scope: "Observational tracking and cycle estimates only",
      active: womensActive,
      auto: womensAutoOn,
      toggle: () => setWomensEnabled(!womens.enabled),
    },
    {
      key: "enhanced",
      label: "Enhanced · Log-Only",
      scope: SAFETY_SCOPE_LABEL["log-only"],
      active: modulePreferences.enhancedLogOnly,
      auto: false,
      toggle: () => setEnhancedLogOnly(!modulePreferences.enhancedLogOnly),
    },
    {
      key: "fertility",
      label: "Fertility Command",
      scope: SAFETY_SCOPE_LABEL["lifestyle-only"],
      active: womens.fertility.enabled,
      auto: false,
      disabledReason: womensActive ? undefined : "Turn on Women's Performance OS first",
      toggle: () => updateFertilityModule({ enabled: !womens.fertility.enabled }),
    },
    {
      key: "pregnancy",
      label: "Pregnancy Command",
      scope: SAFETY_SCOPE_LABEL["lifestyle-only"],
      active: womens.pregnancy.enabled,
      auto: false,
      disabledReason: womensActive ? undefined : "Turn on Women's Performance OS first",
      toggle: () => updatePregnancyModule({ enabled: !womens.pregnancy.enabled }),
    },
  ];

  return (
    <SettingsSection
      id={anchor("modules")}
      label="Modules"
      purpose={`Choose your path and which optional modules appear.${tierRequiredFor("ai-strategist") === "elite" ? " Advanced modules are part of Reserve Black." : ""} Sensitive modules stay log-only and never prescribe or diagnose.`}
    >
      <SettingRow label="Performance path" description="Reserve only surfaces what is relevant to this path." stacked>
        <OptionButtons
          label="Performance path"
          columns={3}
          options={PROFILE_PATHS.map((path) => ({
            value: path,
            label: PROFILE_PATH_LABELS[path],
            sub: `${PROFILE_PATH_DESCRIPTIONS[path]}${!modulePreferences.profilePath && autoPath === path ? " · auto" : ""}`,
          }))}
          value={effectiveProfilePath}
          onChange={(path) => setProfilePath(path === effectiveProfilePath && modulePreferences.profilePath ? null : path)}
        />
      </SettingRow>

      {optional.map((m) => (
        <SettingRow key={m.key} label={m.label} description={m.auto ? `${m.scope} · on for your path` : m.scope}>
          {m.auto ? (
            <SwitchControl label={m.label} checked disabled disabledReason="On automatically for your performance path" stateLabel="Auto" onChange={m.toggle} />
          ) : m.disabledReason ? (
            <SwitchControl label={m.label} checked={m.active} disabled disabledReason={m.disabledReason} onChange={m.toggle} />
          ) : (
            <SwitchControl label={m.label} checked={m.active} onChange={m.toggle} />
          )}
        </SettingRow>
      ))}

      {womensActive && (
        <SettingRow label="Women's commands" stacked>
          <div className="flex flex-wrap gap-1">
            {[
              { label: "Cycle Command", view: "womens-cycle" as const },
              { label: "Fertility Command", view: "womens-fertility" as const },
              { label: "Pregnancy Command", view: "womens-pregnancy" as const },
            ].map(({ label, view }) => (
              <ReserveButton key={view} tier="quiet" size="sm" iconAfter={ArrowRight} onClick={() => setActiveView(view)}>
                {label}
              </ReserveButton>
            ))}
          </div>
        </SettingRow>
      )}

      <SettingRow label="Compound Command" description="Supplements, peptides, hormones, medications and recovery, as you enter them. Reserve does not prescribe or adjust dosing.">
        <ReserveButton tier="secondary" accent={RESERVE.slate} size="sm" iconAfter={ArrowRight} onClick={() => setActiveView("supplements")}>
          Open Module
        </ReserveButton>
      </SettingRow>

      <SettingRow label="Personal Command" description="Your protocol, deadline, training environment and command profile live here, not in Settings.">
        <ReserveButton tier="quiet" size="sm" iconAfter={ArrowRight} onClick={() => setActiveView("protocol-command")}>
          Personal Command
        </ReserveButton>
      </SettingRow>

      <SettingRow label="Dashboard density">
        <OptionButtons
          label="Dashboard density"
          options={[
            { value: "focused", label: "Focused" },
            { value: "operator", label: "Detailed" },
            { value: "dense", label: "Dense" },
          ]}
          value={settings.dashboardDensity}
          onChange={(v) => updateSettings({ dashboardDensity: v })}
        />
      </SettingRow>

      <li className="py-3.5 last:pb-0">
        <MenuLayoutPanel />
      </li>
    </SettingsSection>
  );
}

/* ─── Data and sync ──────────────────────────────────────────────────── */

function DataSection() {
  const resetOnboarding = useAthleteDashboardStore((s) => s.resetOnboarding);
  const { status, user, exportAccount } = useAuth();
  const syncStatus = useSyncStatusStore((s) => s.status);
  const lastSavedAt = useSyncStatusStore((s) => s.lastSavedAt);
  const detail = useSyncStatusStore((s) => s.detail);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const signedIn = status === "signed-in" && Boolean(user);

  const runExport = async () => {
    setBusy(true);
    setError(null);
    try {
      await exportAccount();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export could not be completed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SettingsSection id={anchor("data")} label="Data and sync" accent={RESERVE.green}>
      <SettingRow
        label={signedIn ? "Cloud sync" : "Local mode"}
        description={
          signedIn
            ? `${SYNC_STATUS_META[syncStatus].label}${lastSavedAt ? ` · last confirmed ${new Date(lastSavedAt).toLocaleTimeString()}` : ""}${syncStatus === "error" && detail ? ` · ${detail}` : ""}`
            : "Cloud sign-in is not configured in this environment. Progress is stored on this device only."
        }
      >
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-white/60">
          {signedIn ? SYNC_STATUS_META[syncStatus].label : "This device"}
        </span>
      </SettingRow>

      {signedIn && (
        <SettingRow label="Export your data" description="A copy of your account records, prepared for download.">
          {busy ? (
            <ReserveButton tier="secondary" accent={RESERVE.slate} size="sm" icon={Download} busy>
              Preparing
            </ReserveButton>
          ) : (
            <ReserveButton tier="secondary" accent={RESERVE.slate} size="sm" icon={Download} onClick={() => void runExport()}>
              Export Data
            </ReserveButton>
          )}
        </SettingRow>
      )}

      <WhoopConnectionRow />

      <DeviceRecoveryRow />

      <CloudRecoveryRow />

      <SettingRow
        label="Restart setup"
        description="Runs onboarding again from the first step. Nothing you have logged is removed."
      >
        {!confirmReset ? (
          <ReserveButton tier="secondary" accent={RESERVE.slate} size="sm" onClick={() => setConfirmReset(true)}>
            Reset Onboarding
          </ReserveButton>
        ) : (
          <div role="group" aria-label="Confirm restarting setup" className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] text-white/70">Restart setup now?</span>
            <ReserveButton tier="danger" size="sm" onClick={() => { setConfirmReset(false); resetOnboarding(); }}>
              Yes, restart
            </ReserveButton>
            <ReserveButton tier="quiet" size="sm" onClick={() => setConfirmReset(false)}>
              Cancel
            </ReserveButton>
          </div>
        )}
      </SettingRow>
      {error && (
        <li className="pt-2">
          <p role="alert" className="text-[12px] leading-[1.5] text-[#ef9b7d]">{error}</p>
        </li>
      )}
    </SettingsSection>
  );
}

/* ─── Account ────────────────────────────────────────────────────────── */

function AccountSection() {
  const subscriptionTier = useAthleteDashboardStore((s) => s.subscriptionTier);
  const { status, user, signOut, deleteAccount } = useAuth();
  /* Billing is a server transaction, never a local tier write. */
  const { startCheckout, openPortal, pending: billingPending, error: billingError } = useUpgradeCheckout();
  const [busy, setBusy] = useState<"delete" | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [accountError, setAccountError] = useState<string | null>(null);
  const signedIn = status === "signed-in" && Boolean(user);
  const current = publicTierFor(subscriptionTier).id;

  const runDelete = async () => {
    setBusy("delete");
    setAccountError(null);
    try {
      await deleteAccount(confirmation);
    } catch (error) {
      setAccountError(error instanceof Error ? error.message : "Deletion could not be completed.");
      setBusy(null);
    }
  };

  return (
    <SettingsSection id={anchor("account")} label="Account" accent={RESERVE.amber} detail="vault-door">
      {signedIn && user && (
        <SettingRow label="Signed in as">
          <span className="block max-w-full truncate text-[14px] text-[#ece8df]/85">{user.email ?? user.id}</span>
        </SettingRow>
      )}

      {PUBLIC_PRICING.map((plan) => {
        const active = plan.id === current;
        return (
          <SettingRow
            key={plan.id}
            label={`${plan.label} · ${plan.price}`}
            description={
              <>
                {plan.tagline}
                <span className="mt-1 block text-white/45">{plan.features.slice(0, 4).join(" · ")}</span>
              </>
            }
          >
            {/* Real checkout. The plan the member is already on is not a purchase. */}
            {active ? (
              <span className="inline-flex min-h-[44px] items-center font-mono text-[11px] uppercase tracking-[0.16em] text-[#e8c87a]">Your plan</span>
            ) : billingPending ? (
              <ReserveButton tier="secondary" accent={RESERVE.amber} size="sm" busy>
                Opening checkout
              </ReserveButton>
            ) : (
              <ReserveButton tier="secondary" accent={RESERVE.amber} size="sm" onClick={() => void startCheckout(plan.internalTier)}>
                Choose {plan.label}
              </ReserveButton>
            )}
          </SettingRow>
        );
      })}

      <SettingRow label="Billing" description="Payment details and cancellation are handled on the secure billing portal.">
        {/* Stripe's hosted portal — the only place a member can change payment
            details or cancel. Reserve deliberately does not rebuild that. */}
        {billingPending ? (
          <ReserveButton tier="quiet" size="sm" busy>
            Opening
          </ReserveButton>
        ) : (
          <ReserveButton tier="quiet" size="sm" iconAfter={ArrowRight} onClick={() => void openPortal()}>
            Manage billing
          </ReserveButton>
        )}
      </SettingRow>
      {billingError && (
        <li className="pb-2">
          <p role="alert" className="text-[12px] leading-[1.5] text-[#ef9b7d]">{billingError}</p>
        </li>
      )}

      {signedIn && (
        <SettingRow label="Sign out" description="Saves your latest progress to your account, then clears member data from this device.">
          {busy ? (
            <ReserveButton tier="secondary" accent={RESERVE.slate} size="sm" icon={LogOut} disabled disabledReason="Deletion in progress">
              Sign Out
            </ReserveButton>
          ) : (
            <ReserveButton tier="secondary" accent={RESERVE.slate} size="sm" icon={LogOut} onClick={() => void signOut()}>
              Sign Out
            </ReserveButton>
          )}
        </SettingRow>
      )}

      {signedIn && (
        <SettingRow label="Delete account" description="Permanently removes your account, cloud records and private files. Export first if you need a copy." stacked>
          {!deleteOpen ? (
            <div>
              <ReserveButton tier="danger" size="sm" icon={Trash2} onClick={() => setDeleteOpen(true)}>
                Delete Account
              </ReserveButton>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              <label className="block max-w-sm">
                <span className={SETTINGS_LABEL}>Type DELETE MY RESERVE ACCOUNT</span>
                <input
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  className={`${SETTINGS_INPUT} mt-1.5`}
                  autoComplete="off"
                />
              </label>
              <div className="flex flex-wrap gap-2">
                {confirmation === "DELETE MY RESERVE ACCOUNT" && busy === null ? (
                  <ReserveButton tier="danger" size="sm" onClick={() => void runDelete()}>
                    Delete Permanently
                  </ReserveButton>
                ) : (
                  <ReserveButton
                    tier="danger"
                    size="sm"
                    disabled
                    disabledReason={busy ? "Deleting" : "Type the confirmation exactly to continue"}
                  >
                    {busy === "delete" ? "Deleting" : "Delete Permanently"}
                  </ReserveButton>
                )}
                {busy ? (
                  <ReserveButton tier="quiet" size="sm" disabled disabledReason="Deletion in progress">
                    Cancel
                  </ReserveButton>
                ) : (
                  <ReserveButton
                    tier="quiet"
                    size="sm"
                    onClick={() => {
                      setDeleteOpen(false);
                      setConfirmation("");
                    }}
                  >
                    Cancel
                  </ReserveButton>
                )}
              </div>
            </div>
          )}
          {accountError && <p role="alert" className="text-[12px] leading-[1.5] text-[#ef9b7d]">{accountError}</p>}
        </SettingRow>
      )}

      <li className="empty:hidden">
        <OwnerModeAccountLine />
      </li>
    </SettingsSection>
  );
}
