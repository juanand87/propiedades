# Carga de videos · Android 1.0.34

## Pantalla de progreso

Tanto los videos grabados como los elegidos de la galería muestran **Estamos cargando el video**, una barra y el porcentaje real de bytes enviados. La pantalla distingue conexión, transferencia, reconexión y procesamiento final del servidor.

El 100 % indica que terminó la transferencia, no que ya se confirmó el guardado. El usuario continúa únicamente después de que el servidor devuelve el identificador del video y su estado esperado.

La pantalla bloquea los controles y la navegación de la app durante la carga. No puede impedir los botones de inicio del sistema, el cierre forzado de Android ni que el sistema termine el proceso. Se indica mantener la app abierta.

## Conexión y reintentos

- Se comprueba la conexión antes de enviar el archivo.
- Se hace un segundo intento ante un fallo de conexión, conservando `request_id`, archivo, título y decisión de publicación.
- Los errores DNS y de red se muestran en español, sin excepciones Java ni direcciones técnicas.
- Si falla, se conserva la selección/grabación en la pantalla de revisión. El usuario puede reintentar sin duplicar el video gracias a la idempotencia del backend.
- Tras un resultado ambiguo no se modifica el título del mismo intento. Para cerrar se advierte revisar la galería antes de subirlo nuevamente.
- La sesión se renueva una vez si el servidor responde 401.
- La carga tiene un límite de diez minutos. Si vence, se cancela el transporte y se permite reintentar con el mismo identificador.

## Alcance

Se implementa carga protegida en pantalla. **No se ofrece un botón de carga en segundo plano ni una notificación de finalización.** Eso requiere un trabajo nativo persistente que sobreviva al cierre del proceso y permita recuperar el resultado. La transferencia nativa puede continuar mientras Android mantiene el proceso, pero no se promete esa garantía al usuario.

No se implementa recuperación del editor después de cerrar o reiniciar la app. La grabación/selección se conserva durante el reintento en la pantalla actual, igual que su identificador. No se afirma que un error DNS del teléfono pueda solucionarse sin recuperar la conexión del dispositivo.

No necesita migración ni variables nuevas. Requiere instalar el APK 1.0.34.

## Verificación

- `npm --prefix mobile run check`
- `npm --prefix mobile run lint`
- `node scripts/mobile/verify-video-upload.cjs` (transporte nativo simulado, sin subir archivos ni usar la red).
- Compilación Android local y validación del certificado, versión y API de producción.
