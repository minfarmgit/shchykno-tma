import { NextRequest } from "next/server";
import { ensureBrowserSessionExists, upsertTildaSubmission } from "@/lib/db";
import { getTildaWebhookSecret } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { parseTildaFormData } from "@/lib/tilda";

export const runtime = "nodejs";

const TILDA_TOKEN_HEADER_NAMES = ["x-tilda-webhook-token", "x-api-key"] as const;

function textResponse(body: string, status: number) {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/plain; charset=utf-8",
    },
  });
}

function getTildaWebhookToken(request: NextRequest) {
  for (const headerName of TILDA_TOKEN_HEADER_NAMES) {
    const headerValue = request.headers.get(headerName)?.trim();

    if (headerValue) {
      return headerValue;
    }
  }

  const authorizationHeader = request.headers.get("authorization")?.trim();

  if (!authorizationHeader) {
    return null;
  }

  const bearerMatch = authorizationHeader.match(/^Bearer\s+(.+)$/i);
  return bearerMatch?.[1]?.trim() || authorizationHeader;
}

export async function POST(request: NextRequest) {
  try {
    const token = getTildaWebhookToken(request);

    if (token !== getTildaWebhookSecret()) {
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
  } catch (error) {
    console.error("Tilda webhook error", error);
    return textResponse("Internal server error", 500);
  }
}
