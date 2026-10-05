import { z } from "zod";

export const leadCaptureSchema = z.object({
  email: z.string().email(),
  source: z.enum([
    "free-ai-body-assessment",
    "free-training-split-generator",
    "free-bloodwork-upload-preview",
    "free-12-week-physique-projection",
    "free-physique-scan",
    "free-bloodwork-review",
    "training-split-generator",
    "waitlist",
    "referral",
    "affiliate",
  ]),
  referralCode: z.string().max(80).optional(),
  affiliateCode: z.string().max(80).optional(),
  campaign: z.string().max(120).optional(),
  metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).default({}),
});

export const attributionSchema = z.object({
  leadId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  referralCode: z.string().max(80).optional(),
  affiliateCode: z.string().max(80).optional(),
  campaign: z.string().max(120).optional(),
  landingPath: z.string().max(240).optional(),
  metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).default({}),
}).refine((value) => value.referralCode || value.affiliateCode || value.campaign, {
  message: "At least one attribution signal is required.",
});

export type LeadCaptureInput = z.infer<typeof leadCaptureSchema>;
export type AttributionInput = z.infer<typeof attributionSchema>;
