# Videos de Propiedades en Spaces

La app y el recorrido web comparten la API de videos de NestJS. Cada video guarda `property_id` apuntando a una propiedad existente; no duplica sus datos. Los archivos MP4 se almacenan **privados** en el bucket exclusivo `propiedades-imagenes`, región `sfo3`, bajo una carpeta de videos independiente de las imágenes.

## Probar en el entorno local

Las cinco variables `SPACES_BUCKET`, `SPACES_REGION`, `SPACES_ENDPOINT`, `SPACES_ACCESS_KEY_ID`, `SPACES_SECRET_ACCESS_KEY` ya guardadas en `backend/.env` sirven también para videos. Solo el servidor lee las claves.

Desde la raíz, detener cualquier sesión móvil anterior e iniciar:

```powershell
npm run mobile:backend:video-spaces
```

El lanzador valida la instancia MySQL local en 127.0.0.1:3327 y `tmp/mobile-local/mysql-data`, instala allí las tablas y fuerza `propiedades/pruebas/videos`. No consulta ni modifica la BD de producción. En otra terminal:

```powershell
npm run mobile:test:video-spaces
npm run mobile:android
```

El API local devuelve `videoStorage: "spaces"` en `/api/mobile/environment`. Las nuevas grabaciones y MP4 subidos por la app se guardan en Spaces. Los videos anteriores de la demo no se migran: siguen reproduciéndose desde su carpeta local exclusivamente en el sandbox.

La app conserva su flujo de grabación de 15, 30 y 45 segundos, revisión, borrador y publicación inmediata. Al publicar, el backend exige que la propiedad esté publicada y que su anunciante esté aprobado y activo. Un corredor solo gestiona los videos de sus propias propiedades; el administrador puede gestionarlos todos.

## Activar en la web pública

Esta integración de videos requiere una migración **adicional** a la de imágenes. El despliegue no ejecuta SQL automáticamente.

1. Aplicar **`database/SPACES_VIDEOS_PROPIEDADES.sql`** únicamente en la BD `propiedades` con su usuario exclusivo. Crea `property_videos`, `property_video_recordings` y `property_video_objects`; no elimina ni altera propiedades, usuarios o imágenes existentes. Es repetible. Respaldar antes de DDL.
2. En el Web Service NestJS de Propiedades, añadir como variables **Run time**:

```dotenv
PROPERTY_VIDEOS_ENABLED=true
SPACES_VIDEOS_ENABLED=true
SPACES_VIDEOS_PREFIX=propiedades/videos
```

3. Mantener `NODE_ENV=production` y las cinco variables privadas de Spaces. Las dos claves deben estar cifradas. No cambiar `INTEGRATIONS_ENABLED=false`.
4. Guardar y desplegar. `/api/ready` debe responder `schemaReady: true` y `videoStorage: { version: 1, provider: "spaces" }`. Si falta el SQL, readiness falla antes de aceptar cargas. Sin activación explícita, los endpoints de video permanecen cerrados y la web conserva su recorrido de fotos.
5. La página **`/descubrir`** permite seleccionar **Fotos / Videos**. Videos se habilita cuando el backend anuncia esta función. Muestra precio, ubicación, favoritos y enlace a la ficha de la misma propiedad. Solo se carga y reproduce el video activo; se pausa al cambiar de tarjeta o esconder la pestaña. Incluye sonido, pausa y reintento de reproducción.

Para una app Android que use la BD pública, configurar explícitamente antes de compilar o reiniciar Expo:

```dotenv
EXPO_PUBLIC_ENV=production
EXPO_PUBLIC_API_URL=https://clownfish-app-2-bgbzm.ondigitalocean.app/api
```

El valor predeterminado de la app sigue siendo **local**. El comando `mobile:android` usa la API local para evitar mezclar datos de prueba con producción. La configuración de producción requiere iniciar Expo con esas variables, no mediante el lanzador local. La subida va directamente al backend de DigitalOcean, evitando pasar archivos grandes por Vercel. Las claves de Spaces nunca van dentro del APK ni en variables `EXPO_PUBLIC_`.

## Archivos, límites y permisos

- MP4/H.264, entre 1 y 45 segundos, hasta 50 MB y un máximo de cuatro videos activos por propiedad. El servidor comprueba el formato y duración real mediante ffprobe con protocolos de red bloqueados, timeout y salida acotada.
- Durante la subida se usa un archivo temporal para validar el video; al confirmar en Spaces se retira ese temporal. Un reinicio o redeploy del backend no pierde los videos guardados en Spaces.
- La referencia remota y los datos del video se confirman juntos. Los reintentos de la misma solicitud devuelven el video existente. Las copias remotas temporales de reintentos se limpian y las referencias incompletas quedan marcadas para recuperación si falla la red.
- La API comprueba visibilidad en cada petición de reproducción y entrega una redirección a una URL firmada de origen de 120 segundos. Range y HEAD funcionan; los objetos no admiten lectura anónima. Una URL ya entregada puede seguir funcionando hasta su expiración; pausar la propiedad bloquea nuevas autorizaciones.
- Un borrador no obtiene una URL pública. Archivar retira el video del feed e intenta eliminar el objeto. Si Spaces no responde se conserva `pending_delete` para una limpieza revisada, sin volver a exponerlo.
- Las pruebas solo usan `propiedades/pruebas/videos`; producción usa `propiedades/videos`. El guard de red permite únicamente HTTPS al bucket aprobado. Nada se conecta a infraestructura de MundoBeat.

El CDN puede permanecer activado, pero los enlaces firmados usados aquí son del origen privado. No se promete caché CDN ni transcodificación adaptativa en esta entrega.

## Comprobaciones

Prueba real con la BD local y el bucket de Propiedades: subida, hash del MP4, objeto privado, reproducción completa, streaming Range, HEAD, duración, misma propiedad en feed, otra cuenta bloqueada, reintentos idempotentes, propiedad pausada, borrador privado y eliminación al archivar. Se retiran los objetos creados por la prueba. La BD de producción no se utiliza para verificar esta integración.

Referencias: [Spaces y SDK S3](https://docs.digitalocean.com/products/spaces/reference/aws-sdks/) y [reproducción nativa Expo](https://docs.expo.dev/versions/v58.0.0/sdk/video/).
