# Seguimiento de interesados

La sección web `/dashboard/contactos` permite al anunciante consultar sus interesados y al agente consultar solo los interesados que una empresa le haya asignado explícitamente. Asignar una propiedad no comparte sus consultas automáticamente.

Estados: Nuevo, Contactado, Visita agendada, En negociación y Cerrado. «Visita agendada» es un estado comercial: no crea ni confirma una reserva en la Agenda. El anunciante conserva el control de la asignación; el agente puede cambiar el estado y agregar notas internas de las consultas que tiene asignadas. La administración puede supervisarlas.

Antes del despliegue, ejecutar `database/INTERESADOS_EQUIPO.sql` después de `EQUIPOS_CORREDORAS.sql`. Crea tres tablas y conserva las consultas y notas existentes. Puede repetirse sin sobrescribir el seguimiento nuevo.

El estado detallado se guarda por separado y sincroniza el estado anterior de la consulta (`new`, `contacted`, `closed`) para mantener los indicadores y los clientes anteriores. Los cambios hechos desde la API anterior también actualizan el seguimiento. Se comprueba la revisión para impedir que una edición desactualizada sobrescriba otra.

Las asignaciones solo admiten agentes activos de la misma empresa aprobada. Reasignar, desasignar o retirar del equipo corta el acceso a la consulta y sus notas. Retirar del equipo elimina las asignaciones y registra la retirada, por lo que aceptar otra invitación no restaura los interesados anteriores. El historial registra quién cambió el estado o el responsable; las notas no se envían al interesado.

Se muestran las 200 consultas más recientes accesibles para la cuenta. Si hay más, la pantalla avisa; sus indicadores y filtros corresponden al listado visible. Los avisos automáticos al asignar y los recordatorios comerciales quedan para una siguiente etapa. Esta actualización web no requiere instalar un APK.

Validación: `backend/test/inquiry-workflow.integration.cjs` utiliza exclusivamente el MySQL local de QA en 127.0.0.1:3317, verifica su directorio de datos y elimina solo sus fixtures al finalizar. No envía correos ni notificaciones.
