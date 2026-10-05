"use client";

/* Permission review + editing surface. Used when an athlete accepts a
   coach, and later from "Manage Access". Nothing here is vague: every
   category is explicit, full access shows exactly what it includes, and
   physique-photo access is always its own decision. Rimless: it sits inside
   a sheet or a section, never as a card of its own. */

import { useState } from "react";
import { ShieldCheck } from "lucide-react";

import {
  FULL_ACCESS_DISCLOSURE,
  FULL_ACCESS_PERMISSIONS,
  PERMISSION_CATEGORIES,
  PERMISSION_CATEGORY_LABELS,
  PERMISSION_LEVEL_LABELS,
  PHOTO_ACCESS_LABELS,
  clonePermissions,
} from "@/lib/coaching/permissions";
import type {
  CoachingPermissions,
  PermissionLevel,
  PhotoAccessLevel,
} from "@/lib/coaching/types";
import { CommandButton, MicroLabel, SegmentedControl } from "./ui";

const LEVEL_OPTIONS: Array<{ value: PermissionLevel; label: string }> = [
  { value: "none", label: "None" },
  { value: "view", label: "View" },
  { value: "suggest", label: "Suggest" },
  { value: "manage", label: "Manage" },
];

const PHOTO_OPTIONS: Array<{ value: PhotoAccessLevel; label: string }> = [
  { value: "none", label: "None" },
  { value: "view", label: "View" },
  { value: "annotate", label: "Annotate" },
  { value: "full", label: "Full" },
];

export function PermissionEditor({
  value,
  onChange,
  requested,
}: {
  value: CoachingPermissions;
  onChange: (next: CoachingPermissions) => void;
  /** When reviewing an invitation, the coach's requested levels are shown for context. */
  requested?: CoachingPermissions;
}) {
  const [showFullDisclosure, setShowFullDisclosure] = useState(false);

  const grantFull = () => {
    const next = clonePermissions(FULL_ACCESS_PERMISSIONS);
    // Full access never silently escalates image access beyond the current choice.
    next.physiquePhotos = { ...value.physiquePhotos };
    if (next.physiquePhotos.access === "none") next.physiquePhotos.access = "view";
    onChange(next);
    setShowFullDisclosure(false);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Full access lane */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <ShieldCheck size={16} aria-hidden="true" className="text-[#d5b15f]/75" />
            <div>
              <p className="text-[12px] font-bold uppercase tracking-wide text-[#f2eee6]">Full coaching access</p>
              <p className="text-[11.5px] text-white/55">See exactly what it includes before choosing it.</p>
            </div>
          </div>
          <CommandButton variant="ghost" onClick={() => setShowFullDisclosure((v) => !v)}>
            {showFullDisclosure ? "Hide details" : "What's included"}
          </CommandButton>
        </div>
        {showFullDisclosure && (
          <div className="mt-3 border-l-2 border-[#d5b15f]/30 pl-3.5">
            <MicroLabel className="mb-2">Full coaching access includes</MicroLabel>
            <ul className="grid gap-1.5 sm:grid-cols-2">
              {FULL_ACCESS_DISCLOSURE.map((item) => (
                <li key={item} className="flex items-start gap-2 text-[12px] leading-[1.45] text-white/65">
                  <span aria-hidden="true" className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-[#d5b15f]/60" />
                  {item}
                </li>
              ))}
            </ul>
            <CommandButton className="mt-3 w-full" onClick={grantFull}>
              Choose full coaching access
            </CommandButton>
          </div>
        )}
      </div>

      {/* Categories, as rows */}
      <ul aria-label="Access by category" className="flex flex-col [&>li+li]:border-t [&>li+li]:border-white/[0.05]">
        {PERMISSION_CATEGORIES.map((category) => (
          <li key={category} className="flex flex-col gap-2 py-2.5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[12.5px] font-semibold text-white/80">{PERMISSION_CATEGORY_LABELS[category]}</p>
              <p className="text-[11px] text-white/50">
                {requested
                  ? `Coach asked for: ${PERMISSION_LEVEL_LABELS[requested[category]]}`
                  : PERMISSION_LEVEL_LABELS[value[category]]}
              </p>
            </div>
            <SegmentedControl
              size="xs"
              label={`${PERMISSION_CATEGORY_LABELS[category]} access`}
              options={LEVEL_OPTIONS}
              value={value[category]}
              onChange={(level) => onChange({ ...clonePermissions(value), [category]: level })}
            />
          </li>
        ))}
      </ul>

      {/* Physique image access — always an explicit sub-permission */}
      <div className="border-t border-white/[0.06] pt-3">
        <MicroLabel tone="champagne" className="mb-1">Physique image access</MicroLabel>
        <p className="mb-3 text-[12px] leading-[1.5] text-white/60">
          A separate decision: it is never part of full access.
          {requested && ` Coach asked for: ${PHOTO_ACCESS_LABELS[requested.physiquePhotos.access]}.`}
        </p>
        <SegmentedControl
          label="Physique image access"
          options={PHOTO_OPTIONS}
          value={value.physiquePhotos.access}
          onChange={(access) =>
            onChange({
              ...clonePermissions(value),
              physiquePhotos: {
                access,
                mayRequestUploads: access === "none" ? false : value.physiquePhotos.mayRequestUploads,
                mayDownloadOriginals: access === "full" ? value.physiquePhotos.mayDownloadOriginals : false,
              },
            })
          }
        />
        {value.physiquePhotos.access !== "none" && (
          <div className="mt-3 flex flex-col gap-1">
            <CheckRow
              label="Coach may request new photo uploads"
              checked={value.physiquePhotos.mayRequestUploads}
              onChange={(checked) =>
                onChange({
                  ...clonePermissions(value),
                  physiquePhotos: { ...value.physiquePhotos, mayRequestUploads: checked },
                })
              }
            />
            {value.physiquePhotos.access === "full" && (
              <CheckRow
                label="Coach may download original images"
                checked={value.physiquePhotos.mayDownloadOriginals}
                onChange={(checked) =>
                  onChange({
                    ...clonePermissions(value),
                    physiquePhotos: { ...value.physiquePhotos, mayDownloadOriginals: checked },
                  })
                }
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function CheckRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex min-h-[44px] items-center gap-2.5 text-left"
    >
      <span
        aria-hidden="true"
        className={`flex h-4 w-4 items-center justify-center rounded border transition-colors ${
          checked ? "border-[#d5b15f]/60 bg-[#d5b15f]/20" : "border-white/25"
        }`}
      >
        {checked && <span className="h-1.5 w-1.5 rounded-sm bg-[#d5b15f]" />}
      </span>
      <span className="text-[12.5px] text-white/70">{label}</span>
    </button>
  );
}
