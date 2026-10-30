# Descuentos y compensaciones

Antes de desplegar, ejecutar `backend/sql/add-discounts.sql` en MySQL. La misma
estructura se incluye en la migracion `1790300000000-AddDiscounts.ts` para los
entornos que ejecutan migraciones TypeORM. Usar solo uno de los dos mecanismos.
No se modifica la estructura de pedidos ni se sobrescriben calificaciones.

- Administracion: `/panel/descuentos`, con acceso exclusivo para administradores.
- Recuperacion: `/dashboard/calificaciones`, para evaluaciones de 1 a 3 estrellas.
- Comprador: enlace firmado `/compensacion/:token` enviado por SMTP.
- Checkout: un codigo por tienda y pedido, sin descontar el envio.
- La tienda financia la rebaja. La comision se calcula sobre el subtotal rebajado.
- Cada comprador puede usar un codigo una sola vez. El cupo se reserva al crear
  el pedido, incluso si el pago queda pendiente. Reintentar el mismo pedido no
  consume otro uso. Los pedidos con cupon reservado conservan sus productos.
- Seleccionar categoria y genero exige que el producto cumpla ambas condiciones.
- La aceptacion del beneficio conserva las estrellas y el comentario, y abre
  siete dias para una actualizacion voluntaria. Se conserva la opinion original
  en el registro privado de compensacion.
- La compensacion vence a los 30 dias y no exige una nueva evaluacion.

Se requiere `REVIEW_TOKEN_SECRET` o `JWT_SECRET`, `FRONTEND_URL` y la configuracion
SMTP existente de MundoBeat. Las pruebas automatizadas no envian correos reales.
