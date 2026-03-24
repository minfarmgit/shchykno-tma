export const queryKeys = {
  telegramBootstrap: (initData: string, startParam: string | null) =>
    ["telegram", "bootstrap", initData, startParam ?? ""] as const,
};
