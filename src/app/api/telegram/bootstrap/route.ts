import type { BindingStatus } from "@/lib/contracts";
import { ZodError, z } from "zod";
import {
  bindBrowserSession,
  buildBootstrapResponse,
  reconcileCourseAccessBySession,
  reconcileCourseAccessByPhone,
  upsertTelegramUser,
} from "@/lib/db";
import { getEnv } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { validateTelegramInitData } from "@/lib/telegram";
import { normalizeSessionId } from "@/lib/tilda";

export const runtime = "nodejs";

const bootstrapBodySchema = z.object({
  initData: z.string().min(1),
  startParam: z.string().optional().nullable(),
});

export async function POST(request: Request) {
  try {
    const body = bootstrapBodySchema.parse(await request.json());
    const telegramUser = validateTelegramInitData(
      body.initData,
      getEnv().TELEGRAM_BOT_TOKEN,
    );
    const client = createSupabaseAdminClient();
    const telegramUserRow = await upsertTelegramUser(client, telegramUser);

    let bindingStatus: BindingStatus = "missing_session";
    let conflictSessionId: string | null = null;
    const sessionId = normalizeSessionId(body.startParam);

    if (sessionId) {
      bindingStatus = await bindBrowserSession(client, sessionId, telegramUserRow.id);

      if (bindingStatus === "conflict") {
        conflictSessionId = sessionId;
      } else {
        const sessionReconciliationResult = await reconcileCourseAccessBySession(client, {
          sessionId,
        });

        console.info("Telegram bootstrap session reconciliation finished", {
          telegramUserId: telegramUser.id,
          sessionId,
          bindingStatus,
          matchedSubmissionCount: sessionReconciliationResult.matchedSubmissionCount,
          grantedCourseExternalIds: sessionReconciliationResult.grantedCourseExternalIds,
        });
      }
    }

    if (telegramUserRow.phone_number) {
      const phoneReconciliationResult = await reconcileCourseAccessByPhone(client, {
        telegramUserId: telegramUser.id,
        phoneNumber: telegramUserRow.phone_number,
      });

      console.info("Telegram bootstrap phone reconciliation finished", {
        telegramUserId: telegramUser.id,
        phoneNumber: telegramUserRow.phone_number,
        matchedSubmissionCount: phoneReconciliationResult.matchedSubmissionCount,
        grantedCourseExternalIds: phoneReconciliationResult.grantedCourseExternalIds,
      });
    }

    const payload = await buildBootstrapResponse({
      client,
      telegramUserRow,
      telegramUser,
      bindingStatus,
      conflictSessionId,
    });

    return Response.json(payload, {
      headers: {
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    console.error("Telegram bootstrap error", error);

    if (error instanceof ZodError) {
      return Response.json({ error: "Invalid bootstrap payload." }, { status: 400 });
    }

    if (
      error instanceof Error &&
      error.message.toLowerCase().includes("telegram initdata")
    ) {
      return Response.json({ error: error.message }, { status: 401 });
    }

    return Response.json({ error: "Internal server error." }, { status: 500 });
  }
}
