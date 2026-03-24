import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  TELEGRAM_BOT_USERNAME: z.string().min(1),
});

const telegramWebhookEnvSchema = z.object({
  TELEGRAM_BOT_WEBHOOK_SECRET: z.string().min(1),
});

const tildaWebhookEnvSchema = z.object({
  TILDA_WEBHOOK_SECRET: z.string().min(1),
});

type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | null = null;
let cachedTildaWebhookSecret: string | null = null;

function buildEnvError(issues: { path: PropertyKey[] }[]) {
  return `Invalid environment variables: ${issues
    .map((issue) => issue.path.join("."))
    .join(", ")}`;
}

export function getEnv(): Env {
  if (cachedEnv) {
    return cachedEnv;
  }

  const parsed = envSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
    TELEGRAM_BOT_USERNAME: process.env.TELEGRAM_BOT_USERNAME,
  });

  if (!parsed.success) {
    throw new Error(buildEnvError(parsed.error.issues));
  }

  cachedEnv = parsed.data;
  return cachedEnv;
}

export function getTelegramWebhookSecret(): string {
  const parsed = telegramWebhookEnvSchema.safeParse({
    TELEGRAM_BOT_WEBHOOK_SECRET: process.env.TELEGRAM_BOT_WEBHOOK_SECRET,
  });

  if (!parsed.success) {
    return "";
  }

  return parsed.data.TELEGRAM_BOT_WEBHOOK_SECRET;
}

export function getTildaWebhookSecret(): string {
  if (cachedTildaWebhookSecret) {
    return cachedTildaWebhookSecret;
  }

  const parsed = tildaWebhookEnvSchema.safeParse({
    TILDA_WEBHOOK_SECRET: process.env.TILDA_WEBHOOK_SECRET,
  });

  if (!parsed.success) {
    throw new Error(buildEnvError(parsed.error.issues));
  }

  cachedTildaWebhookSecret = parsed.data.TILDA_WEBHOOK_SECRET;
  return cachedTildaWebhookSecret;
}
