"use client";

import { Check, Repeat, Sparkles } from "lucide-react";

import { ReserveButton, ReserveDisclosure } from "@/components/ui/reserve";
import { formatTime12 } from "@/lib/schedule/engine";
import type { MenuChoice, MenuDay } from "@/lib/nutrition/peak-menu";
import { RESERVE, alpha } from "@/lib/design/tokens";

function matchColor(match: number): string {
  return match >= 85 ? RESERVE.green : match >= 70 ? RESERVE.gold : RESERVE.amber;
}

/**
 * THE WEEK'S MENU — Reserve brings a short list for every meal; the member
 * says what they want to eat. A pick is saved against that day, and a meal
 * they eat daily can be set across the week in one tap.
 */
export function WeekMenu({
  days,
  todayKey,
  picked,
  total,
  onPick,
  onRepeat,
  onClear,
  onSurprise,
}: {
  days: MenuDay[];
  todayKey: string;
  picked: number;
  total: number;
  onPick: (date: string, mealKey: string, plateId: string) => void;
  onRepeat: (mealKey: string, plateId: string) => void;
  onClear: () => void;
  onSurprise: () => void;
}) {
  return (
    <section aria-label="This week's menu" className="flex flex-col gap-3" data-peak-menu>
      <div>
        <p className="type-whisper" style={{ color: alpha(RESERVE.gold, 0.9) }}>This week&apos;s menu · {picked} of {total} chosen by you</p>
        <p className="mt-1 text-[11.5px] leading-[1.5] text-white/50">
          A few plates worth eating for every meal. Pick what you want, or let Reserve fill the week for you — Surprise me spreads the variety and leaves anything you chose yourself alone.
        </p>
      </div>

      <ul className="flex flex-col divide-y divide-white/[0.05]">
        {days.map((day) => (
          <li key={day.date} className="py-1.5" data-peak-menu-day={day.date}>
            <ReserveDisclosure
              summary={`${day.date === todayKey ? "Today" : day.weekday} · ${day.training ? day.sessionName || "Training" : "Rest"}`}
              accent={RESERVE.gold}
            >
              <ul className="flex flex-col gap-3">
                {day.meals.map((meal) => (
                  <li key={meal.key} data-peak-menu-meal={meal.key}>
                    <p className="text-[11px] uppercase tracking-[0.16em] text-white/45">
                      {meal.time ? `${formatTime12(meal.time)} · ` : ""}{meal.label}
                    </p>
                    {meal.choices.length === 0 ? (
                      <p className="mt-1 text-[12px] text-white/45">No other plate fits this meal for your look and food answers.</p>
                    ) : (
                      <ul className="mt-1.5 flex flex-col gap-1.5">
                        {meal.choices.map((choice) => (
                          <li key={choice.id}>
                            <Choice
                              choice={choice}
                              onPick={() => onPick(day.date, meal.key, choice.id)}
                              onRepeat={() => onRepeat(meal.key, choice.id)}
                            />
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            </ReserveDisclosure>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-2">
        <ReserveButton tier="secondary" size="sm" icon={Sparkles} onClick={onSurprise}>
          Surprise me
        </ReserveButton>
        {picked === 0 ? (
          <ReserveButton tier="quiet" size="sm" disabled disabledReason="You have not picked anything this week yet.">
            Let Reserve choose the week
          </ReserveButton>
        ) : (
          <ReserveButton tier="quiet" size="sm" onClick={onClear}>
            Let Reserve choose the week
          </ReserveButton>
        )}
      </div>
    </section>
  );
}

function Choice({ choice, onPick, onRepeat }: { choice: MenuChoice; onPick: () => void; onRepeat: () => void }) {
  return (
    <div
      className="flex items-center gap-2 rounded-[12px] px-3 py-2.5"
      style={{
        background: choice.current ? alpha(RESERVE.gold, 0.08) : "transparent",
        boxShadow: `inset 0 0 0 1px ${choice.current ? alpha(RESERVE.gold, 0.35) : "rgba(255,255,255,0.08)"}`,
      }}
    >
      <button type="button" onClick={onPick} aria-pressed={choice.current} className="flex min-w-0 flex-1 items-center gap-2 text-left">
        {choice.current && <Check size={13} aria-hidden="true" style={{ color: RESERVE.gold }} />}
        <span className="min-w-0">
          <span className="block text-[13px] font-semibold" style={{ color: RESERVE.ivory }}>
            {choice.name}
            {choice.mine && <span className="ml-1.5 text-[10.5px] uppercase tracking-[0.14em]" style={{ color: alpha(RESERVE.green, 0.9) }}>yours</span>}
          </span>
          <span className="block text-[11px] text-white/50">
            {choice.macros.calories} kcal · {choice.macros.proteinG}P {choice.macros.carbsG}C {choice.macros.fatG}F
          </span>
        </span>
      </button>
      <span className="shrink-0 text-[11.5px] font-semibold" style={{ color: matchColor(choice.match) }}>{choice.match}%</span>
      <ReserveButton tier="quiet" size="sm" icon={Repeat} onClick={onRepeat}>
        <span className="sr-only">Have {choice.name} every day this week</span>
      </ReserveButton>
    </div>
  );
}
