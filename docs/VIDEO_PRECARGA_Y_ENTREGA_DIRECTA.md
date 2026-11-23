# Video: entrega directa y precarga ampliada · Android 1.0.37

El backend autoriza cada lista HLS y firma los fragmentos directamente para Spaces. Esto elimina la petición al backend, las consultas SQL y la redirección 307 por cada fragmento. Los MP4, los borradores y los objetos de Spaces conservan su privacidad. Las rutas antiguas siguen funcionando para clientes anteriores. No requiere SQL ni nuevas variables.

Las firmas de fragmentos duran 15 minutos, se estabilizan dentro del mismo minuto para reutilizar la caché del dispositivo y usan caché privada de 10 minutos. Las listas maestras y de calidad no se almacenan en cachés compartidas. No se cambian el códec, el tamaño, el bitrate ni las calidades existentes: se entregan los mismos bytes.

Spaces no almacena en su CDN las peticiones con URL prefirmada. Cambiar solo el dominio a CDN no mejora esa ruta privada: https://docs.digitalocean.com/products/spaces/how-to/manage-cdn-cache/. Esta implementación elimina saltos del backend y mejora el almacenamiento local sin hacer público el bucket.

En Android se conservan el video actual, el anterior y hasta cinco siguientes. Cada vecino intenta preparar 8 segundos (máximo 4 MB por reproductor); el actual intenta 20 segundos (máximo 12 MB). Son objetivos sujetos al contenido, red y reproductor, no garantía de reproducción instantánea en toda conexión. Caché de disco: 512 MB. Portadas y avatares: hasta diez siguientes.

Con más de 8 segundos en el video activo se habilitan cinco vecinos; con 5 segundos, tres; con 1,25 segundos, uno. Hay histéresis para evitar cancelar/recrear continuamente. Dos vecinos como máximo pueden estar pendientes de alcanzar su objetivo de ocho segundos. Si el activo empieza a cargar, se cancelan vecinos pendientes y se conservan los ya preparados. Solo las superficies adyacentes se conectan a vistas nativas para evitar duplicar decodificadores. HLS sigue eligiendo automáticamente la calidad y no se sustituye por MP4 ante mala señal.

Verificación: pruebas de almacenamiento y servicio HLS, `verify-preload-policy.cjs`, `verify-playback-measurements.cjs`, `verify-hls-source.cjs`, TypeScript y lint. `/api/videos/capabilities` anuncia `hls_direct_segments: true` tras desplegar. `measure-video-network.cjs` mide la red desde el equipo, sin registrar firmas ni simular métricas de primer fotograma de un teléfono. La experiencia final se debe verificar con APK 1.0.37 en el dispositivo.
