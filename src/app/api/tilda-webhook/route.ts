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

function maskToken(value: string | null) {
  if (!value) {
    return null;
  }

  if (value.length <= 8) {
    return "***";
  }

  return `${value.slice(0, 4)}***${value.slice(-4)}`;
}

function summarizeHeaders(request: NextRequest) {
  const authorizationHeader = request.headers.get("authorization")?.trim() ?? null;

  return {
    contentType: request.headers.get("content-type"),
    userAgent: request.headers.get("user-agent"),
    xForwardedFor: request.headers.get("x-forwarded-for"),
    xForwardedHost: request.headers.get("x-forwarded-host"),
    xForwardedProto: request.headers.get("x-forwarded-proto"),
    authorization: maskToken(authorizationHeader),
    xTildaWebhookToken: maskToken(request.headers.get("x-tilda-webhook-token")?.trim() ?? null),
    xApiKey: maskToken(request.headers.get("x-api-key")?.trim() ?? null),
    headerNames: [...request.headers.keys()],
  };
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
    const rawBody = await request.clone().text();

    console.info("Tilda webhook request received", {
      method: request.method,
      path: request.nextUrl.pathname,
      headers: summarizeHeaders(request),
      rawBody,
    });

    const token = getTildaWebhookToken(request);

    if (token !== getTildaWebhookSecret()) {
      console.warn("Tilda webhook unauthorized", {
        receivedToken: maskToken(token),
        headers: summarizeHeaders(request),
      });
      return textResponse("ok", 200);
    }

    const formData = await request.formData();
    const payload = parseTildaFormData(formData);

    console.info("Tilda webhook parsed payload", {
      tranId: payload.tranId,
      formId: payload.formId,
      sessionId: payload.sessionId,
      courseExternalId: payload.courseExternalId,
      courseTitle: payload.courseTitle,
      rawPayload: payload.rawPayload,
    });

    if (!payload.tranId || !payload.sessionId || !payload.courseExternalId) {
      console.warn("Tilda webhook missing required fields", {
        tranId: payload.tranId,
        sessionId: payload.sessionId,
        courseExternalId: payload.courseExternalId,
        rawPayload: payload.rawPayload,
      });
      return textResponse("ok", 200);
    }

    const client = createSupabaseAdminClient();

    await ensureBrowserSessionExists(client, payload.sessionId);
    const matchStatus = await upsertTildaSubmission(client, {
      tranId: payload.tranId,
      formId: payload.formId,
      sessionId: payload.sessionId,
      courseExternalId: payload.courseExternalId,
      courseTitle: payload.courseTitle,
      rawPayload: payload.rawPayload,
    });

    console.info("Tilda webhook stored submission", {
      tranId: payload.tranId,
      sessionId: payload.sessionId,
      courseExternalId: payload.courseExternalId,
      matchStatus,
    });

    return textResponse("ok", 200);
  } catch (error) {
    console.error("Tilda webhook error", error);
    return textResponse("ok", 200);
  }
}
