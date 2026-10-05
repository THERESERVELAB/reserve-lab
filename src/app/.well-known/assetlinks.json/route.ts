import { androidAssetLinks } from "@/lib/mobile/app-links";

/* A fingerprint that does not match the signing key marks the domain as
   failing verification, so an unconfigured build serves 404 instead. */
export const dynamic = "force-dynamic";

export function GET() {
  const statements = androidAssetLinks();
  if (!statements) {
    return new Response(null, { status: 404 });
  }
  return new Response(JSON.stringify(statements, null, 2), {
    status: 200,
    headers: {
      "content-type": "application/json",
      "cache-control": "public, max-age=300",
    },
  });
}
