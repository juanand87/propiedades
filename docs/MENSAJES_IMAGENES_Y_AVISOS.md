# Mensajes: imágenes y avisos · Android 1.0.36

Ejecutar `database/IMAGENES_MENSAJES.sql` en `propiedades` antes de activar las imágenes. Crea una tabla repetible y conserva los mensajes. No necesita nuevas claves.

En el chat se puede seleccionar una imagen, revisar la miniatura, quitarla y enviarla sola o acompañada de texto. JPG, PNG y WebP hasta 8 MB; el servidor elimina metadatos, redimensiona a 1600 px y guarda WebP. Las imágenes del historial usan enlaces firmados de una hora y no son públicas por el hecho de enviarse. El historial verifica pertenencia a la conversación y no permite adjuntar archivos de otro usuario. Las imágenes enviadas quedan protegidas contra el borrado desde la biblioteca.

Los avisos de mensajes ya no se descartan si el sondeo del chat adelantó el cursor de lectura. Android muestra también avisos mientras esa conversación está abierta. La cola mantiene reintentos, controla dispositivos desregistrados y conserva el enlace para abrir la conversación. Se evita desregistrar accidentalmente el dispositivo cuando se renueva la sesión de la misma cuenta.

`/api/messages/capabilities` indica `images: true`, `push_worker_enabled: true` y `push.google_ready: true` en producción. La prueba manual de Firebase no sustituye la comprobación de entrega de un mensaje real.

Pruebas locales: `scripts/mobile/verify-message-images.cjs`, solo contra el sandbox 3327/3328. Verifica acceso, lectura sin firma rechazada, idempotencia, archivos ajenos, protección de borrado y entrega persistida aunque el mensaje esté leído. Firebase se sustituye únicamente en la prueba del trabajador para evitar avisos reales.

Prueba en teléfono: instalar APK 1.0.36 conservando la app anterior, iniciar sesión en dos cuentas con dispositivos registrados y enviar texto e imagen en ambos sentidos. Comprobar avisos con el chat abierto, en otra pantalla y con la app en segundo plano. Al pulsarlos debe abrirse la conversación correcta. La recepción real en dispositivos requiere esta comprobación con el usuario.
