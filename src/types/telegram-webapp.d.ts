interface TelegramWebAppUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  allows_write_to_pm?: boolean;
}

interface TelegramWebAppInitDataUnsafe {
  user?: TelegramWebAppUser;
  start_param?: string;
  startParam?: string;
}

interface TelegramWebApp {
  initData: string;
  initDataUnsafe?: TelegramWebAppInitDataUnsafe;
  ready(): void;
  expand(): void;
  isVersionAtLeast(version: string): boolean;
  setHeaderColor(color: string): void;
  setBackgroundColor(color: string): void;
  setBottomBarColor?(color: string): void;
  openLink(url: string): void;
  openTelegramLink(url: string): void;
  requestContact(callback?: (shared: boolean) => void): void;
  onEvent?(
    eventType: "contactRequested",
    eventHandler: (event: { status: "sent" | "cancelled" }) => void,
  ): void;
  offEvent?(
    eventType: "contactRequested",
    eventHandler: (event: { status: "sent" | "cancelled" }) => void,
  ): void;
}

interface Window {
  Telegram?: {
    WebApp?: TelegramWebApp;
  };
}
