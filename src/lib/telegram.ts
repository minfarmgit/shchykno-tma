import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const telegramUserSchema = z.object({
  id: z.number().int().positive(),
  first_name: z.string().min(1),
  last_name: z.string().optional(),
  username: z.string().optional(),
  language_code: z.string().optional(),
  is_premium: z.boolean().optional(),
  allows_write_to_pm: z.boolean().optional(),
  photo_url: z.string().url().optional(),
});

export type TelegramInitDataUser = z.infer<typeof telegramUserSchema>;

const MAX_INIT_DATA_AGE_SECONDS = 60 * 60 * 24;

export function validateTelegramInitData(
  initData: string,
  botToken: string,
): TelegramInitDataUser {
  if (!initData) {
    throw new Error("Missing Telegram initData.");
  }

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");

  if (!hash) {
    throw new Error("Telegram initData hash is missing.");
  }

  const dataCheckString = [...params.entries()]
    .filter(([key]) => key !== "hash")
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
  const calculatedHash = createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  const suppliedHash = Buffer.from(hash, "hex");
  const expectedHash = Buffer.from(calculatedHash, "hex");

  if (
    suppliedHash.length !== expectedHash.length ||
    !timingSafeEqual(suppliedHash, expectedHash)
  ) {
    throw new Error("Telegram initData signature is invalid.");
  }

  const authDate = Number(params.get("auth_date"));

  if (!Number.isFinite(authDate)) {
    throw new Error("Telegram initData auth_date is invalid.");
  }

  const nowSeconds = Math.floor(Date.now() / 1000);

  if (nowSeconds - authDate > MAX_INIT_DATA_AGE_SECONDS) {
    throw new Error("Telegram initData has expired.");
  }

  const userValue = params.get("user");

  if (!userValue) {
    throw new Error("Telegram initData user payload is missing.");
  }

  return telegramUserSchema.parse(JSON.parse(userValue));
}
