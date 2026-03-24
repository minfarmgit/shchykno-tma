"use client";

import clsx from "clsx";
import Image from "next/image";
import type { CourseDto } from "@/lib/contracts";

function isTelegramLink(url: string): boolean {
  return /^https?:\/\/t\.me\//i.test(url);
}

function openExternalUrl(url: string) {
  const webApp = window.Telegram?.WebApp;

  if (isTelegramLink(url) && webApp?.openTelegramLink) {
    webApp.openTelegramLink(url);
    return;
  }

  if (webApp?.openLink) {
    webApp.openLink(url);
    return;
  }

  window.open(url, "_blank", "noopener,noreferrer");
}

export function CourseCard({
  course,
  buttonLabel,
  buttonKind,
  disabled = false,
}: {
  course: CourseDto;
  buttonLabel: string;
  buttonKind: "buy" | "open";
  disabled?: boolean;
}) {
  const actionUrl = buttonKind === "open" ? course.accessUrl : course.buyUrl;

  return (
    <article className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
      <div className="grid min-w-0 grid-cols-[48px_minmax(0,1fr)] items-center gap-[14px]">
        <div className="relative flex items-center justify-center h-12 w-12 shrink-0 overflow-hidden rounded-[14px] bg-gradient-to-b from-[#FFBCDF] to-[#FF90CA]">
          {course.coverImageUrl ? (
            <Image
              src={course.coverImageUrl}
              alt={course.title}
              width={32}
              height={23}
              sizes="24px"
              className="object-cover size-[32px]"
            />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-[#ffb7e0] to-[#f27fc1]" />
          )}
        </div>
        <div className="min-w-0">
          <h3 className="mb-[3px] text-base leading-[1.15] font-medium tracking-[-0.03em] text-[#111111]">
            {course.title}
          </h3>
          <p className="text-[0.8rem] leading-[1] text-[#7b8088] line-clamp-2 whitespace-pre-wrap">
            {course.subtitle}
          </p>
        </div>
      </div>
      <button
        type="button"
        className={clsx(
          "h-[36px] rounded-full border-none bg-[#050505] px-4 text-[0.88rem] font-extrabold text-white",
          (disabled || !actionUrl) && "bg-[#d3d3d3]",
        )}
        disabled={disabled || !actionUrl}
        onClick={() => {
          if (actionUrl) {
            openExternalUrl(actionUrl);
          }
        }}
      >
        {buttonLabel}
      </button>
    </article>
  );
}
