"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { CourseCard } from "@/components/mini-app/course-card";
import { LoadingSection } from "@/components/mini-app/loading-section";
import { StatusNotice } from "@/components/mini-app/status-notice";
import {
  getTelegramContactErrorMessage,
  useRequestTelegramContact,
} from "@/hooks/use-request-telegram-contact";
import { useTelegramBootstrap } from "@/hooks/use-telegram-bootstrap";
import { getTelegramWebApp, setupTelegramWebApp } from "@/lib/telegram-webapp";

function getBootstrapErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "Не удалось загрузить данные пользователя.";
}

export function MiniAppShell() {
  const { data: payload, error, isBootstrapPending, hasBootstrapSource } =
    useTelegramBootstrap();
  const requestTelegramContact = useRequestTelegramContact();
  const phoneRequestStartedRef = useRef(false);
  const hasMounted = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );

  useEffect(() => {
    setupTelegramWebApp(getTelegramWebApp());
  }, []);

  useEffect(() => {
    const webApp = getTelegramWebApp();

    if (
      !payload ||
      payload.user.hasPhoneNumber ||
      phoneRequestStartedRef.current ||
      !webApp?.requestContact
    ) {
      return;
    }

    phoneRequestStartedRef.current = true;
    requestTelegramContact.mutate();
  }, [payload, requestTelegramContact]);

  const ownedCourses = payload?.ownedCourses ?? [];
  const availableCourses = payload?.availableCourses ?? [];
  const hasOwnedCourses = ownedCourses.length > 0;
  const hasAvailableCourses = availableCourses.length > 0;
  const bootstrapErrorMessage = error ? getBootstrapErrorMessage(error) : null;
  const phoneShareErrorMessage = requestTelegramContact.error
    ? getTelegramContactErrorMessage(requestTelegramContact.error)
    : null;
  const showUnavailableNotice = hasMounted && !hasBootstrapSource;
  const unavailableMessage =
    process.env.NODE_ENV === "development"
      ? "В dev-режиме добавьте NEXT_PUBLIC_DEV_TELEGRAM_INIT_DATA в .env и перезапустите next dev, либо откройте приложение внутри Telegram."
      : "Откройте приложение внутри Telegram, чтобы загрузить профиль и курсы.";

  return (
    <main className="min-h-screen bg-white">
      <div className="relative min-h-screen w-full bg-white">
        <section
          className="aspect-[13/12] w-full bg-[url('/header.webp')] bg-cover bg-center bg-no-repeat"
          aria-hidden="true"
        />

        <div className="grid gap-[30px] px-4 pt-[26px] pb-8 sm:px-[18px]">
          {showUnavailableNotice ? (
            <StatusNotice
              title="Mini App недоступен"
              message={unavailableMessage}
              tone="error"
            />
          ) : null}

          {bootstrapErrorMessage ? (
            <StatusNotice
              title="Не удалось загрузить данные"
              message={bootstrapErrorMessage}
              tone="error"
            />
          ) : null}

          {phoneShareErrorMessage ? (
            <StatusNotice
              title="Не удалось получить номер"
              message={phoneShareErrorMessage}
              tone="error"
            />
          ) : null}

          {hasOwnedCourses ? (
            <section className="grid gap-4">
              <h2 className="text-[1.25rem] leading-[1.08] font-bold tracking-[-0.04em] text-[#111111]">
                Ваши курсы
              </h2>
              <div className="grid gap-[18px]">
                {ownedCourses.map((course) => (
                  <CourseCard
                    key={course.id}
                    course={course}
                    buttonKind="open"
                    buttonLabel={course.accessUrl ? "Открыть" : "Скоро"}
                    disabled={!course.accessUrl}
                  />
                ))}
              </div>
            </section>
          ) : null}

          <section className="grid gap-4">
            <h2 className="text-[1.25rem] leading-[1.08] font-bold tracking-[-0.04em] text-[#111111]">
              Все курсы
            </h2>
            {isBootstrapPending ? (
              <LoadingSection />
            ) : hasAvailableCourses ? (
              <div className="grid gap-[18px]">
                {availableCourses.map((course) => (
                  <CourseCard
                    key={course.id}
                    course={course}
                    buttonKind="buy"
                    buttonLabel="Купить"
                  />
                ))}
              </div>
            ) : payload ? (
              <StatusNotice
                title="Каталог пуст"
                message="Опубликованные курсы пока не найдены."
              />
            ) : null}
          </section>
        </div>

        {requestTelegramContact.isPending ? (
          <div
            className="fixed inset-0 z-20 grid place-items-center bg-[rgba(255,255,255,0.72)] backdrop-blur-[4px]"
            aria-hidden="true"
          >
            <div className="grid justify-items-center gap-[14px] rounded-[28px] bg-[rgba(255,255,255,0.92)] px-5 py-[22px] shadow-[0_20px_40px_rgba(17,17,17,0.08)]">
              <span className="h-[34px] w-[34px] animate-spin rounded-full border-[3px] border-solid border-[rgba(241,97,180,0.18)] border-t-[#f061b4]" />
              <p className="max-w-[220px] text-center text-[0.94rem] leading-[1.4] text-[#383838]">
                Подтверждаем номер телефона в Telegram...
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}
