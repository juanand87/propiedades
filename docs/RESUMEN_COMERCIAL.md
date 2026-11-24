# Resumen comercial de la empresa

El panel web muestra el resumen en `/dashboard`, junto a los indicadores de publicaciones existentes. Está disponible para perfiles Empresa / corredora con anunciante aprobado y cuenta activa. Se verifica el propietario en la base de datos; los agentes no reciben el informe global de la empresa ni los casos de sus compañeros. Un administrador con empresa propia recibe el resumen de esa empresa, sin ampliar el alcance a toda la plataforma.

No requiere migración ni actualización de APK: consulta las tablas ya existentes. `GET /api/commercial-summary/capabilities` confirma la disponibilidad; `GET /api/me/commercial-summary` y `/api/me/commercial-summary/cases` requieren sesión. El resumen obtiene sus agregados bajo una transacción REPEATABLE READ y no modifica datos.

Indicadores:

- Interesados nuevos: estado de seguimiento `new`, con respaldo del estado anterior si aún no tiene seguimiento.
- Interesados sin asignar: abiertos que no tienen un agente activo de la empresa. Las asignaciones revocadas, inválidas o con cuenta inactiva se consideran atención directa de la empresa.
- Tareas pendientes y vencidas: tareas pendientes de interesados abiertos; una vencida tiene fecha menor o igual a la hora actual.
- Negociaciones abiertas: estado de seguimiento `negotiation`.
- Visitas confirmadas: próximas reservas confirmadas en la agenda cuyo vendedor es el propietario de la empresa, más solicitudes antiguas confirmadas sin una reserva equivalente. No se cuenta dos veces el registro antiguo al enlazarlo con la agenda nueva; tampoco se cuenta el estado comercial manual «Visita agendada» como una reserva.

La tabla por responsable muestra interesados abiertos, nuevos, negociaciones, tareas pendientes y vencidas. Incluye agentes activos sin casos y una fila de Atención de la empresa. Los agregados de interesados y tareas se calculan por separado para evitar multiplicar los interesados que tengan varias tareas. Los indicadores generales incluyen todos los registros, sin el límite de 200 del listado anterior.

Cada indicador abre sus casos en páginas de 50. Las celdas de un agente filtran también por ese integrante, verificando que siga activo en el equipo de la empresa. El detalle abre la consulta o la visita autenticada correspondiente y vuelve a aplicar sus permisos normales. Los enlaces son identificadores internos validados, sin permitir destinos externos arbitrarios.

Validación: `backend/test/commercial-summary.integration.cjs` realiza 53 comprobaciones en el MySQL local de QA, con dos empresas y agentes ficticios. Comprueba aislamiento entre empresas, roles sin acceso, totales, agentes retirados, tareas múltiples por interesado, duplicados de agenda, visitas canceladas/pasadas y 207 interesados nuevos en cinco páginas. Verifica el puerto y directorio de la base antes de escribir y elimina sus fixtures al terminar. No envía correos ni notificaciones.
