export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function readErrorMessage(response: Response, fallbackMessage: string) {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    try {
      const payload = (await response.json()) as { error?: unknown };

      if (typeof payload.error === "string" && payload.error.trim()) {
        return payload.error;
      }
    } catch {
      return fallbackMessage;
    }
  }

  try {
    const body = await response.text();
    return body || fallbackMessage;
  } catch {
    return fallbackMessage;
  }
}

export async function postJson<TResponse, TRequest>(
  url: string,
  body: TRequest,
  options?: {
    signal?: AbortSignal;
    fallbackMessage?: string;
  },
): Promise<TResponse> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: options?.signal,
  });

  if (!response.ok) {
    throw new ApiError(
      await readErrorMessage(
        response,
        options?.fallbackMessage ?? "Не удалось выполнить запрос.",
      ),
      response.status,
    );
  }

  return (await response.json()) as TResponse;
}
