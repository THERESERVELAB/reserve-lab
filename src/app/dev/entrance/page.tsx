import { notFound } from "next/navigation";

import { ReserveEntry } from "@/components/auth/ReserveEntry";

export const metadata = {
  title: "Private Entrance Preview | Reserve Lab (development)",
  robots: { index: false, follow: false },
};

/**
 * Development-only quality-control surface for the Private Entrance.
 *
 * The entrance only renders at `/` when auth resolves to `signed-out`. A local
 * dev server runs with Supabase unconfigured, which AppShell treats as local
 * mode — so `/` shows the dashboard and the entrance is otherwise unreachable
 * without real credentials. This route renders the same component directly so
 * its composition can be inspected and regression-tested.
 *
 * Like the other `/dev` surfaces it is unreachable from navigation and returns
 * a 404 in production builds, so it can never become member-facing.
 *
 * `?google=on` / `?google=off` force the two provider branches; with no
 * parameter the real discovery path runs.
 */
export default async function EntrancePreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ google?: string; apple?: string }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();

  // ?google=on|off and ?apple=on|off, independently, so every combination of
  // the two third-party buttons can be looked at — including Apple alone,
  // which is what an iOS build looks like before Google is configured.
  const { google, apple } = await searchParams;
  const override =
    google || apple
      ? {
          google: google === "on",
          apple: apple === "on",
          email: true,
        }
      : undefined;

  return <ReserveEntry providerOverride={override} />;
}
