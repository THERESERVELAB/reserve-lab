/* ════════════════════════════════════════════════════════════════════════
   LAB REPORT INTAKE — which files Reserve can read, and how.

   One lab record comes from one report: a PDF, or up to eight photos of the
   same report. Everything is read on the member's device. Anything Reserve
   cannot read is named plainly, and the member can always type results.
   ════════════════════════════════════════════════════════════════════════ */

export const MAX_FILE_BYTES = 25 * 1024 * 1024;
export const MAX_IMAGES = 8;

export type IntakeKind = "pdf" | "image" | "heic" | "unsupported";

export type IntakeFile = { name: string; type: string; size: number };

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const IMAGE_EXT = /\.(jpe?g|png|webp)$/i;
const HEIC = /\.(heic|heif)$/i;

export function classifyFile(file: IntakeFile): IntakeKind {
  const type = file.type.toLowerCase();
  if (type === "application/pdf" || /\.pdf$/i.test(file.name)) return "pdf";
  if (type === "image/heic" || type === "image/heif" || HEIC.test(file.name)) return "heic";
  if (IMAGE_TYPES.has(type) || IMAGE_EXT.test(file.name)) return "image";
  return "unsupported";
}

export type IntakePlan<F extends IntakeFile> = {
  pdf: F | null;
  images: F[];
  /** Files Reserve will not read, each with a plain reason. */
  rejected: Array<{ name: string; reason: string }>;
};

export const HEIC_MESSAGE = "HEIC photos can't be read in the browser. Save or share the photo as JPEG or PNG, then add it.";

export function planIntake<F extends IntakeFile>(files: F[]): IntakePlan<F> {
  const plan: IntakePlan<F> = { pdf: null, images: [], rejected: [] };
  for (const file of files) {
    const kind = classifyFile(file);
    if (kind === "heic") {
      plan.rejected.push({ name: file.name, reason: HEIC_MESSAGE });
      continue;
    }
    if (kind === "unsupported") {
      plan.rejected.push({ name: file.name, reason: "Reserve reads PDF, JPG, PNG or WebP lab reports." });
      continue;
    }
    if (file.size > MAX_FILE_BYTES) {
      plan.rejected.push({ name: file.name, reason: "This file is larger than 25 MB." });
      continue;
    }
    if (kind === "pdf") {
      if (plan.pdf || plan.images.length) plan.rejected.push({ name: file.name, reason: "Add one PDF, or photos of one report, per lab record." });
      else plan.pdf = file;
      continue;
    }
    if (plan.pdf) {
      plan.rejected.push({ name: file.name, reason: "Add one PDF, or photos of one report, per lab record." });
    } else if (plan.images.length >= MAX_IMAGES) {
      plan.rejected.push({ name: file.name, reason: `Up to ${MAX_IMAGES} photos per lab record.` });
    } else {
      plan.images.push(file);
    }
  }
  return plan;
}
