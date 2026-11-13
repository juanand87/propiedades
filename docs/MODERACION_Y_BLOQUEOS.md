# Bloqueos y reportes en Proppix

APK 1.0.18 y panel /panel/moderacion.

## App

Reportar aparece como una bandera en el video, en cada comentario, en perfiles ajenos y en la conversación. Requiere una cuenta. Se elige motivo y se pueden agregar detalles. El reporte no retira contenido automáticamente y no revela el denunciante a la cuenta reportada. Reportar el mismo contenido desde la misma cuenta reutiliza el reporte existente; hay un límite de 50 reportes nuevos por día para evitar spam.

Desde el mismo formulario se puede bloquear al autor. El bloqueo es bilateral para mensajes, seguimientos y visualización de videos/perfiles/comentarios en la cuenta autenticada. Elimina los seguimientos entre ambas cuentas, cancela avisos pendientes entre ellas y filtra actividad. Las conversaciones anteriores conservan su historial, pero quedan sin envío y se ocultan de la bandeja. Usuarios bloqueados, en el menú, permite deshacer los bloqueos propios; no restaura los seguimientos ni elimina un bloqueo que la otra cuenta haya establecido. El bloqueo personal no convierte contenido público en privado para visitantes anónimos ni impide contactos externos a Proppix.

## Panel

Moderación es exclusiva de administradores, tanto en la interfaz como en la API. Incluye pendientes, resueltos y descartados; motivo y detalles; copia del contenido al reportar; vista previa privada del video; y el historial del moderador, decisión, fecha y nota.

Decisiones: descartar, ocultar video/comentario o suspender usuario. Exigen una nota. La ocultación afecta al feed, galerías públicas, comentarios, avisos y reproducción pública MP4/HLS. El autor no puede eludirla volviendo a publicar. La suspensión usa el estado de cuenta existente y bloquea acceso autenticado y contenido público del usuario. Moderación no puede suspender administradores. Una revisión ya resuelta no puede sobrescribirse con otra revisión concurrente.

Se puede restaurar contenido o reactivar una cuenta suspendida desde moderación, dejando otra entrada de auditoría. Restaurar no cambia el estado de publicación elegido por el dueño: un borrador o video archivado sigue sin ser público. Se conserva la copia del reporte y las decisiones; no se elimina físicamente el contenido. El dueño y los administradores conservan las vistas previas privadas necesarias para revisión.

## Activación y pruebas

Ejecutar database/MODERACION_Y_BLOQUEOS.sql ANTES de desplegar el backend. La migración es repetible, crea cuatro tablas y no retira ningún contenido existente. Confirmada como ejecutada por el usuario. Instalar APK 1.0.18 y entrar al panel web con una cuenta administradora.

scripts/mobile/verify-moderation.cjs usa solo el sandbox local y cuentas QA: bloqueo bilateral, chat de solo lectura, filtros personales, reporte duplicado, contenido privado, permisos de administrador, retiro MP4/HLS, imposibilidad de republicar ocultaciones, revisión concurrente, restauraciones, suspensión, protección de administradores y auditoría. La migración se ejecuta dos veces y conserva las decisiones. Las pruebas existentes de notificaciones verifican las consultas reales con Firebase simulado; no envían mensajes externos.

En teléfono: reportar un video de prueba, revisarlo en el panel y ocultarlo/restaurarlo. Usar dos cuentas de prueba para bloquear, confirmar que no pueden enviarse mensajes ni seguirse y desbloquear desde el menú. El resultado visual del APK y la sesión administradora en producción se validan manualmente.
