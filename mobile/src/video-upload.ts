import * as FileSystem from "expo-file-system/legacy";
import { api, API_URL, ApiError, refreshAccessToken } from "./api";
import { connectionMessage, isNetworkFailure } from "./network-error";

export type VideoUploadProgress = {
  phase: "connecting" | "uploading" | "processing" | "retrying";
  sent: number;
  total: number;
};
export async function uploadVideo<T>(options: {
  path: string;
  uri: string;
  token: string;
  parameters: Record<string, string>;
  onProgress: (progress: VideoUploadProgress) => void;
}): Promise<T> {
  if (
    !/^\/manage\/(videos|properties\/[a-f0-9-]{36}\/videos)$/i.test(
      options.path,
    )
  )
    throw new Error("Destino del video inválido.");
  if (!/^[a-f0-9-]{36}$/i.test(options.parameters.request_id || ""))
    throw new Error(
      "Falta el identificador del video para reintentar de forma segura.",
    );
  let token = options.token,
    renewed = false;
  for (let attempt = 0; attempt < 2; attempt++) {
    options.onProgress({
      phase: attempt ? "retrying" : "connecting",
      sent: 0,
      total: 0,
    });
    try {
      // Avoid sending a large file while the device cannot resolve/reach the API.
      await api("/ready", { retryInvalidResponse: false });
      const send = async () => {
        const task = FileSystem.createUploadTask(
          API_URL + options.path,
          options.uri,
          {
            httpMethod: "POST",
            uploadType: FileSystem.FileSystemUploadType.MULTIPART,
            fieldName: "file",
            mimeType: "video/mp4",
            parameters: options.parameters,
            headers: {
              Accept: "application/json",
              Authorization: `Bearer ${token}`,
            },
            sessionType: FileSystem.FileSystemSessionType.FOREGROUND,
          },
          ({ totalBytesSent: sent, totalBytesExpectedToSend: total }) => {
            options.onProgress({
              phase: total > 0 && sent >= total ? "processing" : "uploading",
              sent,
              total,
            });
          },
        );
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          return await Promise.race([
            task.uploadAsync(),
            new Promise<never>((_, reject) => {
              timer = setTimeout(() => {
                void task.cancelAsync().catch(() => undefined);
                reject(
                  new Error(
                    "La carga está tardando demasiado. Tu video sigue aquí y puedes reintentar.",
                  ),
                );
              }, 600000);
            }),
          ]);
        } finally {
          if (timer) clearTimeout(timer);
        }
      };
      let result = await send();
      if (result?.status === 401 && !renewed) {
        renewed = true;
        const nextToken = await refreshAccessToken(token);
        if (nextToken) {
          token = nextToken;
          result = await send();
        }
      }
      if (!result)
        throw new Error(
          "No se confirmó la carga. Tu video sigue aquí para reintentar.",
        );
      let body: { message?: string | string[] } & T;
      try {
        body = JSON.parse(result.body) as typeof body;
        if (!body || typeof body !== "object") throw new Error();
      } catch {
        throw new ApiError(
          "El servidor no confirmó el video. Puedes reintentar sin duplicarlo.",
          result.status,
        );
      }
      if (result.status < 200 || result.status >= 300)
        throw new ApiError(
          result.status === 401
            ? "La sesión venció. Vuelve a iniciar sesión para continuar."
            : Array.isArray(body.message)
              ? body.message.join(". ")
              : body.message ||
                "No se pudo guardar el video. Puedes reintentar.",
          result.status,
        );
      return body;
    } catch (error) {
      // Same request_id, file and publication choice on every attempt.
      if (isNetworkFailure(error) && attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        continue;
      }
      if (
        isNetworkFailure(error) ||
        (error instanceof Error && error.message === connectionMessage)
      )
        throw new Error(
          connectionMessage +
            " Tu video se conserva en esta pantalla para reintentar sin duplicarlo.",
        );
      throw error;
    }
  }
  throw new Error(connectionMessage);
}
