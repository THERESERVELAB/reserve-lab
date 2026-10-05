"use client";

import { ArrowLeft, Camera } from "lucide-react";
import { useId, useMemo, useRef, useState } from "react";

import { AddedTimePrompt } from "@/components/enhancement/command/AddedTimePrompt";
import { ReserveButton, useDirtySnapshot, useReportDirty } from "@/components/ui/reserve";
import { useAthleteDashboardStore } from "@/lib/athlete-store";
import { checkLabel, type LabelCheck, type LabelFinding } from "@/lib/compound-intelligence/label-check";
import type { ProfileSource } from "@/lib/compound-intelligence/risk-profiles";
import { CATALOG_INGREDIENTS, supportOptionByKey, type NutrientKey } from "@/lib/compound-intelligence/support-options";
import { RESERVE, alpha } from "@/lib/design/tokens";
import { HEIC_MESSAGE, classifyFile } from "@/lib/labs/intake";

/**
 * LABEL CHECK — the member brings a product they already use and Reserve reads
 * what its label lists. The label text is read on the device and never stored;
 * only the product name is kept, and only if the member adds it to their plan.
 */

const inputCls =
  "w-full rounded-[12px] border border-white/[0.08] bg-black/30 px-3 text-[16px] text-[#f2eee6] outline-none placeholder:text-white/25 focus:border-[#6ee7b7]/60 sm:text-[13px]";

function Sources({ sources }: { sources: ProfileSource[] }) {
  return (
    <p className="mt-1 text-[10.5px] leading-[1.5] text-white/35">
      {sources.map((src, i) => (
        <span key={src.label}>
          {i > 0 && " · "}
          {src.url ? (
            <a href={src.url} target="_blank" rel="noreferrer" className="underline decoration-white/20 underline-offset-2 hover:text-white/60">{src.label}</a>
          ) : (
            src.label
          )}
        </span>
      ))}
    </p>
  );
}

function FindingList({ title, findings, color }: { title: string; findings: LabelFinding[]; color: string }) {
  if (findings.length === 0) return null;
  return (
    <section aria-label={title} className="flex flex-col gap-2">
      <p className="type-whisper" style={{ color }}>{title}</p>
      <ul className="flex flex-col gap-2.5">
        {findings.map((finding) => (
          <li key={finding.key} className="rounded-[12px] px-3 py-2.5" style={{ background: alpha(color, 0.07) }}>
            <p className="text-[13px] font-semibold" style={{ color: RESERVE.ivory }}>{finding.label}</p>
            {finding.notes.map((note) => (
              <p key={note} className="mt-1 text-[12.5px] leading-[1.5] text-white/70">{note}</p>
            ))}
            <Sources sources={finding.sources} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function Results({ check }: { check: LabelCheck }) {
  const addCustomSupportPlanItem = useAthleteDashboardStore((s) => s.addCustomSupportPlanItem);
  const [added, setAdded] = useState<"idle" | "added" | "not-added">("idle");
  const [justAdded, setJustAdded] = useState<{ entryId: string; name: string } | null>(null);
  const addingUp = check.nutrients.filter((n) => n.alsoIn.length > 0);
  const nothingKnown = check.flagged.length + check.hazards.length + check.labNotes.length + check.library.length === 0;

  return (
    <div className="flex flex-col gap-5" data-label-check="results">
      <div>
        <p className="type-whisper">What the label lists</p>
        <p className="mt-1 text-[16px] font-semibold" style={{ color: RESERVE.ivory }}>{check.productName || "This product"}</p>
        <p className="mt-0.5 text-[12px] text-white/50">{check.ingredients.length} {check.ingredients.length === 1 ? "ingredient" : "ingredients"} read</p>
      </div>

      <FindingList title="The FDA has warned about" findings={check.flagged} color={RESERVE.red} />
      <FindingList title="Known hazards in these ingredients" findings={check.hazards} color={RESERVE.amber} />
      <FindingList title="Changes lab results" findings={check.labNotes} color={RESERVE.steel} />
      <FindingList
        title="About this label"
        findings={[check.proprietaryBlend, check.claim].filter((f): f is LabelFinding => Boolean(f))}
        color={RESERVE.amber}
      />

      {addingUp.length > 0 && (
        <section aria-label="Adds up with your plan" className="flex flex-col gap-1.5">
          <p className="type-whisper" style={{ color: RESERVE.amber }}>Adds up with your plan</p>
          {addingUp.map((n) => (
            <p key={n.nutrient} className="text-[12.5px] leading-[1.5] text-white/70">
              <span className="font-semibold" style={{ color: RESERVE.ivory }}>{n.label}</span> is also in {n.alsoIn.join(", ")}. Amounts from several products add together.
            </p>
          ))}
        </section>
      )}

      {check.library.length > 0 && (
        <section aria-label="In Reserve's library" className="flex flex-col gap-1.5">
          <p className="type-whisper" style={{ color: RESERVE.green }}>In Reserve&apos;s library</p>
          <ul className="flex flex-col gap-1">
            {check.library.map((m) => (
              <li key={m.optionKey} className="flex items-baseline justify-between gap-3 text-[12.5px]">
                <span style={{ color: RESERVE.ivory }}>{m.title}</span>
                <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/50">{m.gradeLabel}</span>
              </li>
            ))}
          </ul>
          <p className="text-[11px] leading-[1.5] text-white/40">Evidence grades are for the ingredient on its own, at amounts studied in trials — not for this product.</p>
        </section>
      )}

      <section aria-label="Independent testing" className="flex flex-col gap-1.5">
        <p className="type-whisper">Independent testing</p>
        {check.certifications.length > 0 ? (
          <>
            <p className="text-[12.5px] leading-[1.5] text-white/70">
              The label shows {check.certifications.map((c) => c.label).join(" and ")}. These programs test a product for what it contains and for substances banned in sport.
            </p>
            <Sources sources={check.certifications.map((c) => c.source)} />
          </>
        ) : (
          check.noCertification && (
            <>
              <p className="text-[12.5px] leading-[1.5] text-white/70">{check.noCertification.notes[0]}</p>
              <Sources sources={check.noCertification.sources} />
            </>
          )
        )}
      </section>

      {check.unreviewed.length > 0 && (
        <section aria-label="Not reviewed by Reserve" className="flex flex-col gap-1.5">
          <p className="type-whisper">Not reviewed by Reserve</p>
          <p className="text-[12.5px] leading-[1.5] text-white/60">{check.unreviewed.join(", ")}</p>
          <p className="text-[11px] leading-[1.5] text-white/40">Reserve has no cited review for these, which is not the same as knowing they are fine. A pharmacist can check them against your medicines.</p>
        </section>
      )}

      {nothingKnown && check.ingredients.length > 0 && (
        <p className="text-[12.5px] leading-[1.5] text-white/60">Nothing on this label matched Reserve&apos;s reviewed list. Check that the ingredients read correctly.</p>
      )}

      <div className="rounded-[12px] bg-white/[0.03] px-3 py-2.5">
        <p className="text-[12.5px] font-semibold" style={{ color: RESERVE.ivory }}>{check.standing.label}</p>
        <p className="mt-1 text-[12px] leading-[1.5] text-white/60">{check.standing.notes[0]}</p>
        <Sources sources={check.standing.sources} />
      </div>

      <p className="text-[11.5px] leading-[1.5] text-white/45">
        Reserve reads what the label lists. It does not judge the product or suggest using, buying or stopping it. Questions about a product can go to a pharmacist, a telehealth visit or a clinician.
      </p>

      {check.productName && (
        <div className="flex flex-col gap-1.5">
          {added === "added" ? (
            <p role="status" className="text-[12.5px]" style={{ color: RESERVE.green }}>Added to your support plan by name. The label itself is not saved.</p>
          ) : (
            <ReserveButton
              tier="secondary"
              size="sm"
              onClick={() => {
                const result = addCustomSupportPlanItem(check.productName);
                setAdded(result ? "added" : "not-added");
                /* In the log, with no time — the question that puts it in a day comes now. */
                setJustAdded(result?.entryId ? { entryId: result.entryId, name: result.name } : null);
              }}
            >
              I use this — add it to my support plan
            </ReserveButton>
          )}
          {added === "not-added" && <p role="status" className="text-[11.5px] text-white/50">It&apos;s already in your support plan, or your plan is full.</p>}
          {justAdded && <AddedTimePrompt entryId={justAdded.entryId} name={justAdded.name} onDone={() => setJustAdded(null)} />}
        </div>
      )}
    </div>
  );
}

/** `onDirtyChange`: told whether a product name or label text is entered, for the sheet's close guard. */
export function LabelCheckPanel({ onBack, onDirtyChange }: { onBack: () => void; onDirtyChange?: (dirty: boolean) => void }) {
  const supportPlan = useAthleteDashboardStore((s) => s.supportPlan);
  const [productName, setProductName] = useState("");
  const [labelText, setLabelText] = useState("");
  useReportDirty(useDirtySnapshot({ productName, labelText }), onDirtyChange);
  const [check, setCheck] = useState<LabelCheck | null>(null);
  const [reading, setReading] = useState<{ fraction: number } | null>(null);
  const [photoMessage, setPhotoMessage] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const nameId = useId();
  const textId = useId();

  /* Nutrients already coming from the plan, by the names the member sees. */
  const planNutrients = useMemo(() => {
    const out: Partial<Record<NutrientKey, string[]>> = {};
    for (const item of supportPlan ?? []) {
      const option = supportOptionByKey(item.optionKey);
      if (!option) continue;
      for (const ingredient of CATALOG_INGREDIENTS[option.catalogName] ?? []) {
        out[ingredient.nutrient] = [...new Set([...(out[ingredient.nutrient] ?? []), option.title])];
      }
    }
    return out;
  }, [supportPlan]);

  const run = () => setCheck(checkLabel({ productName, labelText, planNutrients }));

  const readPhoto = async (files: FileList | null) => {
    const list = [...(files ?? [])];
    if (list.length === 0) return;
    const images = list.filter((file) => classifyFile(file) === "image");
    if (images.length === 0) {
      setPhotoMessage(list.some((file) => classifyFile(file) === "heic") ? HEIC_MESSAGE : "Add a JPEG, PNG or WebP photo of the label.");
      return;
    }
    setPhotoMessage(null);
    setReading({ fraction: 0 });
    abort.current = new AbortController();
    try {
      const { readImagesOnDevice } = await import("@/lib/labs/ocr");
      const pages = await readImagesOnDevice(images, { signal: abort.current.signal, onProgress: (p) => setReading({ fraction: (p.page - 1 + p.fraction) / p.pages }) });
      const text = pages.flat().map((line) => line.text).join("\n");
      setLabelText((current) => (current.trim() ? `${current}\n${text}` : text));
      setPhotoMessage("Read on your device. Check the ingredients below against the label, then run the check.");
    } catch (error) {
      setPhotoMessage(error instanceof DOMException && error.name === "AbortError" ? "Reading stopped." : "That photo couldn't be read. Try a sharper, well-lit photo of the ingredient panel, or type the ingredients.");
    } finally {
      setReading(null);
      abort.current = null;
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <button type="button" onClick={check ? () => setCheck(null) : onBack} className="inline-flex min-h-[44px] items-center gap-1.5 self-start text-[12.5px] text-white/60 hover:text-white/85">
        <ArrowLeft size={14} aria-hidden="true" /> {check ? "Edit the label" : "All supplements"}
      </button>

      {check ? (
        <Results check={check} />
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-[12.5px] leading-[1.55] text-white/65">
            Enter a product you already use and its ingredient panel. Reserve reads each ingredient against what it has reviewed, with sources. The label is read on this device and never saved.
          </p>
          <label htmlFor={nameId} className="flex flex-col gap-1.5">
            <span className="type-whisper">Product name</span>
            <input id={nameId} value={productName} maxLength={80} onChange={(e) => setProductName(e.target.value)} placeholder="As printed on the package" className={`min-h-[44px] ${inputCls}`} />
          </label>

          <div className="flex flex-col gap-1.5">
            <label htmlFor={textId} className="type-whisper">Ingredients</label>
            <textarea
              id={textId}
              value={labelText}
              onChange={(e) => setLabelText(e.target.value)}
              rows={7}
              placeholder="Type or paste the Supplement Facts panel and the other ingredients"
              className={`py-2.5 leading-[1.5] ${inputCls}`}
            />
            <label className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 self-start rounded-[12px] border border-white/[0.08] px-3 text-[12.5px] text-white/70 hover:text-white/90">
              <Camera size={14} aria-hidden="true" />
              {reading ? `Reading on your device… ${Math.round(reading.fraction * 100)}%` : "Read a photo of the label"}
              <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" disabled={Boolean(reading)} onChange={(e) => { void readPhoto(e.target.files); e.target.value = ""; }} />
            </label>
            {reading && (
              <button type="button" onClick={() => abort.current?.abort()} className="self-start text-[12px] text-white/50 underline underline-offset-2">
                Stop reading
              </button>
            )}
            {photoMessage && <p role="status" className="text-[11.5px] leading-[1.5] text-white/55">{photoMessage}</p>}
          </div>

          {labelText.trim() ? (
            <ReserveButton tier="primary" size="md" onClick={run}>
              Check this label
            </ReserveButton>
          ) : (
            <ReserveButton tier="primary" size="md" disabled disabledReason="Add the ingredients first.">
              Check this label
            </ReserveButton>
          )}
        </div>
      )}
    </div>
  );
}
