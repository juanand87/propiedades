# Descubrir y catálogo de ejemplo

Página pública: `/descubrir`. Presenta una propiedad publicada por pantalla, con scroll vertical, navegación por teclado y botones, fotos anteriores/siguientes, favoritos, compartir y acceso a la ficha. Carga seis publicaciones por página y continúa al acercarse al final. Se puede filtrar por tipo; los estados vacío, carga y error incluyen acciones útiles. Respeta movimiento reducido. La portada incluye un enlace y el editor de Cabecera ofrece Descubrir como destino sugerido.

## Instalar los 20 ejemplos

1. Ingresa como administrador y abre **Propiedades de ejemplo** en el panel (`/panel/ejemplos`).
2. Elige **Borradores para revisar primero** o **Publicados para probar Descubrir**.
3. Pulsa **Instalar 20 ejemplos**.
4. Si elegiste borradores, revísalos en Propiedades y pulsa **Publicar ejemplos pendientes** cuando quieras mostrarlos.
5. Abre Descubrir para recorrerlos.

No hace falta ejecutar SQL ni crear otra base: se utilizan las tablas actuales de `propiedades`. El instalador crea un perfil ficticio independiente y 20 publicaciones con precio en UF, regiones/comunas y características, cada una con tres imágenes ilustrativas WebP guardadas en `estate_media`. No descarga imágenes ni depende de servicios externos. Las imágenes y publicaciones indican que son ejemplos. Las fichas no reciben consultas ni visitas, y la API rechaza esos envíos.

La instalación tiene identidades estables y es idempotente: una segunda ejecución agrega únicamente lo que falte, conserva cambios y estados y no republica ejemplos pausados. **Publicar ejemplos pendientes** cambia solo ejemplos en borrador o pausados; **Despublicar solo los ejemplos** pausa únicamente los ejemplos publicados. Ninguna de estas acciones borra registros ni afecta publicaciones reales. Los permisos se validan en el backend y el instalador exige la base `propiedades`.

Las 20 propiedades se instalaron y probaron exclusivamente en la instancia local aislada de QA; la instalación de tu catálogo real queda disponible mediante el panel. El código no carga ejemplos automáticamente al iniciar el backend.

## Verificación

72 pruebas unitarias y 264 comprobaciones de integración en QA, con cero conexiones a producción. Incluyen permisos, instalaciones repetidas, publicación/pausa, imágenes privadas tras pausar, consultas de ejemplos bloqueadas y conservación de una propiedad real de prueba. Backend y frontend compilan; lint sin errores.

Pruebas de navegador: recorrido hasta las 22 publicaciones de QA con paginación sin duplicados, flechas y teclado, cambio de fotos, favoritos, filtros y estado vacío, ficha de ejemplo sin contacto, instalador idempotente y publicación/pausa. Vista móvil sin desbordamiento horizontal.

Capturas: [escritorio](qa/descubrir-escritorio.png), [móvil](qa/descubrir-movil.png), [instalador](qa/instalador-ejemplos-panel.png).
