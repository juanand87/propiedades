# Agenda de visitas · Proppix 1.0.19

## Uso

- En una propiedad real publicada: **Agendar visita**. El comprador elige fecha y hora, agrega una nota opcional y autoriza compartir sus datos de contacto con el vendedor.
- En el menú de la app: **Mis visitas**. En Mensajes: **Ver agenda de visitas**. Los eventos de la agenda aparecen en la conversación y abren la visita correspondiente.
- La contraparte confirma, rechaza o propone otro horario. Quien hizo la última propuesta no puede confirmarla. Cualquiera de las partes puede cancelar una visita pendiente o confirmada. El vendedor puede marcarla realizada después del inicio.
- En el panel web: **Visitas**. El vendedor gestiona sus visitas; administración revisa todas y puede cancelar, sin confirmar en nombre de las partes. Las solicitudes antiguas conservan su sección y controles.

Todos los horarios se muestran e interpretan en **America/Santiago**, con cambios estacionales, aunque el teléfono esté en otra zona. Cada visita dura 30 minutos. Se admiten solicitudes desde una hora hasta 180 días por adelantado. Los horarios ambiguos o inexistentes durante cambios de hora se rechazan.

## Notificaciones

Firebase directo avisa solicitudes, propuestas, confirmaciones, rechazos y cancelaciones a la contraparte. Las visitas confirmadas generan recordatorios 24 horas y una hora antes si esos momentos todavía son futuros al confirmar. Tocar el aviso abre la visita en la app 1.0.19.

Las notificaciones se guardan en una cola transaccional y se reintentan ante fallos temporales. Cada versión invalida avisos pendientes de versiones anteriores. Antes de enviar, se vuelven a comprobar cuentas, bloqueos y versión. No se incluyen direcciones ni datos de contacto en la pantalla bloqueada. Los recordatorios se omiten si la propiedad dejó de estar publicada y disponible; la visita sigue en el historial y puede cancelarse. No se cancela automáticamente por retirar la propiedad.

## Instalación y despliegue

1. Ejecutar `database/AGENDA_VISITAS.sql` en la base `propiedades` de DigitalOcean. Cinco tablas nuevas, repetible, sin borrar ni migrar solicitudes anteriores.
2. Desplegar backend y panel web. `GET /api/visits/capabilities` debe devolver `enabled: true`.
3. Instalar el APK 1.0.19 compilado localmente, con el mismo paquete y firma. Se mantiene la configuración FCM existente; no usa Expo Push ni compilación en la nube.

No hay integración con calendarios externos ni disponibilidad semanal del vendedor en esta versión. Las solicitudes pendientes no reservan horario. Dos confirmaciones que se superponen para cualquiera de las dos personas no pueden prosperar: el backend serializa las operaciones y devuelve conflicto para la segunda. Los cambios requieren la versión vigente de la visita.

## Validación

- `scripts/mobile/verify-visits.cjs`: solo API 3328 y base local 3327, con comprobación del directorio de datos. Verifica migración repetida, autorización, idempotencia, propuestas, confirmaciones concurrentes, compatibilidad de consultas antiguas, enlaces del chat y SQL real de la cola con Firebase simulado.
- Pruebas unitarias de horarios de verano/invierno, cambios de hora, permisos, envíos, reintentos, eventos obsoletos y tokens retirados.
- Regresión general de propiedades y mensajes; compilaciones de backend, panel web y Android; TypeScript y lint móvil.

La entrega física de avisos y el selector nativo de fecha/hora deben comprobarse en el teléfono con dos cuentas. Las pruebas automáticas no envían notificaciones reales ni crean visitas en producción.
