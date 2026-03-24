import type { TelegramBootstrapRequest } from "@/lib/api/telegram";

const CONTACT_REQUEST_TIMEOUT_MS = 15_000;
const DEV_TELEGRAM_INIT_DATA =
  process.env.NEXT_PUBLIC_DEV_TELEGRAM_INIT_DATA?.trim() || null;

export class TelegramContactRequestError extends Error {
  constructor(public readonly code: "cancelled" | "timeout" | "unsupported") {
    super(code);
    this.name = "TelegramContactRequestError";
  }
}

function isBrowser() {
  return typeof window !== "undefined";
}

function getTelegramInitData(webApp: TelegramWebApp | null): string | null {
  if (process.env.NODE_ENV === "development" && DEV_TELEGRAM_INIT_DATA) {
    return DEV_TELEGRAM_INIT_DATA;
  }

  return webApp?.initData ?? null;
}

export function getTelegramWebApp(): TelegramWebApp | null {
  if (!isBrowser()) {
    return null;
  }

  return window.Telegram?.WebApp ?? null;
}

export function setupTelegramWebApp(webApp: TelegramWebApp | null) {
  webApp?.ready();
  webApp?.expand();
  webApp?.setHeaderColor("#ffffff");
  webApp?.setBackgroundColor("#ffffff");
  webApp?.setBottomBarColor?.("#ffffff");
}

export function getTelegramStartParam(webApp = getTelegramWebApp()): string | null {
  if (!isBrowser()) {
    return null;
  }

  const searchParams = new URLSearchParams(window.location.search);

  return (
    searchParams.get("tgWebAppStartParam") ??
    searchParams.get("startapp") ??
    webApp?.initDataUnsafe?.start_param ??
    webApp?.initDataUnsafe?.startParam ??
    null
  );
}

export function getTelegramBootstrapRequest(): TelegramBootstrapRequest | null {
  const webApp = getTelegramWebApp();
  const initData = getTelegramInitData(webApp);

  if (!initData) {
    return null;
  }

  return {
    initData,
    startParam: getTelegramStartParam(webApp),
  };
}

export function requestTelegramContact(webApp: TelegramWebApp): Promise<void> {
  if (!webApp.requestContact) {
    throw new TelegramContactRequestError("unsupported");
  }

  return new Promise((resolve, reject) => {
    let isSettled = false;

    const handleStatus = (status: "sent" | "cancelled" | boolean) => {
      if (isSettled) {
        return;
      }

      isSettled = true;
      window.clearTimeout(timeoutId);
      webApp.offEvent?.("contactRequested", handleEvent);

      if (status === "sent" || status === true) {
        resolve();
        return;
      }

      reject(new TelegramContactRequestError("cancelled"));
    };

    const handleEvent = (event: { status: "sent" | "cancelled" }) => {
      handleStatus(event.status);
    };

    const timeoutId = window.setTimeout(() => {
      if (isSettled) {
        return;
      }

      isSettled = true;
      webApp.offEvent?.("contactRequested", handleEvent);
      reject(new TelegramContactRequestError("timeout"));
    }, CONTACT_REQUEST_TIMEOUT_MS);

    webApp.onEvent?.("contactRequested", handleEvent);
    webApp.requestContact((shared) => {
      handleStatus(shared);
    });
  });
}
