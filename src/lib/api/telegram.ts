import type { BootstrapResponse } from "@/lib/contracts";
import { postJson } from "@/lib/api/http";

export interface TelegramBootstrapRequest {
  initData: string;
  startParam: string | null;
}

export async function fetchTelegramBootstrap(
  request: TelegramBootstrapRequest,
  signal?: AbortSignal,
): Promise<BootstrapResponse> {
  return postJson<BootstrapResponse, TelegramBootstrapRequest>(
    "/api/telegram/bootstrap",
    request,
    {
      signal,
      fallbackMessage: "Не удалось загрузить данные пользователя.",
    },
  );
}
