import { z } from "zod";

export const authBootstrapRequestSchema = z.object({
  userId: z.string().uuid(),
  email: z.string().email().optional(),
  displayName: z.string().min(1).max(120).optional(),
  persona: z.enum(["beginner", "intermediate", "advanced"]).optional(),
});

export type AuthBootstrapRequest = z.infer<typeof authBootstrapRequestSchema>;
