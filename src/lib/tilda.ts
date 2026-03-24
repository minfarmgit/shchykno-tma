export type TildaRawPayload = Record<string, string | string[]>;

interface ProductCandidate {
  index: number;
  externalId?: string;
  title?: string;
}

export interface TildaSubmissionPayload {
  tranId: string | null;
  formId: string | null;
  sessionId: string | null;
  courseExternalId: string | null;
  courseTitle: string | null;
  rawPayload: TildaRawPayload;
}

function normalizeEntryValue(value: FormDataEntryValue): string {
  return typeof value === "string" ? value : value.name;
}

function firstStringValue(payload: TildaRawPayload, keys: string[]): string | null {
  for (const key of keys) {
    const rawValue = payload[key];

    if (typeof rawValue === "string" && rawValue.trim()) {
      return rawValue.trim();
    }

    if (Array.isArray(rawValue)) {
      const firstValue = rawValue.find((value) => value.trim());

      if (firstValue) {
        return firstValue.trim();
      }
    }
  }

  return null;
}

function collectProducts(payload: TildaRawPayload): ProductCandidate[] {
  const productMap = new Map<number, ProductCandidate>();

  for (const [key, value] of Object.entries(payload)) {
    const match = key.match(/\[(\d+)\]\[([^\]]+)\]$/);

    if (!match) {
      continue;
    }

    const index = Number(match[1]);
    const field = match[2].toLowerCase();
    const fieldValue = Array.isArray(value) ? value[0] : value;
    const candidate = productMap.get(index) ?? { index };

    if (fieldValue) {
      if (field === "externalid" || field === "external_id") {
        candidate.externalId = fieldValue.trim();
      }

      if (["title", "name", "product", "productname"].includes(field)) {
        candidate.title = fieldValue.trim();
      }
    }

    productMap.set(index, candidate);
  }

  return [...productMap.values()].sort((left, right) => left.index - right.index);
}

export function normalizeSessionId(rawValue: string | null | undefined): string | null {
  if (!rawValue) {
    return null;
  }

  const trimmed = rawValue.trim();

  if (!trimmed || !/^[A-Za-z0-9_-]{6,128}$/.test(trimmed)) {
    return null;
  }

  return trimmed;
}

export function parseTildaFormData(formData: FormData): TildaSubmissionPayload {
  const rawPayload: TildaRawPayload = {};

  for (const [key, rawEntryValue] of formData.entries()) {
    const normalizedValue = normalizeEntryValue(rawEntryValue);
    const currentValue = rawPayload[key];

    if (currentValue === undefined) {
      rawPayload[key] = normalizedValue;
      continue;
    }

    if (Array.isArray(currentValue)) {
      rawPayload[key] = [...currentValue, normalizedValue];
      continue;
    }

    rawPayload[key] = [currentValue, normalizedValue];
  }

  const products = collectProducts(rawPayload);
  const firstProductWithExternalId = products.find((product) => product.externalId);

  return {
    tranId: firstStringValue(rawPayload, [
      "tranid",
      "transaction_id",
      "transactionid",
      "orderid",
    ]),
    formId: firstStringValue(rawPayload, ["formid", "form_id"]),
    sessionId: normalizeSessionId(
      firstStringValue(rawPayload, ["session_id", "sessionId", "sessionid"]),
    ),
    courseExternalId:
      firstProductWithExternalId?.externalId ??
      firstStringValue(rawPayload, [
        "externalid",
        "external_id",
        "course_external_id",
        "course_slug",
      ]),
    courseTitle:
      firstProductWithExternalId?.title ??
      firstStringValue(rawPayload, [
        "title",
        "name",
        "product",
        "product_name",
        "course_title",
      ]),
    rawPayload,
  };
}
