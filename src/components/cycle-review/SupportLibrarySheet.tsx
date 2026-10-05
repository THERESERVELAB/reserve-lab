"use client";

import { ArrowLeft, Check } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import { AddedTimePrompt } from "@/components/enhancement/command/AddedTimePrompt";
import { ReserveBottomSheet, ReserveButton, ReserveDisclosure, ReserveSegmented, useDirtySnapshot, useReportDirty } from "@/components/ui/reserve";
import { useAthleteDashboardStore } from "@/lib/athlete-store";
import { EVIDENCE_GRADE_DETAIL, EVIDENCE_GRADE_LABEL } from "@/lib/compound-intelligence/evidence";
import { profilesForCompound } from "@/lib/compound-intelligence/risk-profiles";
import { SUPPORT_AREA_LABEL, bestGrade } from "@/lib/compound-intelligence/support-options";
import { SAFETY_LEVEL_LABEL, type LibraryGroup, type LibraryOption } from "@/lib/cycle-review/support-plan";
import { RESERVE, alpha } from "@/lib/design/tokens";

import { LabelCheckPanel } from "./LabelCheckPanel";
import { SAFETY_COLOR, arrowFor, formatDay } from "./support-tokens";

type Filter = "for-you" | "all";

/** A supplement the member just added, and the untimed entry waiting on the one question. */
type JustAdded = { entryId: string; name: string };

/** A supplement that is not in the library, tracked by the member's own name — never graded or checked. */
function AddOwnSupplement({ onDirtyChange }: { onDirtyChange: (dirty: boolean) => void }) {
  const addCustomSupportPlanItem = useAthleteDashboardStore((s) => s.addCustomSupportPlanItem);
  const [name, setName] = useState("");
  const [status, setStatus] = useState<"idle" | "added" | "not-added">("idle");
  const [justAdded, setJustAdded] = useState<JustAdded | null>(null);
  useReportDirty(useDirtySnapshot(name.trim()), onDirtyChange);
  const inputId = useId();
  const statusId = useId();

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const added = addCustomSupportPlanItem(name);
    if (added) {
      setName("");
      setStatus("added");
      /* It is in the log now, but an untimed entry lands on no day — so ask while they're here. */
      setJustAdded(added.entryId ? { entryId: added.entryId, name: added.name } : null);
    } else {
      setStatus("not-added");
    }
  };

  return (
    <div className="flex flex-col gap-2">
    <form onSubmit={submit} className="flex flex-col gap-1.5 rounded-[14px] bg-white/[0.025] px-3.5 py-3">
      <label htmlFor={inputId} className="type-whisper">
        Not in the library? Add your own
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <input
          id={inputId}
          value={name}
          maxLength={80}
          aria-describedby={statusId}
          onChange={(e) => {
            setName(e.target.value);
            setStatus("idle");
          }}
          placeholder="Supplement or product name"
          className="min-h-[44px] min-w-0 flex-1 rounded-[12px] border border-white/[0.08] bg-black/30 px-3 text-[16px] text-[#f2eee6] outline-none placeholder:text-white/25 focus:border-[#6ee7b7]/60 sm:text-[13px]"
        />
        {name.trim() ? (
          <ReserveButton tier="secondary" size="sm" type="submit">
            Add supplement
          </ReserveButton>
        ) : (
          <ReserveButton tier="secondary" size="sm" disabled disabledReason="Type a name first.">
            Add supplement
          </ReserveButton>
        )}
      </div>
      <p id={statusId} role="status" className="text-[11.5px] leading-[1.5] text-white/50">
        {status === "added"
          ? "Added to your support plan. Reserve can't grade it or check its ingredients."
          : status === "not-added"
            ? "It's already in your support plan, or your plan is full."
            : "Reserve tracks it by the name you give, with no evidence grade or ingredient check."}
      </p>
    </form>
    {justAdded && <AddedTimePrompt entryId={justAdded.entryId} name={justAdded.name} onDone={() => setJustAdded(null)} />}
    </div>
  );
}

function Whisper({ children, color }: { children: React.ReactNode; color?: string }) {
  return <p className="type-whisper" style={color ? { color } : undefined}>{children}</p>;
}

/**
 * The supplement library, organized by purpose. Every option says why it is
 * listed, what the evidence shows and does not show, how it relates to the
 * member's own markers, and what a check against their records found. The
 * member adds and removes; nothing is added for them.
 */
export function SupportLibrarySheet({ open, onClose, library }: { open: boolean; onClose: () => void; library: LibraryGroup[] }) {
  const addSupportPlanItem = useAthleteDashboardStore((s) => s.addSupportPlanItem);
  const removeSupportPlanItem = useAthleteDashboardStore((s) => s.removeSupportPlanItem);
  const supportPlan = useAthleteDashboardStore((s) => s.supportPlan);
  const anyPersonalized = library.some((g) => g.options.some((o) => o.personalized));
  const [filter, setFilter] = useState<Filter>(anyPersonalized ? "for-you" : "all");
  const [detailKey, setDetailKey] = useState<string | null>(null);
  const [justAdded, setJustAdded] = useState<JustAdded | null>(null);
  const [labelOpen, setLabelOpen] = useState(false);
  /* The library itself is browsing; the two forms inside it are guarded. */
  const [ownDirty, setOwnDirty] = useState(false);
  const [labelDirty, setLabelDirty] = useState(false);

  const options = useMemo(() => new Map(library.flatMap((g) => g.options).map((o) => [o.option.key, o])), [library]);
  const detail = detailKey ? options.get(detailKey) ?? null : null;
  const topRef = useRef<HTMLDivElement>(null);
  /** The row the member opened — an option can be listed under several purposes. */
  const lastRowId = useRef<string | null>(null);

  /* Open a detail at its top; going back returns to the exact row the member came from. */
  useEffect(() => {
    if (detailKey) {
      topRef.current?.scrollIntoView({ block: "start" });
    } else if (lastRowId.current) {
      document.getElementById(lastRowId.current)?.scrollIntoView({ block: "center" });
    }
  }, [detailKey]);

  const openDetail = (groupKey: string, optionKey: string) => {
    lastRowId.current = `support-option-${groupKey}-${optionKey}`;
    setJustAdded(null);
    setDetailKey(optionKey);
  };

  const close = () => {
    setDetailKey(null);
    setJustAdded(null);
    setLabelOpen(false);
    onClose();
  };

  const remove = (key: string) => {
    const item = supportPlan.find((p) => p.optionKey === key);
    if (item) removeSupportPlanItem(item.id);
  };

  const visible = library
    .map((group) => ({ ...group, options: filter === "all" ? group.options : group.options.filter((o) => o.personalized || o.inPlan) }))
    .filter((group) => filter === "all" || group.options.length > 0);

  return (
    <ReserveBottomSheet open={open} onClose={close} title={labelOpen ? "Check a product label" : detail ? detail.option.title : "Supplement library"} accent={RESERVE.green} dirty={open && (ownDirty || labelDirty)}>
      <div ref={topRef} aria-hidden="true" className="scroll-mt-24" />
      {labelOpen ? (
        <LabelCheckPanel onBack={() => setLabelOpen(false)} onDirtyChange={setLabelDirty} />
      ) : detail ? (
        <OptionDetail
          entry={detail}
          justAdded={justAdded}
          onBack={() => { setJustAdded(null); setDetailKey(null); }}
          onAdd={() => {
            const added = addSupportPlanItem(detail.option.key);
            /* Added, but untimed — so the question comes here, not later. */
            setJustAdded(added?.entryId ? { entryId: added.entryId, name: added.name } : null);
          }}
          onAddedDone={() => setJustAdded(null)}
          onRemove={() => { setJustAdded(null); remove(detail.option.key); }}
        />
      ) : (
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-3">
            <p className="text-[12.5px] leading-[1.55] text-white/65">
              Listed alphabetically within each purpose, never ranked. Options linked to your data say why. Supplements cannot make a cycle risk-free or replace labs and medical care.
            </p>
            <ReserveSegmented<Filter>
              label="Which options to show"
              value={filter}
              onChange={setFilter}
              accent={RESERVE.green}
              segments={[
                { value: "for-you", label: "Linked to your data" },
                { value: "all", label: "All options" },
              ]}
            />
            <AddOwnSupplement onDirtyChange={setOwnDirty} />
            <button
              type="button"
              onClick={() => { setLabelOpen(true); topRef.current?.scrollIntoView({ block: "start" }); }}
              className="flex min-h-[48px] w-full items-center justify-between gap-3 rounded-[14px] bg-white/[0.025] px-3.5 py-3 text-left transition hover:bg-white/[0.045] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#6ee7b7]"
            >
              <span>
                <span className="block text-[13px] font-semibold" style={{ color: RESERVE.ivory }}>Check a product label</span>
                <span className="mt-0.5 block text-[11.5px] leading-[1.45] text-white/50">See what&apos;s inside a product you already use, ingredient by ingredient.</span>
              </span>
              <span className="shrink-0 text-[12px] text-white/40">Open</span>
            </button>
          </div>

          {visible.length === 0 && (
            <p className="text-[13px] text-white/65">Nothing in your records links to an option yet. Switch to All options to browse the full library.</p>
          )}

          {visible.map((group) => (
            <section key={group.key} aria-label={group.label} className="flex flex-col gap-2">
              <Whisper color={alpha(RESERVE.green, 0.85)}>{group.label}</Whisper>
              {group.options.length === 0 && group.notes.map((note) => <p key={note} className="text-[12.5px] leading-[1.5] text-white/55">{note}</p>)}
              <ul className="flex flex-col divide-y divide-white/[0.05]">
                {group.options.map((entry) => (
                  <li key={entry.option.key} id={`support-option-${group.key}-${entry.option.key}`}>
                    <button
                      type="button"
                      onClick={() => openDetail(group.key, entry.option.key)}
                      className="flex min-h-[56px] w-full items-center gap-3 rounded-[12px] px-2 py-2.5 text-left transition hover:bg-white/[0.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#6ee7b7]"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13.5px] font-semibold" style={{ color: RESERVE.ivory }}>{entry.option.title}</span>
                        <span className="mt-0.5 block text-[12px] leading-[1.45] text-white/55">
                          {entry.reasons[0] ?? "Not linked to your data."}
                        </span>
                        <span className="mt-1 block font-mono text-[9px] uppercase tracking-[0.16em] text-white/45">
                          {EVIDENCE_GRADE_LABEL[entry.findings[0]?.grade ?? bestGrade(entry.option)]}
                          {entry.check.level !== "no-known-issue" && (
                            <span style={{ color: SAFETY_COLOR[entry.check.level] }}> · {SAFETY_LEVEL_LABEL[entry.check.level]}</span>
                          )}
                        </span>
                      </span>
                      {entry.inPlan ? (
                        <span className="inline-flex shrink-0 items-center gap-1 text-[12px]" style={{ color: RESERVE.green }}>
                          <Check size={13} aria-hidden="true" /> Added
                        </span>
                      ) : (
                        <span className="shrink-0 text-[12px] text-white/40">View</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
              {group.options.length > 0 && group.notes.map((note) => <p key={note} className="text-[11.5px] leading-[1.5] text-white/45">{note}</p>)}
            </section>
          ))}
        </div>
      )}
    </ReserveBottomSheet>
  );
}

function OptionDetail({
  entry,
  justAdded,
  onBack,
  onAdd,
  onAddedDone,
  onRemove,
}: {
  entry: LibraryOption;
  justAdded: JustAdded | null;
  onBack: () => void;
  onAdd: () => void;
  onAddedDone: () => void;
  onRemove: () => void;
}) {
  const { option, check } = entry;
  const grade = bestGrade(option);
  const interactions = profilesForCompound({ name: option.catalogName }).flatMap((p) => p.interactions);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <ReserveButton tier="quiet" size="sm" icon={ArrowLeft} onClick={onBack}>
          All supplements
        </ReserveButton>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Whisper color={alpha(RESERVE.green, 0.85)}>Strongest evidence · {EVIDENCE_GRADE_LABEL[grade]}</Whisper>
          <p className="mt-1 text-[12px] text-white/50">{EVIDENCE_GRADE_DETAIL[grade]}</p>
          {entry.inLog && <p className="mt-1 text-[12px] text-white/50">Also in your log.</p>}
        </div>
        {entry.inPlan && (
          <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: RESERVE.green }}>
            <Check size={14} aria-hidden="true" /> Added
          </span>
        )}
      </div>

      <section aria-label="Why you're seeing this">
        <Whisper>Why you&apos;re seeing this</Whisper>
        {entry.allReasons.length > 0 ? (
          <ul className="mt-1.5 flex flex-col gap-1">
            {entry.allReasons.map((reason) => (
              <li key={reason} className="text-[13px] leading-[1.5] text-white/80">{reason}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-1.5 text-[13px] text-white/60">Not linked to your data — you&apos;re browsing the full library.</p>
        )}
      </section>

      <section aria-label="Potential benefit">
        <Whisper>Potential benefit</Whisper>
        <ul className="mt-1.5 flex flex-col gap-2">
          {option.findings.map((finding) => (
            <li key={finding.area} className="text-[13px] leading-[1.5] text-white/75">
              <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/45">
                {SUPPORT_AREA_LABEL[finding.area]} · {EVIDENCE_GRADE_LABEL[finding.grade]}
              </span>
              <span className="mt-0.5 block">{finding.finding}</span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="What it does not address" className="rounded-[14px] px-3.5 py-3" style={{ background: alpha(RESERVE.amber, 0.06) }}>
        <Whisper color={alpha(RESERVE.amber, 0.9)}>What it does not address</Whisper>
        <p className="mt-1 text-[13px] leading-[1.55]" style={{ color: RESERVE.ivory }}>{option.doesNotAddress}</p>
      </section>

      {entry.labLinks.length > 0 && (
        <section aria-label="Relevant markers">
          <Whisper>Your relevant markers</Whisper>
          <ul className="mt-1.5 flex flex-col gap-1.5">
            {entry.labLinks.map((link) => (
              <li key={link.key} className="flex flex-wrap items-baseline gap-x-2 text-[13px]">
                <span style={{ color: RESERVE.ivory }}>{link.label}</span>
                <span className="tnum font-semibold" style={{ color: RESERVE.ivory }}>
                  {link.value} {arrowFor(link.direction)}
                </span>
                <span className="text-[12px] text-white/45">{formatDay(link.date)} · {link.statusLabel.toLowerCase()}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[12px] leading-[1.5] text-white/50">
            These show what your own labs say. {option.title} is not expected to bring them into range, and later results cannot show that it caused any change.
          </p>
        </section>
      )}

      {entry.labLinks.length === 0 && option.whereYouSeeIt && (
        <section aria-label="Where you would see it">
          <Whisper>Where you would see it</Whisper>
          <p className="mt-1.5 text-[13px] leading-[1.5] text-white/70">{option.whereYouSeeIt}</p>
        </section>
      )}

      <section aria-label="Safety check">
        <Whisper>Check against your records</Whisper>
        <p className="mt-1.5 text-[13.5px] font-semibold" style={{ color: SAFETY_COLOR[check.level] }}>{SAFETY_LEVEL_LABEL[check.level]}</p>
        {check.reasons.length > 0 && (
          <ul className="mt-1.5 flex flex-col gap-1">
            {check.reasons.map((reason) => (
              <li key={reason.text} className="text-[12.5px] leading-[1.5] text-white/75">{reason.text}</li>
            ))}
          </ul>
        )}
        <p className="mt-1.5 text-[11.5px] leading-[1.5] text-white/45">{check.caveats.join(" ")}</p>
      </section>

      {/* The choice comes after the evidence and the check, never before. */}
      {justAdded && <AddedTimePrompt entryId={justAdded.entryId} name={justAdded.name} onDone={onAddedDone} />}
      <div className="flex flex-wrap items-center gap-2">
        {entry.inPlan ? (
          <ReserveButton tier="quiet" onClick={onRemove}>
            Remove from support plan
          </ReserveButton>
        ) : (
          <ReserveButton tier="secondary" onClick={onAdd}>
            Add to my support plan
          </ReserveButton>
        )}
        <span className="text-[11.5px] text-white/40">You can remove it at any time.</span>
      </div>

      <ReserveDisclosure summary="Its own risks, interactions and sources" accent={RESERVE.slate}>
        <div className="flex flex-col gap-3 pb-1">
          {interactions.length > 0 && (
            <ul className="flex flex-col gap-1">
              {interactions.map((line) => (
                <li key={line} className="text-[12px] leading-[1.5] text-white/60">{line}</li>
              ))}
            </ul>
          )}
          <ul className="flex flex-col gap-1">
            {option.sources.map((source) => (
              <li key={source.label} className="text-[11.5px] leading-[1.5] text-white/50">
                {source.url ? (
                  <a href={source.url} target="_blank" rel="noopener noreferrer" className="underline decoration-white/20 underline-offset-2 hover:text-white/75">
                    {source.label}
                  </a>
                ) : (
                  source.label
                )}
              </li>
            ))}
          </ul>
          <p className="font-mono text-[8.5px] uppercase tracking-[0.14em] text-white/30">Awaiting clinician review · Version {option.review.version}</p>
        </div>
      </ReserveDisclosure>
    </div>
  );
}
