# Imágenes privadas de Propiedades en Spaces

La integración utiliza exclusivamente el bucket `propiedades-imagenes` en `sfo3`. Las nuevas imágenes se optimizan a WebP, se guardan privadas y se relacionan con su propietario en la BD `propiedades`. Las imágenes antiguas guardadas en MySQL siguen funcionando. No se migran automáticamente ni se modifica el almacenamiento de videos.

## Activar en DigitalOcean App Platform

El usuario informó que ya aplicó `database/SPACES_IMAGENES_PROPIEDADES.sql` a la BD de Propiedades. Este archivo crea únicamente la tabla de referencias; no altera ni borra imágenes existentes. El despliegue no ejecuta migraciones.

En **Propiedades → Settings → componente Web Service → Environment Variables**, establecer como variables **Run time**:

```dotenv
NODE_ENV=production
SPACES_IMAGES_ENABLED=true
SPACES_BUCKET=propiedades-imagenes
SPACES_REGION=sfo3
SPACES_ENDPOINT=https://sfo3.digitaloceanspaces.com
SPACES_IMAGES_PREFIX=propiedades/imagenes
SPACES_ACCESS_KEY_ID=valor_privado
SPACES_SECRET_ACCESS_KEY=valor_privado
```

Marcar ambas claves como cifradas. No agregarlas a Vercel, Next.js, la app móvil ni Git. No se necesita un token de cuenta DigitalOcean: se usa una clave de Spaces limitada al bucket, con permisos Read/Write/Delete. Mantener `INTEGRATIONS_ENABLED=false`; la única excepción de red nueva es HTTPS al host exacto `propiedades-imagenes.sfo3.digitaloceanspaces.com`.

Guardar y desplegar después de publicar este código. La respuesta de `/api/ready` debe contener `schemaReady: true` e `imageStorage: { version: 1, provider: "spaces" }`. Si indica `database`, el código nuevo está disponible pero el almacenamiento sigue sin activarse. Si la tabla falta con Spaces activado, readiness falla para evitar aceptar cargas que no pueden registrarse.

## Permisos y visualización

Se mantienen las URLs `/api/media/:id` de web y app. NestJS comprueba los permisos existentes y después redirige a una URL privada firmada por 60 segundos, sin caché persistente. Una foto de una propiedad pausada deja de obtener enlaces públicos nuevos. Un enlace firmado que ya se entregó puede seguir usándose durante sus segundos restantes.

Las fotos privadas de la biblioteca requieren la firma de propietario existente. Otras cuentas no pueden ver ni borrar imágenes ajenas. Las imágenes en uso no pueden borrarse. No se usan objetos públicos ni políticas de bucket generales.

El CDN puede seguir habilitado, pero esta versión utiliza enlaces firmados del origen y no promete ahorro por caché CDN. No hacen falta nuevas reglas CORS para este flujo de carga mediante NestJS y visualización con Image o img.

## Fallos y limpieza

Las referencias tienen estado uploading, ready o pending_delete. La confirmación de biblioteca y referencia ready es transaccional. Si falla la operación, se intenta limpiar el objeto sin eliminar un archivo ya confirmado ante una respuesta de commit perdida. Si no puede comprobarse el estado o no responde Spaces, se conserva la referencia para recuperación.

Al borrar una imagen libre se retira su registro visible y luego el objeto. Si falla la retirada remota, la API devuelve `cleanup_pending: true` y conserva su clave; esa limpieza debe reintentarse desde una tarea revisada con las mismas restricciones de bucket y prefijo. No se ejecuta una tarea automática ni se borran objetos existentes durante el despliegue.

## Pruebas

```powershell
cd backend
npm ci --include=dev
npm run build
npm test -- --silent
```

`npm run spaces:check` lee únicamente las cinco variables de Spaces del `.env` local, no abre ninguna BD y prueba un objeto temporal bajo `propiedades/pruebas/imagenes/`. Verifica contenido, lectura firmada, acceso anónimo bloqueado y eliminación del mismo archivo. La prueba requiere las claves privadas locales; no deben incluirse en el repositorio.

Las pruebas completas de integración se ejecutaron con una BD MySQL local descartable, nunca con producción. Desarrollo solo permite el prefijo `propiedades/pruebas/imagenes`; producción utiliza `propiedades/imagenes`.

Referencias: [Spaces y SDK S3](https://docs.digitalocean.com/products/spaces/reference/aws-sdks/), [claves limitadas](https://docs.digitalocean.com/products/spaces/how-to/manage-access/).
