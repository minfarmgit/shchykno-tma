import { NextRequest } from "next/server";
import { ensureBrowserSessionExists, upsertTildaSubmission } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { parseTildaFormData } from "@/lib/tilda";

export const runtime = "nodejs";

function textResponse(body: string, status: number) {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/plain; charset=utf-8",
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get("token");

    if (token !== getEnv().TILDA_WEBHOOK_SECRET) {
      return textResponse("Unauthorized", 401);
    }

    const formData = await request.formData();
    const payload = parseTildaFormData(formData);

    if (!payload.tranId || !payload.sessionId || !payload.courseExternalId) {
      return textResponse("Missing required fields: tranid, session_id or externalid", 422);
    }

    const client = createSupabaseAdminClient();

    await ensureBrowserSessionExists(client, payload.sessionId);
    await upsertTildaSubmission(client, {
      tranId: payload.tranId,
      formId: payload.formId,
      sessionId: payload.sessionId,
      courseExternalId: payload.courseExternalId,
      courseTitle: payload.courseTitle,
      rawPayload: payload.rawPayload,
    });

    return textResponse("ok", 200);
  } catch {
    return textResponse("Internal server error", 500);
  }
}
