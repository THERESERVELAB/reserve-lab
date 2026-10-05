"use client";

import { AlertTriangle, Info, MessageSquare, Phone, Stethoscope } from "lucide-react";

import { RESERVE, alpha } from "@/lib/design/tokens";
import { ESCALATION_LABEL, type EscalationItem, type EscalationLevel } from "@/lib/safety/escalation";

const LEVEL: Record<EscalationLevel, { color: string; icon: typeof Info }> = {
  crisis: { color: RESERVE.red, icon: Phone },
  emergency: { color: RESERVE.red, icon: AlertTriangle },
  "contact-clinician-today": { color: RESERVE.amber, icon: Stethoscope },
  "discuss-with-clinician": { color: RESERVE.steel, icon: Stethoscope },
  note: { color: RESERVE.slate, icon: Info },
};

function ContactLink({ href, label, color, icon: Icon }: { href: string; label: string; color: string; icon: typeof Info }) {
  return (
    <a
      href={href}
      className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[12px] px-4 text-[12.5px] font-bold transition hover:brightness-110"
      style={{ background: color, color: RESERVE.base }}
    >
      <Icon size={14} aria-hidden="true" />
      {label}
    </a>
  );
}

/**
 * The escalation ladder, most urgent first. Emergency and crisis items carry
 * real tap-to-call links — the one place Reserve acts, it acts immediately.
 */
export function EscalationList({ items, label = "Safety alerts" }: { items: EscalationItem[]; label?: string }) {
  if (items.length === 0) return null;
  return (
    <section aria-label={label} className="flex flex-col gap-2">
      {items.map((item) => {
        const { color, icon: Icon } = LEVEL[item.level];
        const urgent = item.level === "crisis" || item.level === "emergency";
        return (
          <div
            key={item.id}
            role={urgent ? "alert" : undefined}
            className="rounded-[14px] px-4 py-3"
            style={{
              border: `1px solid ${alpha(color, urgent ? 0.55 : 0.22)}`,
              background: alpha(color, urgent ? 0.1 : 0.04),
            }}
          >
            <p className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.2em]" style={{ color }}>
              <Icon size={11} aria-hidden="true" />
              {ESCALATION_LABEL[item.level]}
            </p>
            <p className="mt-1 text-[13.5px] font-semibold" style={{ color: RESERVE.ivory }}>
              {item.title}
            </p>
            <p className="mt-1 text-[12.5px] leading-[1.55] text-white/65">{item.body}</p>
            {item.level === "crisis" && (
              <div className="mt-3 flex flex-wrap gap-2">
                <ContactLink href="tel:988" label="Call 988" color={color} icon={Phone} />
                <ContactLink href="sms:988" label="Text 988" color={color} icon={MessageSquare} />
                <ContactLink href="tel:911" label="Call 911" color={color} icon={Phone} />
              </div>
            )}
            {item.level === "emergency" && (
              <div className="mt-3 flex flex-wrap gap-2">
                <ContactLink href="tel:911" label="Call 911" color={color} icon={Phone} />
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
