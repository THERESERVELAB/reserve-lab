import type { Metadata } from "next";

import { AppShell } from "@/components/AppShell";
import { ViewRouter } from "@/components/ViewRouter";

export const metadata: Metadata = {
  title: "Command Center | Reserve Lab",
  description:
    "Premium physique transformation platform. Training, nutrition, recovery, and physique intelligence.",
};

export default function DashboardPage() {
  return (
    <AppShell>
      <ViewRouter />
    </AppShell>
  );
}
