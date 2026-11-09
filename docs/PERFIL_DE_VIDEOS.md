# Perfil de videos y galería Android

La pestaña **Perfil** sustituye Mis videos cuando `SOCIAL_VIDEOS_ENABLED=true` en Nest. Muestra nombre y foto editables, siguiendo, seguidores y me gusta reales. La galería de tres columnas abre el video en un reproductor vertical; deslizar cambia de video y solo se reproduce el activo. Las pestañas Guardados y Propiedades separan la colección de videos de la gestión inmobiliaria.

**Crear** permite grabar 15, 30 o 45 segundos o subir MP4/H.264 de hasta 50 MB sin tener propiedades. Cada video pertenece al usuario que lo creó y puede publicarse sin vínculo inmobiliario. En **Opciones → Editar** se cambia su título o estado y se vincula o desvincula una propiedad propia. Cambiar el vínculo devuelve el video a borrador. Cada propiedad sigue admitiendo cuatro videos activos; los vinculados solo se publican si la propiedad está publicada y el anunciante está aprobado y activo.

En los videos del recorrido y de la galería aparecen perfil del creador, seguir, me gusta, comentarios, guardar y opciones. Editar está reservado al creador o administrador. Compartir genera un enlace web al video publicado; los borradores no tienen enlace público. Descargar pide una carpeta en Android y guarda ahí el MP4, sin publicar el borrador. Los me gusta, seguimientos y guardados son idempotentes: repetir la misma petición no duplica contadores. Se exige sesión para participar. Los comentarios se limitan a 2000 caracteres y tienen límite de frecuencia por usuario.

## Activación en DigitalOcean

1. Respaldar la BD **propiedades** y ejecutar [PERFILES_Y_VIDEOS_SOCIALES.sql](../database/PERFILES_Y_VIDEOS_SOCIALES.sql) con su usuario exclusivo, después del SQL de Spaces/videos existente. El script admite `property_id=NULL` y agrega cinco tablas sociales. Conserva IDs, relaciones y archivos existentes; es repetible.
2. Desplegar backend y frontend juntos. El frontend acepta videos con y sin propiedad, incluidos enlaces compartidos `/descubrir?video=ID`.
3. Agregar `SOCIAL_VIDEOS_ENABLED=true` al backend con alcance Run time y desplegar. Mantener las variables de videos/Spaces existentes. No hay nuevas claves en Android.
4. Comprobar `/api/ready` y `/api/videos/capabilities`: `schemaReady=true`, `social=true`. Readiness rechaza una activación sin tablas o sin la columna nullable. Si falta el flag, Android conserva el flujo anterior.
5. Reiniciar Metro con `npm run mobile:android:production` y probar con cuentas reales de Propiedades. Los datos locales no se migran ni se copian a producción.

La demo `npm run mobile:backend` aplica la migración y activa el perfil automáticamente **solo en la instancia local 127.0.0.1:3327**. `node scripts/mobile/verify-social.cjs` verifica repetibilidad y preservación de la migración, guardado sin propiedad, reintentos, privacidad, galería, likes, seguidores, comentarios, guardados, foto, edición y vínculos. El script verifica puerto y datadir antes de ejecutar SQL y nunca se conecta a producción.

No ejecutar el verificador contra DigitalOcean. Los archivos QA y sus credenciales se conservan únicamente en `tmp/mobile-local` ignorado por Git.
