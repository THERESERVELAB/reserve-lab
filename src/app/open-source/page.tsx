import type { Metadata } from "next";
import Link from "next/link";

import {
  LICENSE_SUMMARY,
  LICENSE_TEXT_URL,
  PACKAGE_INVENTORY,
  SHORT_LICENSE_TEXT,
  THIRD_PARTY_NOTICES,
  type NoticeLicense,
  type ThirdPartyNotice,
} from "@/lib/legal/third-party-notices";

export const metadata: Metadata = {
  title: "Open-source notices | Reserve Lab",
  description: "The open-source software Reserve Lab is built with, and the licenses it is used under.",
};

const GROUPS: Array<{ runs: ThirdPartyNotice["runs"]; title: string; intro: string }> = [
  { runs: "device", title: "Runs on your device", intro: "Downloaded to and run in your browser, or inside the Reserve app." },
  { runs: "server", title: "Runs on Reserve’s servers", intro: "Used by Reserve’s servers only." },
];

function NoticeItem({ notice }: { notice: ThirdPartyNotice }) {
  const fullText = LICENSE_TEXT_URL[notice.license];
  return (
    <li className="border-t border-white/[0.07] py-4 first:border-t-0">
      <h3 className="text-[15px] font-semibold text-[#f2eee6]">{notice.name}</h3>
      <p className="mt-1 text-[13px] leading-[1.55] text-white/60">{notice.usedFor}</p>
      <dl className="mt-2 grid gap-x-4 gap-y-1 text-[12.5px] leading-[1.5] sm:grid-cols-[110px_1fr]">
        <dt className="text-white/40">License</dt>
        <dd className="text-white/75">
          {LICENSE_SUMMARY[notice.license]}
          {fullText && (
            <>
              {" · "}
              <a href={fullText} className="text-[#5fb7d5] underline-offset-2 hover:underline">
                Full text
              </a>
            </>
          )}
        </dd>
        <dt className="text-white/40">Copyright</dt>
        <dd className="text-white/75">{notice.copyright}</dd>
        <dt className="text-white/40">Source</dt>
        <dd className="min-w-0 break-words">
          <a href={notice.url} className="text-[#5fb7d5] underline-offset-2 hover:underline" rel="noreferrer">
            {notice.url.replace(/^https:\/\//, "")}
          </a>
        </dd>
      </dl>
    </li>
  );
}

export default function OpenSourceNoticesPage() {
  const shortLicenses = (Object.keys(SHORT_LICENSE_TEXT) as NoticeLicense[]).filter((license) =>
    THIRD_PARTY_NOTICES.some((notice) => notice.license === license),
  );

  return (
    <main className="mx-auto w-full max-w-3xl px-5 pb-16 pt-10 sm:px-8">
      <Link href="/" className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/45 hover:text-white/75">
        ← Back to Reserve Lab
      </Link>
      <h1 className="mt-6 text-[28px] font-bold leading-tight text-[#f2eee6]">Open-source notices</h1>
      <p className="mt-3 max-w-2xl text-[14px] leading-[1.6] text-white/60">
        Reserve Lab is built with the open-source software below, used under the licenses listed. Lab reports and photos are read on your
        device by the software marked “Runs on your device” and are never uploaded.
      </p>

      {GROUPS.map((group) => {
        const notices = THIRD_PARTY_NOTICES.filter((notice) => notice.runs === group.runs);
        if (notices.length === 0) return null;
        return (
          <section key={group.runs} aria-labelledby={`group-${group.runs}`} className="mt-10">
            <h2 id={`group-${group.runs}`} className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#5fb7d5]">
              {group.title}
            </h2>
            <p className="mt-1 text-[12.5px] text-white/45">{group.intro}</p>
            <ul className="mt-3 rounded-2xl border border-white/[0.08] bg-white/[0.02] px-5">
              {notices.map((notice) => (
                <NoticeItem key={notice.name} notice={notice} />
              ))}
            </ul>
          </section>
        );
      })}

      <section aria-labelledby="all-packages" className="mt-10">
        <h2 id="all-packages" className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#5fb7d5]">
          All production packages
        </h2>
        <p className="mt-1 text-[12.5px] leading-[1.55] text-white/45">
          {PACKAGE_INVENTORY.packages.length} packages in Reserve Lab’s production dependency tree, including the projects above. Type declarations
          and test tooling are not included.
        </p>
        {PACKAGE_INVENTORY.exceptions.map((exception) => (
          <p key={exception} className="mt-1 text-[12px] leading-[1.55] text-white/45">
            Server only: {exception}.
          </p>
        ))}
        <details className="mt-3 rounded-xl border border-white/[0.08] bg-white/[0.02] px-5 py-3">
          <summary className="cursor-pointer text-[13px] font-semibold text-[#f2eee6]">Show all {PACKAGE_INVENTORY.packages.length} packages</summary>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-[12px] leading-[1.45]">
              <thead>
                <tr className="text-white/40">
                  <th scope="col" className="py-1.5 pr-3 font-normal">Package</th>
                  <th scope="col" className="py-1.5 pr-3 font-normal">Version</th>
                  <th scope="col" className="py-1.5 pr-3 font-normal">License</th>
                  <th scope="col" className="py-1.5 font-normal">Copyright</th>
                </tr>
              </thead>
              <tbody>
                {PACKAGE_INVENTORY.packages.map((pkg) => (
                  <tr key={`${pkg.name}@${pkg.version}`} className="border-t border-white/[0.06] align-top text-white/70">
                    <td className="py-1.5 pr-3 text-[#f2eee6]">{pkg.name}</td>
                    <td className="py-1.5 pr-3 font-mono text-[11px]">{pkg.version}</td>
                    <td className="py-1.5 pr-3">{pkg.license}</td>
                    <td className="py-1.5 text-white/55">{pkg.copyright ?? "See the package’s license file"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>

      <section aria-labelledby="license-texts" className="mt-10">
        <h2 id="license-texts" className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#5fb7d5]">
          License texts
        </h2>
        <p className="mt-1 text-[12.5px] text-white/45">
          The Apache License 2.0 is available in full at{" "}
          <a href={LICENSE_TEXT_URL["Apache-2.0"]} className="text-[#5fb7d5] underline-offset-2 hover:underline">
            /licenses/Apache-2.0.txt
          </a>
          . The shorter licenses apply with the copyright lines listed above.
        </p>
        {shortLicenses.map((license) => (
          <details key={license} className="mt-3 rounded-xl border border-white/[0.08] bg-white/[0.02] px-5 py-3">
            <summary className="cursor-pointer text-[13px] font-semibold text-[#f2eee6]">{LICENSE_SUMMARY[license]}</summary>
            {SHORT_LICENSE_TEXT[license]!.map((paragraph) => (
              <p key={paragraph.slice(0, 40)} className="mt-2 text-[12px] leading-[1.55] text-white/55">
                {paragraph}
              </p>
            ))}
          </details>
        ))}
      </section>
    </main>
  );
}
