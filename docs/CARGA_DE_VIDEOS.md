# Carga y procesamiento de videos · Android 1.0.35

La transferencia sigue protegida en pantalla. El 100 % significa bytes enviados; se muestra **Confirmando la carga** hasta que el backend confirme que guardó el original privado y el trabajo en SQL. Después aparece **Estamos procesando tu video** con **Esperar aquí** o **Avísame cuando esté listo**.

El procesamiento continúa en el servidor aunque se cierre la app. El aviso usa Firebase directamente, sin Expo Push Service ni EAS. Al tocarlo abre `/carga-video/[uploadId]`, incluso con inicio en frío después de recuperar la sesión. El servidor exige que sea la cuenta que cargó el video. Se muestra la vista previa y se puede publicar, dejar como borrador, agregar datos de propiedad o vincular una existente.

## Cola persistente

- `POST /manage/video-uploads` recibe el original y conserva título, propiedad opcional, decisión de publicación e identificador idempotente. Los APK viejos siguen usando sus rutas existentes.
- La cola procesa compresión y portada, y espera HLS. Si HLS agota sus reintentos, conserva el MP4 válido como respaldo.
- Un reinicio retoma el original. Si el video ya se guardó, recupera el recibo en vez de duplicarlo.
- Los fallos temporales se reintentan. Los fallos definitivos se muestran y permiten reintentar el procesamiento después de 30 segundos, sin reenviar el archivo.
- Se elimina el original de trabajo al completar el video; los originales fallidos se conservan hasta siete días para reintentar.
- Solo se confirma el aviso después de verificar el permiso, registrar el dispositivo y activar el aviso en SQL. También se avisa si el procesamiento falla.
- Los errores de FCM dejan el aviso pendiente con espera creciente. La entrega es al menos una vez; un fallo entre aceptación de FCM y confirmación SQL puede repetir el sonido. El tag estable por carga evita varias tarjetas del mismo trabajo.

## Activación y verificación

Ejecutar `database/PROCESAMIENTO_VIDEOS.sql` en `propiedades`, desplegar backend e instalar APK 1.0.35. La migración es repetible y crea una tabla. `/api/videos/capabilities` debe indicar `background_processing: true`. Usa las configuraciones existentes de Spaces, HLS y Firebase; no necesita claves nuevas.

`verify-video-processing.cjs` prueba SQL aislado, MP4 real, compresión, HLS, recuperación tras reinicio, idempotencia, privacidad, aviso diferido y reintentos. No contacta producción ni Firebase. `video-upload-push.spec.ts` verifica los mensajes FCM y sus destinos. También se ejecutan build, pruebas del backend, tipos y lint móvil, `verify-video-upload.cjs` y `verify-notification-destination.cjs`.

## Histórico: comportamiento de Android 1.0.34

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
