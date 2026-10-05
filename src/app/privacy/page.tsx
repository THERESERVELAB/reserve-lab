import type { Metadata } from "next";
import Link from "next/link";

import {
  PRIVACY_POLICY,
  PRIVACY_POLICY_EFFECTIVE,
  PRIVACY_REVIEW_PENDING,
} from "@/lib/legal/privacy-policy";

export const metadata: Metadata = {
  title: "Privacy | Reserve Lab",
  description:
    "What Reserve Lab collects, what never leaves your device, who it is shared with, and how to export or delete it.",
};

function formatEffective(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-[760px] px-5 py-12 sm:py-16">
      <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-[#d5b15f]/85">
        Reserve Lab
      </p>
      <h1 className="mt-3 font-display text-[34px] font-black uppercase leading-[0.98] tracking-[-0.02em] text-[#f2eee6] sm:text-[44px]">
        Privacy
      </h1>
      <p className="mt-3 text-[13px] text-white/55">
        Effective {formatEffective(PRIVACY_POLICY_EFFECTIVE)}
      </p>

      {PRIVACY_REVIEW_PENDING && (
        /* An honest disabled state applies to a document too: this is accurate
           about the product but has not been through counsel, and saying so is
           better than implying a review that has not happened. */
        <p className="mt-6 rounded-xl border border-[#d5b15f]/25 bg-[#d5b15f]/[0.06] px-4 py-3 text-[12.5px] leading-[1.6] text-white/70">
          <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-[#d5b15f]/90">
            Pending legal review
          </span>
          <span className="mt-1 block">
            This describes exactly what Reserve does today and is kept in step with the code. It has
            not yet been reviewed by counsel.
          </span>
        </p>
      )}

      <nav aria-label="Sections" className="mt-8 flex flex-wrap gap-x-4 gap-y-2">
        {PRIVACY_POLICY.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/45 underline-offset-4 hover:text-white/75 hover:underline"
          >
            {s.heading}
          </a>
        ))}
      </nav>

      <div className="mt-10 flex flex-col gap-10">
        {PRIVACY_POLICY.map((section) => (
          <section key={section.id} id={section.id} className="scroll-mt-6">
            <h2 className="font-display text-[20px] font-bold uppercase tracking-[-0.01em] text-[#f2eee6] sm:text-[22px]">
              {section.heading}
            </h2>
            {section.body.map((p, i) => (
              <p key={i} className="mt-3 text-[14px] leading-[1.7] text-white/70">
                {p}
              </p>
            ))}
            {section.points && (
              <ul className="mt-4 flex flex-col gap-2.5">
                {section.points.map((point, i) => (
                  <li
                    key={i}
                    className="border-l border-white/[0.09] pl-4 text-[13.5px] leading-[1.65] text-white/65"
                  >
                    {point}
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>

      <p className="mt-12 border-t border-white/[0.07] pt-6 text-[13px] text-white/50">
        See also the{" "}
        <Link href="/open-source" className="text-[#d5b15f]/90 underline underline-offset-4">
          open-source software
        </Link>{" "}
        Reserve is built with.
      </p>
    </main>
  );
}
