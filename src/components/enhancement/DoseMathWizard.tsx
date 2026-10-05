"use client";

import { motion } from "framer-motion";
import { Calculator, Check, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";

import {
  calculateDose, FORM_LABELS, MODE_LABELS, MODES_FOR_FORM, SYRINGE_PRESETS,
  type AmountUnit, type DoseCalculationMode, type DoseFormType, type DoseMathInput, type DoseMathResult,
} from "@/lib/enhancement/dose-math";

const GOLD = "#d5b15f";
const GOLD_BRIGHT = "#e8c87a";
const STEEL = "#5fb7d5";
const ORANGE = "#ef7d55";

const FORM_OPTIONS: DoseFormType[] = ["injectable_vial", "injectable_ml_marked", "tablet", "capsule", "liquid_oral", "manual"];

function num(v: string): number | undefined {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : undefined;
}

function Field({ label, value, onChange, placeholder, suffix }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; suffix?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[12px] leading-tight text-white/55">{label}</span>
      <div className="flex items-center gap-1.5">
        <input value={value} onChange={(e) => onChange(e.target.value)} inputMode="decimal" placeholder={placeholder}
          className="min-h-[44px] w-full rounded-xl border border-white/[0.1] bg-white/[0.03] px-3 py-2 text-[15px] tabular-nums text-white/90 outline-none transition-colors duration-200 focus:border-white/30 focus-visible:ring-2 focus-visible:ring-white/20" />
        {suffix && <span className="shrink-0 text-[12px] text-white/45">{suffix}</span>}
      </div>
    </label>
  );
}

function UnitToggle({ value, onChange }: { value: AmountUnit; onChange: (u: AmountUnit) => void }) {
  return (
    <div className="flex gap-1">
      {(["mg", "mcg", "iu"] as AmountUnit[]).map((u) => (
        <button key={u} type="button" onClick={() => onChange(u)} aria-pressed={value === u}
          className="min-h-[36px] rounded-lg border px-2.5 py-1 text-[12px] transition-colors duration-200 hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
          style={value === u ? { borderColor: `${GOLD}45`, background: `${GOLD}12`, color: GOLD } : { borderColor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.45)" }}>
          {u === "iu" ? "IU" : u}
        </button>
      ))}
    </div>
  );
}

export function DoseMathWizard({ onUseAmount, compact = false }: {
  onUseAmount?: (result: DoseMathResult, input: DoseMathInput) => void;
  compact?: boolean;
}) {
  const [formType, setFormType] = useState<DoseFormType>("injectable_vial");
  const [mode, setMode] = useState<DoseCalculationMode>("units_to_amount");

  // shared numeric inputs (as strings for controlled fields)
  const [vialTotal, setVialTotal] = useState("10");
  const [vialUnit, setVialUnit] = useState<AmountUnit>("mg");
  const [reconMl, setReconMl] = useState("2");
  const [syringe, setSyringe] = useState("100");
  const [units, setUnits] = useState("10");
  const [targetAmount, setTargetAmount] = useState("1");
  const [concMgMl, setConcMgMl] = useState("200");
  const [ml, setMl] = useState("0.5");
  const [perUnit, setPerUnit] = useState("10");
  const [perUnitUnit, setPerUnitUnit] = useState<AmountUnit>("mg");
  const [qty, setQty] = useState("1");

  const modes = MODES_FOR_FORM[formType];

  function pickForm(f: DoseFormType) {
    setFormType(f);
    setMode(MODES_FOR_FORM[f][0]);
  }

  const input: DoseMathInput = useMemo(() => ({
    formType, mode,
    vialTotalAmount: num(vialTotal), vialTotalUnit: vialUnit, reconstitutionVolumeMl: num(reconMl),
    syringeUnitsPerMl: num(syringe), plannedUnitsPerLog: num(units),
    targetAmountPerLog: num(targetAmount), targetAmountUnit: vialUnit,
    concentrationMgPerMl: num(concMgMl), plannedMlPerLog: num(ml),
    amountPerUnit: num(perUnit), amountPerUnitUnit: perUnitUnit, quantityPerLog: num(qty),
  }), [formType, mode, vialTotal, vialUnit, reconMl, syringe, units, targetAmount, concMgMl, ml, perUnit, perUnitUnit, qty]);

  const result = useMemo(() => calculateDose(input), [input]);

  return (
    <div className="@container relative overflow-hidden rounded-2xl border border-white/[0.08]"
      style={{ background: "linear-gradient(168deg, rgba(16,18,24,0.92) 0%, rgba(9,10,15,0.96) 100%)" }}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${GOLD}45, transparent)` }} />
      <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-3">
        <Calculator size={13} style={{ color: `${GOLD}c0` }} />
        <p className="text-[14px] font-semibold tracking-[0.01em]" style={{ color: GOLD_BRIGHT }}>Dose Math</p>
        <span className="ml-auto text-[12px] text-white/40">Arithmetic only</span>
      </div>

      <div className="grid gap-4 p-4 @[44rem]:grid-cols-[1fr_280px]">
        {/* LEFT — inputs */}
        <div className="flex flex-col gap-4">
          {/* Step 1 — form */}
          <div>
            <p className="mb-2 text-[12.5px] text-white/55">What you are tracking</p>
            <div className="flex flex-wrap gap-1.5">
              {FORM_OPTIONS.map((f) => (
                <button key={f} type="button" onClick={() => pickForm(f)} aria-pressed={formType === f}
                  className="min-h-[40px] rounded-xl border px-3 py-1.5 text-[12.5px] transition-colors duration-200 hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
                  style={formType === f ? { borderColor: `${GOLD}45`, background: `${GOLD}12`, color: GOLD } : { borderColor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.45)" }}>
                  {FORM_LABELS[f]}
                </button>
              ))}
            </div>
          </div>

          {/* Mode toggle */}
          {modes.length > 1 && (
            <div>
              <p className="mb-2 text-[12.5px] text-white/55">Which way to work it out</p>
              <div className="flex gap-1.5">
                {modes.map((m) => (
                  <button key={m} type="button" onClick={() => setMode(m)} aria-pressed={mode === m}
                    className="min-h-[40px] rounded-xl border px-3 py-1.5 text-[12.5px] transition-colors duration-200 hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
                    style={mode === m ? { borderColor: `${STEEL}45`, background: `${STEEL}12`, color: STEEL } : { borderColor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.45)" }}>
                    {MODE_LABELS[m]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2/3 — only the fields this form needs */}
          <div className="grid grid-cols-1 gap-3 @[26rem]:grid-cols-2">
            {(formType === "injectable_vial") && (
              <>
                <div className="flex items-end justify-between gap-3 @[26rem]:col-span-2">
                  <div className="flex-1"><Field label="Vial total amount" value={vialTotal} onChange={setVialTotal} /></div>
                  <UnitToggle value={vialUnit} onChange={setVialUnit} />
                </div>
                <Field label="Reconstitution (mL)" value={reconMl} onChange={setReconMl} suffix="mL" />
                <label className="flex flex-col gap-1">
                  <span className="text-[12px] leading-tight text-white/55">Syringe</span>
                  <div className="flex gap-1">
                    {SYRINGE_PRESETS.map((p) => (
                      <button key={p.label} type="button" onClick={() => setSyringe(String(p.unitsPerMl))} aria-pressed={Number(syringe) === p.unitsPerMl}
                        className="min-h-[40px] rounded-lg border px-2.5 py-1.5 text-[12px] transition-colors duration-200 hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
                        style={Number(syringe) === p.unitsPerMl ? { borderColor: `${GOLD}45`, background: `${GOLD}12`, color: GOLD } : { borderColor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.45)" }}>
                        {p.label}
                      </button>
                    ))}
                  </div>
                </label>
                {mode === "units_to_amount"
                  ? <Field label="Units per log" value={units} onChange={setUnits} suffix="units" />
                  : <Field label={`Target ${vialUnit} per log`} value={targetAmount} onChange={setTargetAmount} suffix={vialUnit} />}
              </>
            )}

            {(formType === "injectable_ml_marked") && (
              <>
                <Field label="Concentration" value={concMgMl} onChange={setConcMgMl} suffix="mg/mL" />
                {mode === "ml_to_amount"
                  ? <Field label="mL per log" value={ml} onChange={setMl} suffix="mL" />
                  : <Field label="Target mg per log" value={targetAmount} onChange={setTargetAmount} suffix="mg" />}
              </>
            )}

            {(formType === "tablet" || formType === "capsule") && (
              <>
                <div className="flex items-end justify-between gap-3">
                  <div className="flex-1"><Field label={`Amount per ${formType}`} value={perUnit} onChange={setPerUnit} /></div>
                  <UnitToggle value={perUnitUnit} onChange={setPerUnitUnit} />
                </div>
                <Field label="Quantity per log" value={qty} onChange={setQty} suffix={formType + "s"} />
              </>
            )}

            {formType === "liquid_oral" && (
              <>
                <Field label="Concentration" value={concMgMl} onChange={setConcMgMl} suffix="mg/mL" />
                <Field label="mL per log" value={ml} onChange={setMl} suffix="mL" />
              </>
            )}

            {formType === "manual" && (
              <p className="py-2 text-[12.5px] leading-[1.5] text-white/45 @[26rem]:col-span-2">Manual tracking — no calculation. Log the amount as entered.</p>
            )}
          </div>
        </div>

        {/* RIGHT — live preview */}
        {/* Separated by a hairline, not a box: a panel inside the wizard's own panel is a card in a card. */}
        <div className="flex flex-col border-t border-white/[0.07] pt-4 @[44rem]:border-l @[44rem]:border-t-0 @[44rem]:pl-4 @[44rem]:pt-0">
          <p className="text-[12.5px] text-white/55">The answer</p>
          {/* The answer updates in place. Keying an exit animation to the number
              itself re-mounted this block on every keystroke, and with
              mode="wait" each fade had to finish before the next could start, so
              typing a value made the result stutter and blank out. Numerals are
              tabular: digits change without the line moving. */}
          <motion.div
            key={result.ok ? "ok" : "error"}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            aria-live="polite"
          >
            {result.ok ? (
              <>
                <p className="font-display tnum mt-2 text-[26px] font-extrabold leading-tight" style={{ color: GOLD_BRIGHT }}>{result.primaryLine}</p>
                <div className="mt-2 flex flex-col gap-1">
                  {result.detail.map((d) => (
                    <p key={d} className="tnum text-[12px] leading-[1.5] text-white/50">{d}</p>
                  ))}
                </div>
              </>
            ) : (
              <p className="mt-2 flex items-start gap-1.5 text-[12.5px] leading-[1.5]" style={{ color: ORANGE }}>{result.error}</p>
            )}
          </motion.div>

          {result.ok && result.calculatedAmount !== undefined && onUseAmount && (
            <button type="button" onClick={() => onUseAmount(result, input)}
              className="mt-4 inline-flex min-h-[44px] items-center justify-between rounded-xl border px-3.5 py-2.5 text-[13px] font-medium transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25"
              style={{ borderColor: `${GOLD}50`, background: `linear-gradient(120deg, ${GOLD}22, ${GOLD_BRIGHT}14)`, color: GOLD_BRIGHT }}>
              <span className="inline-flex items-center gap-1.5"><Check size={13} /> Use this amount</span>
              <ChevronRight size={13} />
            </button>
          )}

          <p className="mt-auto pt-3 text-[11.5px] leading-[1.5] text-white/35">{result.safetyNote}</p>
          {!compact && <p className="mt-1 text-[11.5px] leading-[1.5] text-white/30">Confirm entries with a qualified professional.</p>}
        </div>
      </div>
    </div>
  );
}
