import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database/types";

export const PRIVATE_STORAGE_BUCKETS = [
  "progress-photos",
  "body-scans",
  "bloodwork-uploads",
  "avatars",
] as const;

export type PrivateStorageManifestItem = {
  bucket: (typeof PRIVATE_STORAGE_BUCKETS)[number];
  path: string;
  downloadUrl: string | null;
};

async function listPaths(
  admin: SupabaseClient<Database>,
  bucket: (typeof PRIVATE_STORAGE_BUCKETS)[number],
  prefix: string,
): Promise<string[]> {
  const paths: string[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await admin.storage.from(bucket).list(prefix, {
      limit: 1000,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) throw error;

    for (const item of data ?? []) {
      const path = `${prefix}/${item.name}`;
      if (item.id === null) paths.push(...(await listPaths(admin, bucket, path)));
      else paths.push(path);
    }

    if (!data || data.length < 1000) break;
    offset += data.length;
  }

  return paths;
}

export async function buildPrivateStorageManifest(
  admin: SupabaseClient<Database>,
  userId: string,
): Promise<PrivateStorageManifestItem[]> {
  const manifest: PrivateStorageManifestItem[] = [];

  for (const bucket of PRIVATE_STORAGE_BUCKETS) {
    const paths = await listPaths(admin, bucket, userId);
    if (paths.length === 0) continue;
    for (let index = 0; index < paths.length; index += 100) {
      const batch = paths.slice(index, index + 100);
      const { data, error } = await admin.storage.from(bucket).createSignedUrls(batch, 15 * 60);
      if (error) throw error;

      for (const [batchIndex, signed] of (data ?? []).entries()) {
        manifest.push({
          bucket,
          path: signed.path ?? batch[batchIndex],
          downloadUrl: signed.signedUrl ?? null,
        });
      }
    }
  }

  return manifest;
}

export async function removePrivateStorageForUser(
  admin: SupabaseClient<Database>,
  userId: string,
): Promise<void> {
  for (const bucket of PRIVATE_STORAGE_BUCKETS) {
    const paths = await listPaths(admin, bucket, userId);
    for (let index = 0; index < paths.length; index += 100) {
      const batch = paths.slice(index, index + 100);
      const { error } = await admin.storage.from(bucket).remove(batch);
      if (error) throw error;
    }
  }
}
