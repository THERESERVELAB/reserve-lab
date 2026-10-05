import { z } from "zod";

export const communityMessagesQuerySchema = z
  .object({
    channelId: z.string().uuid().optional(),
    channelSlug: z.string().min(2).max(120).optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .refine((query) => Boolean(query.channelId) !== Boolean(query.channelSlug), {
    message: "Provide exactly one channel identifier.",
  });

export const communityMessageCreateSchema = z.object({
  channelId: z.string().uuid(),
  parentId: z.string().uuid().optional(),
  body: z.string().min(1).max(4000),
  checkInType: z.enum(["transformation", "training", "nutrition", "recovery"]).optional(),
  metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).default({}),
});

export type CommunityMessagesQuery = z.infer<typeof communityMessagesQuerySchema>;
export type CommunityMessageCreate = z.infer<typeof communityMessageCreateSchema>;
