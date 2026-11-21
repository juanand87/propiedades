export function isNetworkFailure(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message === connectionMessage ||
    error instanceof TypeError ||
    /UnknownHostException|Unable to resolve host|No address associated|Network request failed|fetch failed|Failed to fetch|ENOTFOUND|ECONN|ETIMEDOUT|ERR_NETWORK|network connection|internet connection/i.test(
      message,
    )
  );
}
export const connectionMessage =
  "No pudimos conectar con Proppix. Revisa tu conexión a internet y vuelve a intentarlo.";
