"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "@/components/mini-app-shell.module.css";
import type { BootstrapResponse, CourseDto } from "@/lib/contracts";

function getStartParam(): string | null {
  const searchParams = new URLSearchParams(window.location.search);

  return (
    searchParams.get("tgWebAppStartParam") ??
    searchParams.get("startapp") ??
    window.Telegram?.WebApp?.initDataUnsafe?.start_param ??
    window.Telegram?.WebApp?.initDataUnsafe?.startParam ??
    null
  );
}

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

function getBadgeLabel(course: CourseDto) {
  const words = course.title.trim().split(/\s+/).filter(Boolean);

  return words
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 2);
}

function buildHeroBackground(coverImageUrl: string | null) {
  if (!coverImageUrl) {
    return undefined;
  }

  return {
    backgroundImage: `linear-gradient(180deg, rgba(16, 16, 16, 0.12) 0%, rgba(120, 25, 90, 0.54) 100%), url("${coverImageUrl}")`,
  };
}

function getErrorMessage(response: Response, fallback: string) {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return response
      .json()
      .then((payload: unknown) => {
        if (
          payload &&
          typeof payload === "object" &&
          "error" in payload &&
          typeof payload.error === "string"
        ) {
          return payload.error;
        }

        return fallback;
      })
      .catch(() => fallback);
  }

  return response.text().then((body) => body || fallback);
}

function LoadingSection() {
  return (
    <div className={styles.loadingStack} aria-hidden="true">
      <div className={styles.skeleton} />
      <div className={styles.skeleton} />
    </div>
  );
}

function CourseCard({
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
  const buttonClassName = [
    styles.cardButton,
    buttonKind === "open" ? styles.cardButtonDark : "",
    disabled || !actionUrl ? styles.cardButtonDisabled : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <article className={styles.card}>
      <div className={styles.cardTop}>
        <div className={styles.badge}>{getBadgeLabel(course)}</div>
        <div className={styles.textBlock}>
          <h3 className={styles.cardTitle}>{course.title}</h3>
          <p className={styles.cardSubtitle}>{course.subtitle}</p>
        </div>
      </div>
      <button
        type="button"
        className={buttonClassName}
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

export function MiniAppShell() {
  const [payload, setPayload] = useState<BootstrapResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshingProfile, setIsRefreshingProfile] = useState(false);
  const phoneRequestStartedRef = useRef(false);

  useEffect(() => {
    const webApp = window.Telegram?.WebApp;

    webApp?.ready();
    webApp?.expand();
    webApp?.setHeaderColor("#ffffff");
    webApp?.setBackgroundColor("#ffffff");
    webApp?.setBottomBarColor?.("#ffffff");
  }, []);

  const loadBootstrap = async (signal?: AbortSignal): Promise<BootstrapResponse | null> => {
    const webApp = window.Telegram?.WebApp;

    if (!webApp?.initData) {
      return null;
    }

    const response = await fetch("/api/telegram/bootstrap", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        initData: webApp.initData,
        startParam: getStartParam(),
      }),
      cache: "no-store",
      signal,
    });

    if (!response.ok) {
      throw new Error(
        await getErrorMessage(response, "Не удалось загрузить данные пользователя."),
      );
    }

    const nextPayload = (await response.json()) as BootstrapResponse;
    setPayload(nextPayload);
    return nextPayload;
  };

  useEffect(() => {
    const controller = new AbortController();

    queueMicrotask(() => {
      void loadBootstrap(controller.signal)
        .catch((error: unknown) => {
          if (controller.signal.aborted) {
            return;
          }

          console.error("Failed to load bootstrap payload", error);
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setIsLoading(false);
          }
        });
    });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    const webApp = window.Telegram?.WebApp;

    if (
      !payload ||
      payload.user.hasPhoneNumber ||
      phoneRequestStartedRef.current ||
      !webApp?.requestContact
    ) {
      return;
    }

    phoneRequestStartedRef.current = true;

    queueMicrotask(() => {
      setIsRefreshingProfile(true);

      webApp.requestContact((shared) => {
        if (!shared) {
          setIsRefreshingProfile(false);
          return;
        }

        const refreshWithRetries = async () => {
          for (let attempt = 0; attempt < 4; attempt += 1) {
            await new Promise((resolve) => setTimeout(resolve, 1200));
            const nextPayload = await loadBootstrap();

            if (nextPayload?.user.hasPhoneNumber) {
              return;
            }
          }
        };

        void refreshWithRetries()
          .catch((error) => {
            console.error("Failed to refresh profile after contact request", error);
          })
          .finally(() => {
            setIsRefreshingProfile(false);
          });
      });
    });
  }, [payload]);

  const heroCourse = useMemo(
    () => payload?.ownedCourses[0] ?? payload?.availableCourses[0] ?? null,
    [payload],
  );

  const hasOwnedCourses = Boolean(payload?.ownedCourses.length);
  const hasAvailableCourses = Boolean(payload?.availableCourses.length);

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <section
          className={styles.hero}
          style={buildHeroBackground(heroCourse?.coverImageUrl ?? null)}
        >
          <div className={styles.heroContent}>
            <span className={styles.eyebrow}>Telegram Mini App</span>
            <h1 className={styles.heroTitle}>{heroCourse?.title ?? "Base"}</h1>
            <p className={styles.heroSubtitle}>by Evgenia Shchykno</p>
            <p className={styles.heroBody}>
              {heroCourse?.subtitle ||
                "Тренировки и питание в удобном формате mini app."}
            </p>
          </div>
        </section>

        <div className={styles.content}>
          {hasOwnedCourses ? (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Мои курсы</h2>
              <div className={styles.list}>
                {payload?.ownedCourses.map((course) => (
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

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Все курсы</h2>
            {isLoading ? (
              <LoadingSection />
            ) : hasAvailableCourses ? (
              <div className={styles.list}>
                {payload?.availableCourses.map((course) => (
                  <CourseCard
                    key={course.id}
                    course={course}
                    buttonKind="buy"
                    buttonLabel="Купить"
                  />
                ))}
              </div>
            ) : null}
          </section>
        </div>

        {isRefreshingProfile ? (
          <div className={styles.loaderOverlay} aria-hidden="true">
            <span className={styles.loaderSpinner} />
          </div>
        ) : null}
      </div>
    </main>
  );
}
