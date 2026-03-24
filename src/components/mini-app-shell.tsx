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
    backgroundImage: `linear-gradient(180deg, rgba(255, 190, 220, 0.12) 0%, rgba(238, 68, 161, 0.58) 100%), url("${coverImageUrl}")`,
  };
}

function LoadingSection() {
  return (
    <div className={styles.loadingStack} aria-hidden="true">
      <div className={styles.skeleton} />
      <div className={styles.skeleton} />
      <div className={styles.skeleton} />
    </div>
  );
}

function CourseItem({
  course,
  actionLabel,
  actionKind,
  disabled = false,
}: {
  course: CourseDto;
  actionLabel: string;
  actionKind: "open" | "buy";
  disabled?: boolean;
}) {
  const actionUrl = actionKind === "open" ? course.accessUrl : course.buyUrl;
  const buttonClassName = [
    styles.actionButton,
    actionKind === "buy" ? styles.actionButtonSecondary : "",
    disabled || !actionUrl ? styles.actionButtonDisabled : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <article className={styles.courseCard}>
      <div className={styles.courseBadge}>{getBadgeLabel(course)}</div>
      <div className={styles.courseInfo}>
        <h3 className={styles.courseTitle}>{course.title}</h3>
        <p className={styles.courseSubtitle}>
          {course.subtitle || "Подробности курса появятся после заполнения каталога."}
        </p>
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
        {actionLabel}
      </button>
    </article>
  );
}

export function MiniAppShell() {
  const [payload, setPayload] = useState<BootstrapResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const webApp = window.Telegram?.WebApp;

    webApp?.ready();
    webApp?.expand();

    if (!webApp?.initData) {
      queueMicrotask(() => {
        setError(
          "Откройте mini app из Telegram по startapp-ссылке, чтобы загрузить ваши курсы.",
        );
        setIsLoading(false);
      });
      return;
    }

    const controller = new AbortController();

    void fetch("/api/telegram/bootstrap", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        initData: webApp.initData,
        startParam: getStartParam(),
      }),
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          const body = await response.text();
          throw new Error(body || "Не удалось загрузить данные пользователя.");
        }

        return (await response.json()) as BootstrapResponse;
      })
      .then((nextPayload) => {
        setPayload(nextPayload);
        setError(null);
      })
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

    return () => controller.abort();
  }, []);

  const heroCourse = useMemo(
    () => payload?.ownedCourses[0] ?? payload?.availableCourses[0] ?? null,
    [payload],
  );

  const welcomeName = payload?.user.firstName ?? "Shchykno";

  return (
    <main className={styles.page}>
      <div className={styles.phone}>
        <header className={styles.topbar}>
          <button type="button" className={styles.ghostButton}>
            Назад
          </button>
          <div className={styles.brand}>
            <span className={styles.brandTitle}>Shchykno</span>
            <span className={styles.brandMeta}>мини-приложение</span>
          </div>
          <div style={{ width: 42 }} />
        </header>

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
                  `${welcomeName}, здесь появятся ваши курсы и вся доступная витрина.`}
              </p>
            </div>
          </section>

          {payload?.bindingStatus === "conflict" ? (
            <section className={`${styles.banner} ${styles.bannerError}`}>
              <h2 className={styles.bannerTitle}>Этот session id уже привязан</h2>
              <p className={styles.bannerText}>
                Покупки по текущей ссылке уже закреплены за другим Telegram-аккаунтом.
                Проверьте, что вы открыли mini app из правильного профиля.
              </p>
            </section>
          ) : null}

          {payload?.bindingStatus === "missing_session" ? (
            <section className={`${styles.banner} ${styles.bannerWarning}`}>
              <h2 className={styles.bannerTitle}>Mini App открыт без session id</h2>
              <p className={styles.bannerText}>
                Текущие покупки не смогут автоматически привязаться, пока приложение не
                открывают по `startapp`-ссылке с session id.
              </p>
            </section>
          ) : null}

          {error ? (
            <section className={`${styles.section} ${styles.errorCard}`}>
              <h2 className={styles.sectionTitle}>Не удалось загрузить курсы</h2>
              <p className={styles.sectionNote}>{error}</p>
            </section>
          ) : null}

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Ваши курсы</h2>
            <p className={styles.sectionNote}>
              Доступ открывается сразу после привязки `session_id` к вашему Telegram.
            </p>
            {isLoading ? (
              <LoadingSection />
            ) : payload?.ownedCourses.length ? (
              <div className={styles.list}>
                {payload.ownedCourses.map((course) => (
                  <CourseItem
                    key={course.id}
                    course={course}
                    actionKind="open"
                    actionLabel={course.accessUrl ? "Открыть" : "Скоро"}
                    disabled={!course.accessUrl}
                  />
                ))}
              </div>
            ) : (
              <div className={styles.emptyCard}>
                <h3 className={styles.bannerTitle}>Пока нет привязанных покупок</h3>
                <p className={styles.bannerText}>
                  Как только Tilda отправит submit с вашим `session_id`, курс появится в этом
                  разделе.
                </p>
              </div>
            )}
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Все курсы</h2>
            <p className={styles.sectionNote}>
              Здесь отображаются только еще не купленные курсы из каталога Supabase.
            </p>
            {isLoading ? (
              <LoadingSection />
            ) : payload?.availableCourses.length ? (
              <div className={styles.list}>
                {payload.availableCourses.map((course) => (
                  <CourseItem
                    key={course.id}
                    course={course}
                    actionKind="buy"
                    actionLabel="Купить"
                  />
                ))}
              </div>
            ) : (
              <div className={styles.emptyCard}>
                <h3 className={styles.bannerTitle}>Каталог закончился</h3>
                <p className={styles.bannerText}>
                  Все опубликованные курсы уже находятся у пользователя или еще не заведены в
                  базу.
                </p>
              </div>
            )}
          </section>

          <footer className={styles.footer}>
            Бот должен открывать Mini App по `startapp`, а Tilda обязана отправлять
            `session_id` hidden field и `externalid` товара в webhook.
          </footer>
        </div>
      </div>
    </main>
  );
}
