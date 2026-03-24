import { queryOptions } from "@tanstack/react-query";
import {
  fetchTelegramBootstrap,
  type TelegramBootstrapRequest,
} from "@/lib/api/telegram";
import { queryKeys } from "@/lib/query/query-keys";

export function getTelegramBootstrapQueryOptions(
  request: TelegramBootstrapRequest,
) {
  return queryOptions({
    queryKey: queryKeys.telegramBootstrap(request.initData, request.startParam),
    queryFn: ({ signal }) => fetchTelegramBootstrap(request, signal),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });
}
