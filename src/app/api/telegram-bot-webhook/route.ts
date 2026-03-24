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
  update_id?: number;
  message?: {
    message_id?: number;
    date?: number;
    from?: TelegramMessageFrom;
    contact?: TelegramContact;
    chat?: {
      id?: number;
      type?: string;
    };
    text?: string;
  };
}

function normalizePhoneNumber(phoneNumber: string): string {
  const trimmed = phoneNumber.trim();
  const hasLeadingPlus = trimmed.startsWith("+");
  const digitsOnly = trimmed.replace(/[^\d]/g, "");

  return hasLeadingPlus ? `+${digitsOnly}` : digitsOnly;
}

function maskPhoneNumber(phoneNumber: string) {
  if (phoneNumber.length <= 4) {
    return phoneNumber;
  }

  return `${"*".repeat(Math.max(phoneNumber.length - 4, 0))}${phoneNumber.slice(-4)}`;
}

export async function POST(request: Request) {
  try {
    const expectedSecretToken = getTelegramWebhookSecret();
    const suppliedSecretToken = request.headers.get("x-telegram-bot-api-secret-token");

    console.info("Telegram bot webhook request received", {
      contentType: request.headers.get("content-type"),
      userAgent: request.headers.get("user-agent"),
      hasSecretValidation: Boolean(expectedSecretToken),
      hasSuppliedSecret: Boolean(suppliedSecretToken),
    });

    if (expectedSecretToken) {
      if (suppliedSecretToken !== expectedSecretToken) {
        console.warn("Telegram bot webhook rejected: secret token mismatch", {
          hasSuppliedSecret: Boolean(suppliedSecretToken),
        });
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

    console.info("Telegram bot webhook payload summary", {
      updateId: update.update_id ?? null,
      messageId: message?.message_id ?? null,
      chatId: message?.chat?.id ?? null,
      chatType: message?.chat?.type ?? null,
      hasMessage: Boolean(message),
      hasContact: Boolean(contact),
      hasFrom: Boolean(from),
      hasText: typeof message?.text === "string" && message.text.length > 0,
    });

    if (!message || !contact || !from) {
      console.warn("Telegram bot webhook skipped: required contact payload is missing", {
        updateId: update.update_id ?? null,
        hasMessage: Boolean(message),
        hasContact: Boolean(contact),
        hasFrom: Boolean(from),
      });
      return Response.json({ ok: true });
    }

    const telegramUserId = contact.user_id ?? from.id;
    const normalizedPhoneNumber = normalizePhoneNumber(contact.phone_number);

    console.info("Saving phone number from Telegram webhook", {
      updateId: update.update_id ?? null,
      telegramUserId,
      fromId: from.id,
      contactUserId: contact.user_id ?? null,
      username: from.username ?? null,
      firstName: from.first_name,
      maskedPhoneNumber: maskPhoneNumber(normalizedPhoneNumber),
    });

    const savedPhone = await saveTelegramPhoneNumber(createSupabaseAdminClient(), {
      telegramUserId,
      firstName: from.first_name,
      username: from.username ?? null,
      phoneNumber: normalizedPhoneNumber,
    });

    console.info("Saved phone number from Telegram webhook", {
      updateId: update.update_id ?? null,
      telegramUserId: savedPhone.row.telegram_user_id,
      savedRowId: savedPhone.row.id,
      savedUsername: savedPhone.row.username,
      maskedPhoneNumber: maskPhoneNumber(savedPhone.row.phone_number ?? normalizedPhoneNumber),
      confirmedAt: savedPhone.confirmedAt,
    });

    return Response.json({ ok: true });
  } catch (error) {
    console.error("Telegram bot webhook error", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
