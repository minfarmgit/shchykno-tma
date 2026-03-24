"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchTelegramBootstrap } from "@/lib/api/telegram";
import { getTelegramBootstrapQueryOptions } from "@/lib/query/telegram-bootstrap";
import { queryKeys } from "@/lib/query/query-keys";
import { getTelegramBootstrapRequest } from "@/lib/telegram-webapp";

export function useTelegramBootstrap() {
  const request = getTelegramBootstrapRequest();
  const hasBootstrapSource = Boolean(request);

  const query = useQuery({
    ...(request
      ? getTelegramBootstrapQueryOptions(request)
      : {
          queryKey: queryKeys.telegramBootstrap("unavailable", null),
          queryFn: ({ signal }: { signal: AbortSignal }) =>
            fetchTelegramBootstrap(
              {
                initData: "",
                startParam: null,
              },
              signal,
            ),
          staleTime: 30_000,
          gcTime: 5 * 60_000,
        }),
    enabled: hasBootstrapSource,
  });

  return {
    ...query,
    request,
    hasBootstrapSource,
    isBootstrapPending: hasBootstrapSource ? query.isPending : false,
  };
}
