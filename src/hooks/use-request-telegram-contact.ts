"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getTelegramBootstrapQueryOptions } from "@/lib/query/telegram-bootstrap";
import {
  getTelegramBootstrapRequest,
  getTelegramWebApp,
  requestTelegramContact,
  TelegramContactRequestError,
} from "@/lib/telegram-webapp";

const CONTACT_REFRESH_DELAY_MS = 1_500;
const CONTACT_REFRESH_ATTEMPTS = 8;

function wait(delayMs: number) {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

function isUnsupportedTelegramContactError(error: unknown) {
  if (error instanceof TelegramContactRequestError) {
    return error.code === "unsupported";
  }

  return error instanceof Error && error.message === "WebAppMethodUnsupported";
}

async function waitForPhoneNumberSync(
  queryClient: ReturnType<typeof useQueryClient>,
) {
  const request = getTelegramBootstrapRequest();

  if (!request) {
    throw new Error("Telegram Mini App initData is missing.");
  }

  for (let attempt = 0; attempt < CONTACT_REFRESH_ATTEMPTS; attempt += 1) {
    await wait(CONTACT_REFRESH_DELAY_MS);

    const payload = await queryClient.fetchQuery({
      ...getTelegramBootstrapQueryOptions(request),
      staleTime: 0,
    });

    if (payload.user.hasPhoneNumber) {
      return payload;
    }
  }

  throw new Error("PHONE_SYNC_TIMEOUT");
}

export function getTelegramContactErrorMessage(error: unknown) {
  if (isUnsupportedTelegramContactError(error)) {
    return null;
  }

  if (error instanceof TelegramContactRequestError) {
    if (error.code === "cancelled") {
      return "Номер телефона не был передан.";
    }

    if (error.code === "timeout") {
      return "Telegram слишком долго подтверждает передачу номера. Проверьте webhook бота и повторите попытку.";
    }
  }

  if (error instanceof Error && error.message === "PHONE_SYNC_TIMEOUT") {
    return "Telegram не подтвердил сохранение номера. Проверьте webhook бота и повторите попытку.";
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "Не удалось обновить профиль после передачи номера.";
}

export function useRequestTelegramContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const webApp = getTelegramWebApp();

      if (!webApp) {
        return null;
      }

      try {
        await requestTelegramContact(webApp);
      } catch (error) {
        if (isUnsupportedTelegramContactError(error)) {
          return null;
        }

        throw error;
      }

      return waitForPhoneNumberSync(queryClient);
    },
  });
}
