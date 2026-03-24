"use client";

import clsx from "clsx";
import { useEffect, useState } from "react";

const TOAST_LIFETIME_MS = 3600;

export function Toast({
  title,
  message,
  tone = "error",
}: {
  title: string;
  message: string;
  tone?: "error" | "default";
}) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setIsVisible(false);
    }, TOAST_LIFETIME_MS);

    return () => window.clearTimeout(timeoutId);
  }, []);

  if (!isVisible) {
    return null;
  }

  return (
    <section
      className={clsx(
        "pointer-events-auto rounded-2xl border px-4 py-3 shadow-[0_14px_30px_rgba(17,17,17,0.12)] backdrop-blur-sm",
        "transition-all duration-200 ease-out",
        tone === "error"
          ? "border-[rgba(209,74,74,0.14)] bg-[rgba(255,249,248,0.94)]"
          : "border-[rgba(240,97,180,0.14)] bg-[rgba(255,250,251,0.94)]",
      )}
      role="status"
    >
      <h2 className="mb-1 text-[0.95rem] leading-tight font-bold text-[#111111]">{title}</h2>
      <p className="text-[0.82rem] leading-[1.35] text-[#5c5c5c]">{message}</p>
    </section>
  );
}
