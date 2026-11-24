# Seguimiento de interesados

La sección web `/dashboard/contactos` permite al anunciante consultar sus interesados y al agente consultar solo los interesados que una empresa le haya asignado explícitamente. Asignar una propiedad no comparte sus consultas automáticamente.

Estados: Nuevo, Contactado, Visita agendada, En negociación y Cerrado. «Visita agendada» es un estado comercial: no crea ni confirma una reserva en la Agenda. El anunciante conserva el control de la asignación; el agente puede cambiar el estado y agregar notas internas de las consultas que tiene asignadas. La administración puede supervisarlas.

Antes del despliegue, ejecutar `database/INTERESADOS_EQUIPO.sql` después de `EQUIPOS_CORREDORAS.sql`. Crea tres tablas y conserva las consultas y notas existentes. Puede repetirse sin sobrescribir el seguimiento nuevo.

El estado detallado se guarda por separado y sincroniza el estado anterior de la consulta (`new`, `contacted`, `closed`) para mantener los indicadores y los clientes anteriores. Los cambios hechos desde la API anterior también actualizan el seguimiento. Se comprueba la revisión para impedir que una edición desactualizada sobrescriba otra.

Las asignaciones solo admiten agentes activos de la misma empresa aprobada. Reasignar, desasignar o retirar del equipo corta el acceso a la consulta y sus notas. Retirar del equipo elimina las asignaciones y registra la retirada, por lo que aceptar otra invitación no restaura los interesados anteriores. El historial registra quién cambió el estado o el responsable; las notas no se envían al interesado.

Se muestran las 200 consultas más recientes accesibles para la cuenta. Si hay más, la pantalla avisa; sus indicadores y filtros corresponden al listado visible. La ficha directa por identificador puede abrir también una consulta anterior.

## Aviso al agente

Ejecutar `database/AVISOS_INTERESADOS.sql` antes del despliegue de los avisos. Cada nueva asignación crea un aviso en la misma transacción que el cambio de responsable. Repetir una asignación al mismo agente no genera otro aviso. No se envían avisos históricos por ejecutar la migración. La cola utiliza el trabajador de Firebase ya configurado, su exclusión mutua en MySQL y reintentos persistentes. Antes de expandir y enviar se valida el dispositivo, la cuenta, el equipo y la asignación vigente; un aviso anterior no revive si el interesado vuelve al mismo agente.

El aviso muestra texto genérico, sin nombre, teléfono, correo ni mensaje del interesado. La versión Android **1.0.45** agrega `Mis interesados` y abre la ficha correspondiente al tocarlo, incluso desde un arranque en frío después de recuperar la sesión. El servidor vuelve a comprobar el acceso al consultar o modificar la ficha. Se requiere instalar este APK para abrir el nuevo destino; se mantiene Firebase directo y compilación local, sin usar Expo Push Service ni EAS.

Los avisos se intentan durante 24 horas y se descartan si dejan de corresponder a la asignación vigente. No se generan mensajes para un agente sin dispositivo registrado. Los recordatorios por fecha y próxima acción quedan para una siguiente etapa.

Validación: `backend/test/inquiry-workflow.integration.cjs` utiliza exclusivamente el MySQL local de QA en 127.0.0.1:3317, verifica su directorio de datos y elimina solo sus fixtures al finalizar. No envía correos ni notificaciones.

`backend/test/inquiry-notices.integration.cjs` verifica la cola con Firebase simulado: atomicidad, idempotencia, reinicio, backoff, reasignación A-B-A, retirada, cambio de cuenta del dispositivo y token caducado. `push.service.spec.ts` comprueba el mensaje FCM y su etiqueta de Android; `scripts/mobile/verify-notification-destination.cjs` valida los destinos recibidos.
