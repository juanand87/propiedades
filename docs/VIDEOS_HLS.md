# HLS con calidad automática

APK 1.0.17: Inicio, perfiles y videos abiertos desde notificaciones prefieren HLS cuando el video ya está preparado. El reproductor nativo selecciona la calidad según conexión y búfer, sin fijar una pista manualmente. El MP4 original sigue disponible como respaldo y para descarga. La web conserva su reproducción MP4 compatible.

## Procesamiento

Ejecutar database/VIDEOS_HLS.sql en propiedades. La migración es repetible, conserva los originales y agrega los videos existentes a la cola. El backend la comprueba antes de usarla: si falta, la subida MP4 continúa funcionando. VIDEOS_HLS_ENABLED=false permite desactivar HLS sin borrar los archivos.

Se procesa un video por vez con un bloqueo MySQL compartido entre instancias. Los publicados tienen prioridad. El trabajador revisa la cola cada 10 segundos, guarda estado y reintentos y recupera tareas interrumpidas tras 10 minutos. Hace hasta cuatro intentos, con espera creciente. La generación es posterior a la subida: se puede guardar o publicar sin esperar todas las calidades. Los videos anteriores se convierten gradualmente.

Se generan hasta tres versiones: lado corto de 360, 540 y 720 píxeles, con lado largo máximo de 1280. Nunca se amplía la resolución original y se eliminan tamaños duplicados. Se conserva la orientación y proporción visual, normalizando píxeles no cuadrados; las dimensiones finales son pares. H.264 Main nivel 3.1, AAC de 96 kbps si el original tiene audio, y listas VOD con fragmentos MPEG-TS de aproximadamente 2 segundos y fotogramas clave alineados. Las tasas objetivo de video son 650, 1150 y 2100 kbps. La calidad disponible depende del original; un video pequeño puede tener una sola versión.

## Almacenamiento y acceso

Los fragmentos se guardan privados bajo el prefijo de videos propio de Proppix, dentro de hls/VIDEO_ID/GENERATION_ID/calidad. No se cambia la configuración pública del bucket ni se suben credenciales al APK. Las listas se generan en la API y validan nombres, duración y cantidad de fragmentos. La API comprueba los permisos antes de servir cada lista o redirigir un fragmento a Spaces con firma de 120 segundos. Los MP4 y los segmentos se transfieren desde Spaces, no a través del backend.

Los borradores requieren la misma firma de vista previa que el MP4, ligada al video y usuario y válida por dos minutos. Se revisan cuenta y propiedad del video en cada solicitud. Un video retirado deja de tener listas públicas; datos que el dispositivo ya descargó pueden seguir en su caché. Al archivar, el trabajador retira los segmentos generados. Las claves previstas se guardan antes de subirlas para poder limpiar subidas parciales en un reintento.

En Android se conserva la precarga del video actual y los dos siguientes y la caché local de 256 MB. En iOS HLS usa el búfer, sin caché persistente por la limitación de expo-video. Si HLS falla al reproducir, la app prueba el MP4. Si también falla el original, muestra el error y permite reintentar. No se obliga a descargar el video completo para comenzar.

## Verificación

- scripts/mobile/verify-hls.cjs: codifica un MP4 real con audio en tres calidades, descarga listas y fragmentos de la API local y decodifica cada calidad con FFmpeg. Verifica relación 9:16, píxeles cuadrados, audio, permisos, versiones, MP4 con Range, retiro y limpieza al archivar. Solo usa la base local aislada.
- scripts/mobile/verify-hls-source.cjs: fuentes de reproducción y validación de URLs sin red.
- Tests backend: planificación vertical/horizontal/rotada/anamórfica, límites, claves privadas, listas y reintentos duraderos.

La prueba física debe comprobar Inicio y un video del perfil con wifi y datos móviles. Cambiar de red durante un video permite observar si continúa; el cambio de calidad depende de la estimación del reproductor y no ocurre necesariamente al instante. El tiempo de preparación depende de la duración del video y CPU disponible en DigitalOcean; un servicio de procesamiento separado es una ampliación futura si crece la cola.
