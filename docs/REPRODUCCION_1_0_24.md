# Reproducción y portadas · Proppix 1.0.24

## Medición

Se hicieron 12 muestras HTTP por recurso, sobre seis videos públicos, desde el computador de desarrollo hacia DigitalOcean. Las medianas fueron: portada 488 ms; manifiesto HLS 490 ms; lista de calidad 499 ms; primer segmento de calidad menor 1.074 ms. Los percentiles 95 fueron 785, 761, 803 y 1.907 ms respectivamente. La petición inicial del feed tardó 1.010 ms. El informe detallado está en `tmp/video-network-measurements.json`; puede repetirse con `scripts/mobile/measure-video-network.cjs`.

Esto mide red desde este equipo, no el decodificador del teléfono ni una mejora porcentual antes/después. Las peticiones repetidas reutilizan conexiones; no se afirma que representen una caché CDN fría o caliente.

La app registra localmente hasta 200 muestras de preparación del reproductor y espera del primer fotograma desde su activación. Cuenta → **Ver tiempos de reproducción** muestra medianas separadas con/sin precarga. Un fotograma previamente decodificado puede registrar 0 ms de espera desde activación; no significa que descargar el video haya tomado cero tiempo. No se envían métricas a servidores y los registros no contienen URLs, tokens, nombres ni identificadores de videos.

## Cambios

- Portada persistente debajo de la superficie del video. Se elimina el efecto de aparición de Android y el video solo se hace opaco al recibir `onFirstFrameRender`.
- El feed y la galería incluyen una portada JPEG de hasta 32×64 píxeles, preservando proporciones, para evitar una petición adicional antes de mostrar una imagen. Se limita su tamaño y se conserva la imagen completa como mejora posterior. Las autorizaciones del feed/galería/vista previa se comprueban antes de incluir portadas privadas.
- Se anticipan las portadas de cuatro próximos elementos sin esperar al reproductor. El siguiente video puede empezar a prepararse con 2,5 segundos de reserva; un segundo vecino necesita seis. Hay umbrales de recuperación y los pendientes se cancelan si se queda sin reserva el video visible.
- Se conservan vecinos ya preparados durante cambios rápidos, y se monta la superficie del vecino inmediato en pausa para preparar su primer fotograma. Un mismo reproductor no se conecta a dos superficies cuando el feed repite un video.
- El visor del perfil también conserva portada y prepara el siguiente elemento. Los límites de memoria y de reproductores se mantienen acotados.
- Los indicadores de carga solo aparecen si la espera supera 700 ms, evitando destellos breves sobre la portada.

Una primera visita con caché vacía o una conexión insuficiente todavía puede necesitar espera. Una portada evita el negro, pero no reemplaza la descarga. No se promete tiempo cero ni se afirma equivalencia de infraestructura con Instagram o TikTok.

## Entrega y comprobación

No necesita SQL nuevo. Backend: portadas incluidas en las respuestas, con cacheado acotado en memoria. App: APK 1.0.24, código 25, compilado y firmado localmente.

Validación: TypeScript y lint móvil, 189 pruebas unitarias backend, regresión general de 323 comprobaciones, prueba local de portadas públicas/privadas (15 comprobaciones), pruebas de ciclo de precarga, temporización, propiedad única de superficie, tamaños de portada y límites de diagnósticos. La fluidez y el primer fotograma reales del teléfono deben comprobarse después de instalar el APK; no se midieron mediante la prueba HTTP.
