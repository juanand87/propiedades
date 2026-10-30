# Diseño del sitio desde administración

El acceso es **Panel → Diseño del sitio**, `/panel/diseno`. La configuración general de nombre, título y contacto sigue en `/panel/configuracion`, con enlace al editor visual.

## Activación única en la base existente

Ejecutar **solo `database/004_diseno_sitio.sql`** en la base `propiedades`, con su usuario exclusivo, y recargar el panel. Es repetible: añade `design_json` y `design_revision` a `estate_settings` y registra `004_site_design`. No cambia publicaciones, usuarios, fotografías ni los valores de diseño existentes. Respaldar la base propia antes de aplicar DDL; MySQL no garantiza rollback de ALTER TABLE.

No hace falta repetir el SQL inicial. El SQL inicial que el usuario ya abrió se conserva sin modificaciones de contenido. El empaquetado del backend incluye las cuatro migraciones para instalaciones nuevas. `scripts/package-migration.cjs --preserve-delivery` actualiza solo esa copia y conserva el archivo de entrega abierto localmente; sin ese argumento también regenera el SQL completo de entrega.

La aplicación no ejecuta DDL al arrancar. Sin la migración, la web conserva su diseño original y el editor permite previsualizar, pero informa de la actualización pendiente y bloquea publicar. No se ha ejecutado esta migración en DigitalOcean durante el desarrollo.

## Uso cotidiano

1. Elegir colores principal, de acento, fondo y texto mediante selectores o códigos hexadecimales. El servidor rechaza combinaciones con contraste insuficiente para texto y botones.
2. Subir un logo y una portada o elegirlos en la biblioteca de la cuenta administradora. Se admiten PNG, JPG y WebP hasta 8 MB, procesados por el backend. La portada se adapta al espacio mediante recorte; es preferible una imagen horizontal. El logo admite transparencia.
3. Elegir si el nombre acompaña al logo y escribir la descripción accesible de la portada.
4. Ordenar con flechas y mostrar u ocultar portada, buscador, tipos, últimas propiedades e invitación a publicar. Debe quedar al menos una sección visible.
5. Revisar la vista previa y pulsar **Guardar y publicar diseño**. El diseño se aplica en la respuesta HTML inicial y al recargar el sitio, sin otro despliegue de código.

**Descartar cambios** vuelve a cargar el último diseño publicado. **Preparar diseño original** coloca los valores originales en el formulario; todavía hay que guardar para publicarlos. Quitar una imagen del diseño no la elimina de la biblioteca. Los archivos subidos sin guardar permanecen privados y disponibles en esa biblioteca.

## Permisos y conservación

Solo un administrador puede guardar el diseño; ocultar controles en el navegador no sustituye la autorización del backend. Para seleccionar imágenes nuevas se exige propiedad de la cuenta administradora. Otros administradores pueden conservar las imágenes que ya están publicadas en el diseño y modificar los demás valores.

Solo las imágenes actualmente referenciadas por el diseño se publican como recursos del sitio. El backend impide borrar una imagen en uso. Al quitarla puede subsistir hasta una hora en cachés públicas; usar únicamente material destinado a difusión pública.

Cada guardado comprueba una revisión y utiliza una transacción. Si otra sesión guardó antes, se rechaza el cambio y se solicita recargar, evitando sobrescrituras silenciosas. Los bloqueos coordinan la publicación y el borrado de las imágenes.

El diseño no permite HTML, JavaScript, CSS libre ni URLs externas: acepta colores validados, IDs de imágenes de la biblioteca y un conjunto fijo de secciones. Las fotos siguen almacenándose en la BD propia, sin usar buckets de MundoBeat.

## Verificación

Compilación backend/frontend y lint del frontend correctos. Pruebas locales: 19 unitarias y 74 comprobaciones de integración, incluida migración repetida, compatibilidad sin migración, permisos, colores inválidos, imágenes privadas/públicas, imagen ajena rechazada, bloqueo de borrado y conflictos de revisión. Revisión visual a 1280 × 900 y 390 × 844: edición, vista previa, selección de biblioteca, guardado y aplicación pública de orden, visibilidad, logo y portada. Comprobado también el diseño en el HTML inicial. Las capturas contienen únicamente datos ficticios de QA.
