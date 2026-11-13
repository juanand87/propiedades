# Actividad de Proppix

Desde el APK 1.0.15, la campana de Inicio y Propiedades y la opción Actividad del menú abren el historial de comentarios y respuestas. Fondo blanco, avatar sin animación, texto del comentario, video y fecha; los avisos sin leer aparecen resaltados. Incluye filtros Todas/Sin leer, actualización al deslizar y paginación de 20 avisos.

Cada aviso abre el video y resalta su comentario con la navegación de 1.0.14. Abrirlo lo marca como leído. Tocar un aviso push también marca su actividad correspondiente. Marcar leídas afecta únicamente a los avisos anteriores o iguales al primero de la lista cargada; no consume eventos que lleguen después. El contador se comprueba al cambiar de pantalla, volver al primer plano y cada 45 segundos mientras la app está activa.

## Activación

Ejecutar database/ACTIVIDAD_PROPPIX.sql en la base propiedades de DigitalOcean. La migración es repetible: crea estate_activity e importa comentarios anteriores como leídos. No cambia ni borra videos, comentarios o mensajes; repetirla conserva los estados de lectura existentes. Después desplegar el backend e instalar el APK 1.0.15.

Los nuevos avisos se guardan junto al comentario en la misma transacción, aunque no haya dispositivo registrado o Firebase no entregue el push. El dueño del video recibe comentarios y el autor del comentario padre recibe respuestas. Si ambos son el mismo usuario, se guarda una sola respuesta. Los eventos propios permanecen habilitados para las pruebas; PUSH_SELF_ACTIVITY_ENABLED=false los desactiva en adelante. Los mensajes privados conservan su bandeja Mensajes.

El historial muestra únicamente la actividad de la cuenta autenticada y el contenido al que sigue teniendo acceso. Omite videos archivados y autores desactivados. No utiliza la cola de entrega push como historial, porque esa cola se limpia y puede contener varios dispositivos por evento.

## API autenticada

- GET /api/me/activity?limit=20&before=ID&unread=true: lista con cursor, unread_count y next_cursor.
- POST /api/me/activity/:id/read: marca un aviso propio.
- POST /api/me/activity/read-all con through_id: marca avisos propios hasta ese ID.
- POST /api/me/activity/comments/:id/read: marca el aviso propio del comentario abierto desde un push.

## Verificación

scripts/mobile/verify-activity.cjs prueba con cuentas QA en la base aislada local: comentarios propios, deduplicación de respuestas, permisos, paginación, filtros, estados persistentes, migración repetible y marcado hasta el último aviso visto. Requiere el entorno scripts/mobile/local.cjs y los ejemplos de scripts/mobile/verify-social.cjs. Nunca conecta a producción.

En el teléfono: abrir la campana, verificar los avisos anteriores, crear un comentario propio y actualizar Actividad. Abrir el aviso, volver y comprobar Sin leer. Repetir con una respuesta y con Marcar leídas. La validación física se realiza después de instalar el APK.
