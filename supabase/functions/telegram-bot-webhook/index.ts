import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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

function normalizePhoneNumber(phoneNumber: string) {
  const digitsOnly = phoneNumber.trim().replace(/[^\d]/g, "");
  return digitsOnly || null;
}

function maskPhoneNumber(phoneNumber: string) {
  if (phoneNumber.length <= 4) {
    return phoneNumber;
  }

  return `${"*".repeat(Math.max(phoneNumber.length - 4, 0))}${phoneNumber.slice(-4)}`;
}

function isWebhookAuthorized(request: Request) {
  const expectedSecret = Deno.env.get("TELEGRAM_BOT_WEBHOOK_SECRET")?.trim();

  if (!expectedSecret) {
    console.warn(
      "TELEGRAM_BOT_WEBHOOK_SECRET is not configured in Supabase Edge Function secrets. Requests are accepted without secret validation.",
    );
    return true;
  }

  const suppliedSecret = request.headers.get("x-telegram-bot-api-secret-token")?.trim();
  return suppliedSecret === expectedSecret;
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  console.info("Supabase Telegram webhook request received", {
    contentType: request.headers.get("content-type"),
    userAgent: request.headers.get("user-agent"),
    hasSuppliedSecret: Boolean(
      request.headers.get("x-telegram-bot-api-secret-token")?.trim(),
    ),
    hasSupabaseUrl: Boolean(Deno.env.get("SUPABASE_URL")),
    hasServiceRoleKey: Boolean(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")),
  });

  if (!isWebhookAuthorized(request)) {
    console.warn("Supabase Telegram webhook rejected: secret token mismatch");
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const update = (await request.json()) as TelegramWebhookUpdate;
    const message = update.message;
    const contact = message?.contact;
    const from = message?.from;

    console.info("Supabase Telegram webhook payload summary", {
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
      console.warn(
        "Supabase Telegram webhook skipped: required contact payload is missing",
        {
          updateId: update.update_id ?? null,
          hasMessage: Boolean(message),
          hasContact: Boolean(contact),
          hasFrom: Boolean(from),
        },
      );

      return Response.json({ ok: true });
    }

    const telegramUserId = contact.user_id ?? from.id;
    const phoneNumber = normalizePhoneNumber(contact.phone_number);

    if (!phoneNumber) {
      console.warn(
        "Supabase Telegram webhook skipped: phone number could not be normalized",
        {
          updateId: update.update_id ?? null,
          rawPhoneNumber: contact.phone_number,
        },
      );

      return Response.json({ ok: true });
    }
    const confirmedAt = new Date().toISOString();
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      },
    );

    console.info("Saving phone number from Supabase Telegram webhook", {
      updateId: update.update_id ?? null,
      telegramUserId,
      fromId: from.id,
      contactUserId: contact.user_id ?? null,
      username: from.username ?? null,
      firstName: from.first_name,
      maskedPhoneNumber: maskPhoneNumber(phoneNumber),
    });

    const result = await supabase
      .from("telegram_users")
      .upsert(
        {
          telegram_user_id: telegramUserId,
          first_name: from.first_name,
          username: from.username ?? null,
          phone_number: phoneNumber,
          phone_number_confirmed_at: confirmedAt,
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: "telegram_user_id" },
      )
      .select("id, telegram_user_id, username, first_name, phone_number")
      .single();

    if (result.error) {
      throw new Error(`Failed to save telegram phone number: ${result.error.message}`);
    }

    console.info("Saved phone number from Supabase Telegram webhook", {
      updateId: update.update_id ?? null,
      telegramUserId: result.data.telegram_user_id,
      savedRowId: result.data.id,
      savedUsername: result.data.username,
      maskedPhoneNumber: maskPhoneNumber(result.data.phone_number ?? phoneNumber),
      confirmedAt,
    });

    return Response.json({ ok: true });
  } catch (error) {
    console.error("Supabase Telegram webhook error", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return Response.json({ error: message }, { status: 500 });
  }
});
