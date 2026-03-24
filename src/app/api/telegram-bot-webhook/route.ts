import { getTelegramWebhookSecret } from "@/lib/env";
import { saveTelegramPhoneNumber } from "@/lib/db";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

let loggedMissingWebhookSecret = false;

interface TelegramContact {
  phone_number: string;
  user_id?: number;
}

interface TelegramMessageFrom {
  id: number;
  first_name: string;
  username?: string;
}

interface TelegramWebhookUpdate {
  message?: {
    from?: TelegramMessageFrom;
    contact?: TelegramContact;
  };
}

function normalizePhoneNumber(phoneNumber: string): string {
  const trimmed = phoneNumber.trim();
  const hasLeadingPlus = trimmed.startsWith("+");
  const digitsOnly = trimmed.replace(/[^\d]/g, "");

  return hasLeadingPlus ? `+${digitsOnly}` : digitsOnly;
}

export async function POST(request: Request) {
  try {
    const expectedSecretToken = getTelegramWebhookSecret();
    const suppliedSecretToken = request.headers.get("x-telegram-bot-api-secret-token");

    if (expectedSecretToken) {
      if (suppliedSecretToken !== expectedSecretToken) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }
    } else if (!loggedMissingWebhookSecret) {
      loggedMissingWebhookSecret = true;
      console.warn(
        "TELEGRAM_BOT_WEBHOOK_SECRET is not configured. Telegram webhook requests are accepted without secret validation.",
      );
    }

    const update = (await request.json()) as TelegramWebhookUpdate;
    const message = update.message;
    const contact = message?.contact;
    const from = message?.from;

    if (!message || !contact || !from) {
      return Response.json({ ok: true });
    }

    const telegramUserId = contact.user_id ?? from.id;

    await saveTelegramPhoneNumber(createSupabaseAdminClient(), {
      telegramUserId,
      firstName: from.first_name,
      username: from.username ?? null,
      phoneNumber: normalizePhoneNumber(contact.phone_number),
    });

    console.info("Saved phone number from Telegram webhook", {
      telegramUserId,
      hasSecretValidation: Boolean(expectedSecretToken),
    });

    return Response.json({ ok: true });
  } catch (error) {
    console.error("Telegram bot webhook error", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
