import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { authBootstrapRequestSchema } from "@/lib/schemas/auth";
import {
  communityMessageCreateSchema,
  communityMessagesQuerySchema,
} from "@/lib/schemas/community";

const UUID = "11111111-1111-4111-8111-111111111111";

describe("real-data request boundaries", () => {
  it("never accepts subscription tier from profile bootstrap", () => {
    const parsed = authBootstrapRequestSchema.parse({ userId: UUID, tier: "elite" });
    expect(parsed).toEqual({ userId: UUID });
    expect("tier" in parsed).toBe(false);
  });

  it("never accepts message ownership from the request body", () => {
    const parsed = communityMessageCreateSchema.parse({
      channelId: UUID,
      userId: UUID,
      body: "Member supplied content",
    });
    expect("userId" in parsed).toBe(false);
  });

  it("requires one explicit community channel selector", () => {
    expect(communityMessagesQuerySchema.safeParse({}).success).toBe(false);
    expect(
      communityMessagesQuerySchema.safeParse({ channelId: UUID, channelSlug: "private-room" }).success,
    ).toBe(false);
    expect(communityMessagesQuerySchema.safeParse({ channelId: UUID }).success).toBe(true);
  });
});

describe("real-data migration boundary", () => {
  const migration = readFileSync(
    join(process.cwd(), "supabase", "migrations", "0006_real_data_foundations.sql"),
    "utf8",
  );

  it("creates private buckets and owner-folder object policies", () => {
    expect(migration).toContain("('progress-photos', 'progress-photos', false");
    expect(migration).toContain("reserve_private_files_select_own");
    expect(migration).toContain("(storage.foldername(name))[1] = auth.uid()::text");
  });

  it("replaces broad community message reads with channel access checks", () => {
    expect(migration).toContain('drop policy if exists "Authenticated users can read messages"');
    expect(migration).toContain("community_messages_read_allowed");
    expect(migration).toContain("reserve_can_access_community_channel(channel_id)");
  });

  it("defines canonical athlete and coach-client ownership", () => {
    expect(migration).toContain("create table if not exists public.athlete_profiles");
    expect(migration).toContain("create table if not exists public.coach_client_relationships");
    expect(migration).toContain("approved_by_athlete_at");
  });
});
