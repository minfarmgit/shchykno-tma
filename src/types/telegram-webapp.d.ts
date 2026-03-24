interface TelegramWebAppUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
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
  openLink(url: string): void;
  openTelegramLink(url: string): void;
}

interface Window {
  Telegram?: {
    WebApp?: TelegramWebApp;
  };
}
