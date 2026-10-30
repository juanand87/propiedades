# Inventario fisico

## Activacion sin acceso directo a MySQL

1. Desplegar backend y frontend juntos, incluyendo las dependencias nuevas.
2. Entrar como administrador a `/panel/inventario`.
3. Pulsar **Preparar modulo** y confirmar. El backend usa su conexion actual y
   ejecuta exclusivamente el DDL fijo de `inventory-schema.ts`. El usuario MySQL
   necesita permiso CREATE. No se altera la tabla de productos ni el stock.
4. Las tiendas ya pueden entrar a `/dashboard/inventario` desde su menu.
5. Opcionalmente iniciar la indexacion de portadas en el mismo panel.

No activar `synchronize` de TypeORM. La instalacion es repetible y usa GET_LOCK;
si falla una sentencia, puede reintentarse. El marcador de version se escribe
al final. No existe un endpoint para ejecutar SQL arbitrario.

## Conteos

- Cada sesion guarda una referencia del stock y updatedAt. Incluye inactivos y
  agotados; excluye papelera. Puede limitarse por categoria y genero.
- Contar 1 suma solo al conteo fisico. Contar y agregar stock suma una unidad
  al conteo y al stock comercial inmediatamente, en una transaccion idempotente
  con bloqueo del producto. Actualiza la referencia y encola sincronizacion;
  el cierre no vuelve a sumar esa unidad. Cancelar el conteo no revierte estas
  altas de stock ya aplicadas. Registrar cero es distinto de dejar sin contar.
- Los reintentos de lecturas usan UUID y una transaccion con bloqueo de sesion.
  El telefono conserva la lectura pendiente en sessionStorage hasta confirmarla.
- Un producto sin ficha se registra primero. Puede vincularse, descartarse con
  motivo o crearse con el formulario existente del telefono. Por defecto se
  crea inactivo; publicar es una opcion explicita. Crear una ficha crea stock 1
  como en el alta habitual; el resto del conteo se ajusta al confirmar el cierre.
- El retorno usa el registro sin ficha como identificador idempotente: recargar
  el enlace no vuelve a sumar su cantidad ni crea de nuevo el producto.
- Antes de finalizar, resolver todos los registros sin ficha. Solo se aplican
  las diferencias seleccionadas. Los no contados/no seleccionados no cambian.
- El cuadro Ajustar de cada fila aplica inmediatamente el total contado,
  incluso cero, y encola sincronizacion. Bloquea producto y sesion, rechaza
  cambios externos y actualiza la referencia; reintentar no duplica el ajuste.
  Cancelar o finalizar el conteo no revierte ni repite estos ajustes aplicados.
- Si hubo una venta/edicion, el ajuste se bloquea. Volver a comprobar fisicamente,
  actualizar la referencia, guardar la cantidad y seleccionar de nuevo.
- El cierre actualiza los productos en una transaccion, con bloqueos ordenados
  por producto; encola en la misma transaccion la sincronizacion WooCommerce/ML.
  Una tarea procesa tres ajustes cada 30 segundos leyendo siempre el stock actual.
  La cola persiste entre reinicios; los errores inesperados tienen tres intentos
  y pueden reintentarse desde el resultado del conteo. El cierre no espera
  peticiones externas, evitando timeouts al ajustar muchos productos.
  Esos servicios mantienen sus propias reglas y registros de errores: finalizar
  inventario no garantiza que un tercero acepte la sincronizacion.

## Reconocimiento

CLIP vision q8, CPU, embeddings normalizados de 512 dimensiones. No usa una API
de IA de pago. Los vectores se guardan como float32 binario: 2048 bytes por
portada, sin contar indices. La primera inferencia descarga el modelo publico de Hugging Face.
Requiere salida HTTPS y escritura en `INVENTORY_MODEL_CACHE`, por defecto
`./.cache/inventory-models`; montar un volumen evita descargar en cada deploy.

La prueba local aislada uso aproximadamente 317 MB RSS; no equivale al consumo
total del backend en produccion. Reservar margen suficiente (recomendable 1 GB
libre como punto de partida) y medir el servicio real antes de activarlo.
Docker usa Debian/glibc y libgomp para ONNX; no volver a Alpine sin validar ONNX.

Indexacion desactivada inicialmente. Un proceso revisa hasta 250 productos por
minuto, y procesa hasta 3 portadas cada 20 segundos. Lee la primera imagen de
cada producto, evita recalcular si no cambio su URL/modelo, y recoge altas nuevas
en los siguientes recorridos. Cambiar el archivo bajo la misma URL requiere
usar una URL nueva. Se puede pausar y reintentar fallidas desde el panel.

Solo descarga HTTPS de los hosts de Spaces de MundoBeat e i.discogs.com, sin
redirecciones, maximo 8 MB. Otras portadas deben pasar por la biblioteca de
imagenes. Las fotos de busqueda se procesan sin almacenarse; solo se conserva
una foto si el vendedor registra el articulo sin ficha.

Una sola inferencia simultanea y hasta cuatro solicitudes totales por proceso.
La busqueda compara exclusivamente productos de la tienda autenticada y muestra
hasta cinco candidatos. Similitud no es precision estadistica ni confirma
edicion, formato o estado: el vendedor siempre elige y cuenta explicitamente.

## Verificacion

- `npm test -- --runInBand inventory`: reglas, metadatos MySQL sin conexion,
  aislamiento de tienda, reintentos, ceros, conflictos, cierre y preparacion.
- `npm run build` y `npx tsc --noEmit` en frontend.
- `node scripts/test-inventory-model.cjs`: descarga/inferencia real sin BD.
- `frontend/scripts/test-inventory-ui.cjs`: Playwright con API simulada, sin
  credenciales reales. `PLAYWRIGHT_MODULE` puede indicar el modulo instalado,
  `PLAYWRIGHT_CHANNEL=chrome` usa Chrome, `INVENTORY_UI_URL` define el dev server.

No ejecutar el backend completo contra produccion para realizar estas pruebas:
el arranque habilita tambien las tareas programadas existentes del marketplace.
