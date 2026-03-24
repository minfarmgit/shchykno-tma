import { getEnv } from "@/lib/env";
import { saveTelegramPhoneNumber } from "@/lib/db";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

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
  const secretToken = request.headers.get("x-telegram-bot-api-secret-token");

  if (secretToken !== getEnv().TELEGRAM_BOT_WEBHOOK_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
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

    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
