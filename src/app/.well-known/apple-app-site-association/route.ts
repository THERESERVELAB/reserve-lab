import { appleAppSiteAssociation } from "@/lib/mobile/app-links";

/* Apple fetches this through a CDN and caches the answer, so an unconfigured
   build serves 404 rather than a placeholder — see lib/mobile/app-links.ts.
   Must be application/json even though the path has no extension. */
export const dynamic = "force-dynamic";

export function GET() {
  const association = appleAppSiteAssociation();
  if (!association) {
    return new Response(null, { status: 404 });
  }
  return new Response(JSON.stringify(association, null, 2), {
    status: 200,
    headers: {
      "content-type": "application/json",
      /* Apple re-fetches rarely; a short cache keeps a fix from being stuck. */
      "cache-control": "public, max-age=300",
    },
  });
}
