import { notFound } from "next/navigation";

import { ArchitectureInspector } from "@/components/dev/ArchitectureInspector";

export const metadata = {
  title: "Training Architecture Inspector | Reserve Lab (development)",
  robots: { index: false, follow: false },
};

/**
 * Development-only quality-control surface. It is deliberately NOT reachable
 * from any navigation and returns a 404 in production builds, so it can never
 * become a member-facing page by accident.
 */
export default function TrainingArchitecturePage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <ArchitectureInspector />;
}
