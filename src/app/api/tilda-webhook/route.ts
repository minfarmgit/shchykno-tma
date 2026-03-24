import { NextRequest } from "next/server";
import {
  ensureBrowserSessionExists,
  grantCourseAccessForSession,
  listCourseMatchCandidates,
  upsertTildaSubmission,
} from "@/lib/db";
import { getTildaWebhookSecret } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { normalizeCourseMatchText, parseTildaFormData } from "@/lib/tilda";

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

function getPositiveProducts(
  products: ReturnType<typeof parseTildaFormData>["products"],
) {
  return products.filter(
    (product) => product.title && (product.quantity === null || product.quantity > 0),
  );
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
    const positiveProducts = getPositiveProducts(payload.products);

    console.info("Tilda webhook parsed payload", {
      tranId: payload.tranId,
      formId: payload.formId,
      sessionId: payload.sessionId,
      phoneNumber: payload.phoneNumber,
      products: payload.products,
      rawPayload: payload.rawPayload,
    });

    const client = createSupabaseAdminClient();

    if (payload.sessionId) {
      await ensureBrowserSessionExists(client, payload.sessionId);
    }

    const courseCandidates = await listCourseMatchCandidates(client);
    const courseCandidatesByNormalizedTitle = new Map(
      courseCandidates.map((course) => [
        normalizeCourseMatchText(course.tilda_product_name ?? course.title),
        course,
      ]),
    );
    const matchedProducts = positiveProducts.flatMap((product) => {
      const matchedCourse = courseCandidatesByNormalizedTitle.get(
        normalizeCourseMatchText(product.title),
      );

      if (!matchedCourse || !product.title) {
        return [];
      }

      return [
        {
          courseExternalId: matchedCourse.external_id,
          courseTitle: matchedCourse.title,
          productName: product.title,
        },
      ];
    });

    console.info("Tilda webhook product match result", {
      tranId: payload.tranId,
      sessionId: payload.sessionId,
      phoneNumber: payload.phoneNumber,
      positiveProducts,
      matchedProducts,
    });

    if (payload.tranId) {
      const firstMatchedProduct = matchedProducts[0] ?? null;
      const firstPositiveProduct = positiveProducts[0] ?? null;

      const matchStatus = await upsertTildaSubmission(client, {
        tranId: payload.tranId,
        formId: payload.formId,
        sessionId: payload.sessionId,
        phoneNumber: payload.phoneNumber,
        courseExternalId: firstMatchedProduct?.courseExternalId ?? null,
        courseTitle: firstMatchedProduct?.courseTitle ?? firstPositiveProduct?.title ?? null,
        productNames: positiveProducts.flatMap((product) => (product.title ? [product.title] : [])),
        matchedCourseExternalIds: matchedProducts.map((product) => product.courseExternalId),
        rawPayload: payload.rawPayload,
      });

      console.info("Tilda webhook stored submission", {
        tranId: payload.tranId,
        sessionId: payload.sessionId,
        phoneNumber: payload.phoneNumber,
        matchedProducts,
        matchStatus,
      });
    }

    if (!payload.sessionId || matchedProducts.length === 0) {
      console.warn("Tilda webhook skipped access grant", {
        tranId: payload.tranId,
        sessionId: payload.sessionId,
        phoneNumber: payload.phoneNumber,
        positiveProducts,
        matchedProducts,
        rawPayload: payload.rawPayload,
      });
      return textResponse("ok", 200);
    }

    await grantCourseAccessForSession(client, {
      sessionId: payload.sessionId,
      tranId: payload.tranId,
      items: matchedProducts.map((product) => ({
        courseExternalId: product.courseExternalId,
        productName: product.productName,
      })),
    });

    console.info("Tilda webhook granted course access", {
      tranId: payload.tranId,
      sessionId: payload.sessionId,
      matchedProducts,
    });

    return textResponse("ok", 200);
  } catch (error) {
    console.error("Tilda webhook error", error);
    return textResponse("ok", 200);
  }
}
