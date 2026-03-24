"use client";

import { useEffect, useMemo, useState } from "react";
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
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRequestingPhone, setIsRequestingPhone] = useState(false);
  const [phoneHint, setPhoneHint] = useState<string | null>(null);

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
      setError("Откройте mini app из Telegram по startapp-ссылке, чтобы загрузить ваши курсы.");
      setIsLoading(false);
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
    setError(null);

    if (nextPayload.user.hasPhoneNumber) {
      setPhoneHint("Телефон сохранен");
    }

    return nextPayload;
  };

  useEffect(() => {
    const controller = new AbortController();

    queueMicrotask(() => {
      void loadBootstrap(controller.signal)
        .catch((nextError: unknown) => {
          if (controller.signal.aborted) {
            return;
          }

          setError(
            nextError instanceof Error
              ? nextError.message
              : "Не удалось загрузить данные пользователя.",
          );
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setIsLoading(false);
          }
        });
    });

    return () => controller.abort();
  }, []);

  const heroCourse = useMemo(
    () => payload?.ownedCourses[0] ?? payload?.availableCourses[0] ?? null,
    [payload],
  );

  const requestPhoneNumber = () => {
    const webApp = window.Telegram?.WebApp;

    if (!webApp?.requestContact) {
      setPhoneHint("Текущая версия Telegram не поддерживает запрос номера.");
      return;
    }

    setIsRequestingPhone(true);
    setPhoneHint(null);

    webApp.requestContact((shared) => {
      if (!shared) {
        setPhoneHint("Номер не был отправлен.");
        setIsRequestingPhone(false);
        return;
      }

      setPhoneHint("Запрос отправлен. Обновляем профиль…");

      const refreshWithRetries = async () => {
        for (let attempt = 0; attempt < 4; attempt += 1) {
          await new Promise((resolve) => setTimeout(resolve, 1200));
          const nextPayload = await loadBootstrap();

          if (nextPayload?.user.hasPhoneNumber) {
            break;
          }
        }
      };

      void refreshWithRetries()
        .catch(() => {
          setPhoneHint("Номер отправлен, но профиль пока не обновился.");
        })
        .finally(() => {
          setIsRequestingPhone(false);
        });
    });
  };

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
              {heroCourse?.subtitle || "Тренировки и питание в удобном формате mini app."}
            </p>
          </div>
        </section>

        <div className={styles.content}>
          {error ? <p className={styles.errorText}>{error}</p> : null}

          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Мои курсы</h2>
              {payload?.user.hasPhoneNumber ? (
                <span className={styles.phoneBadge}>
                  {payload.user.phoneNumber ?? "Телефон сохранен"}
                </span>
              ) : (
                <button
                  type="button"
                  className={styles.phoneButton}
                  onClick={requestPhoneNumber}
                  disabled={isRequestingPhone}
                >
                  {isRequestingPhone ? "Отправляем…" : "Поделиться номером"}
                </button>
              )}
            </div>

            {phoneHint ? <p className={styles.sectionHint}>{phoneHint}</p> : null}

            {isLoading ? (
              <LoadingSection />
            ) : payload?.ownedCourses.length ? (
              <div className={styles.list}>
                {payload.ownedCourses.map((course) => (
                  <CourseCard
                    key={course.id}
                    course={course}
                    buttonKind="open"
                    buttonLabel={course.accessUrl ? "Открыть" : "Скоро"}
                    disabled={!course.accessUrl}
                  />
                ))}
              </div>
            ) : (
              <div className={styles.emptyCard}>
                <h3 className={styles.emptyTitle}>Пока нет привязанных покупок</h3>
                <p className={styles.emptyText}>
                  Как только Tilda отправит submit с вашим `session_id`, курс появится в
                  этом разделе.
                </p>
              </div>
            )}
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Все курсы</h2>

            {isLoading ? (
              <LoadingSection />
            ) : payload?.availableCourses.length ? (
              <div className={styles.list}>
                {payload.availableCourses.map((course) => (
                  <CourseCard
                    key={course.id}
                    course={course}
                    buttonKind="buy"
                    buttonLabel="Купить"
                  />
                ))}
              </div>
            ) : (
              <div className={styles.emptyCard}>
                <h3 className={styles.emptyTitle}>Все доступные курсы уже привязаны</h3>
                <p className={styles.emptyText}>
                  В каталоге не осталось некупленных курсов для этого пользователя.
                </p>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
