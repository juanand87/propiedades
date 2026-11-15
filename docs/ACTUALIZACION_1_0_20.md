# Proppix 1.0.20

- Inicio: deslizar claramente hacia la izquierda abre Propiedades. El gesto horizontal no captura el desplazamiento vertical entre videos ni los toques para pausar.
- Comentarios: fondo blanco, texto azul, detalles celestes y comentario destacado con fondo azul muy claro. El campo y el botón de envío respetan el borde inferior y el espacio ocupado por el teclado.
- HLS: Inicio entrega el reproductor precargado de la dirección HLS correcta; antes lo comparaba con la dirección MP4 y descartaba el reproductor.
- Precarga: el video visible tiene prioridad. Se comienza a preparar hasta dos siguientes después de acumular seis segundos de reserva, o cargar por completo un video más corto. Si quedan menos de dos segundos o vuelve a cargar, se liberan los reproductores vecinos para cancelar descargas competidoras. Cada vecino prepara aproximadamente dos segundos; los segmentos pueden superar esa duración ligeramente.
- Errores temporales de conexión conservan HLS. El MP4 queda como alternativa automática únicamente cuando el error indica un HLS inexistente o incompatible. Reintentar conserva el origen HLS en lugar de forzar MP4.

La calidad continúa a cargo del reproductor HLS adaptativo. No hay una calidad fija impuesta desde la app. Los videos ya convertidos ofrecen tres variantes: 360, 540 y 720. Una conexión más lenta que la variante menor aún puede necesitar pausas; sin conexión no es posible descargar contenido nuevo.

## Verificación

- TypeScript y lint móvil.
- `scripts/mobile/verify-hls-source.cjs`: 41 comprobaciones de origen HLS, enlace de reproductor preparado, política de reserva, errores temporales, gestos y direcciones permitidas.
- `scripts/mobile/verify-preload-policy.cjs`: ciclo real del hook con reproductores nativos simulados; comprueba cuándo se crean/liberan vecinos, cancelación por falta de reserva, alternativa MP4 y limpieza al desmontar.
- Comprobación de solo lectura en producción: 10/10 videos de la página consultada tenían HLS; el manifiesto, las tres listas y sus primeros segmentos respondieron 200. Segmentos de muestra: 139.120, 225.976 y 377.128 bytes.
- Compilación y firma locales, paquete `cl.proppix.app`, versión 1.0.20, código 21. Requiere instalar el APK nuevo.

No había teléfono ni emulador conectado. Pendiente verificar físicamente el gesto, el teclado y los cambios de calidad bajo señal débil. La prueba de segmentos demuestra disponibilidad del servidor, no una medición de adaptación del teléfono.
