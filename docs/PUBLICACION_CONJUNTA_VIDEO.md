# Publicación conjunta de propiedad y video

La app registra el video de origen antes de enviar la propiedad a revisión. Al aprobar la propiedad, el backend publica ese video en la misma transacción, sin exigir el botón «Publicar video» del panel.

## Activación

1. Ejecutar `database/PUBLICACION_CONJUNTA_VIDEO.sql` en la base `propiedades` de DigitalOcean. Es repetible y no cambia los estados de videos existentes.
2. Desplegar backend. `/videos/capabilities` debe informar `automatic_property_publication: true`.
3. Instalar el APK 1.0.33 para el orden actualizado, la intención explícita y el mensaje de confirmación.

Los clientes anteriores también registran la intención cuando enlazan el video a una propiedad en borrador o revisión. La versión 1.0.33 registra el vínculo antes del envío y cubre además una aprobación simultánea al vínculo.

## Comportamiento

- Guardar como borrador conserva privados la propiedad y el video. Si luego se envía y aprueba esa propiedad, se publica su video de origen.
- Enviar a revisión mantiene el video privado hasta la aprobación.
- Aprobar publica la propiedad y únicamente los videos con intención registrada para esa misma propiedad.
- Un video marcado manualmente como borrador o archivado cancela su publicación automática. Editar solo el título conserva la intención.
- Los videos ocultos por moderación, archivados o de cuentas inactivas no se publican automáticamente.
- Desvincular cancela la intención y deja el video como borrador. Revincular registra la nueva propiedad.
- Vincular un borrador a una propiedad ya publicada sin intención explícita no lo publica. Con `publish_with_property: true`, se publica únicamente ese video si cumple las condiciones.
- No se convierten automáticamente borradores históricos que no tienen una intención registrada.
- Una propiedad pendiente, rechazada, pausada o en borrador nunca expone sus videos en el acceso público.

La tabla almacena una intención por video. La aprobación consume la intención; repetir la aprobación no vuelve a publicar borradores que el usuario haya elegido después. Si falla la transacción, no queda aprobada la propiedad con el video pendiente por un guardado parcial.

## Comprobaciones

- `npm --prefix backend test`
- `npm --prefix backend run build`
- `node scripts/mobile/verify-property-video-approval.cjs` con `node scripts/mobile/local.cjs` iniciado. Valida migración repetida, flujo nuevo y anterior, borradores manuales, moderación, desvinculación y aprobación concurrente, solo en el sandbox aislado.
- `npm --prefix mobile run check` y `npm --prefix mobile run lint`.
