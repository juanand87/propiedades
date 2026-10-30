# Sitios personalizables para anunciantes

Cada anunciante dispone de su propia web en `/anunciantes/su-slug`. La dirección existente del perfil se conserva y pasa a mostrar una web con marca, navegación, presentación, catálogo y contacto. Las fichas pueden abrirse dentro de `/anunciantes/su-slug/propiedades/slug-de-la-propiedad`, conservando esa marca y la navegación de regreso a su catálogo.

## Activación

Ejecutar una vez **`database/005_sitios_corredores.sql`**, únicamente sobre `propiedades`, con su usuario exclusivo. Es repetible y crea la tabla `advertiser_sites` con referencias al anunciante y a sus imágenes. Registra `005_advertiser_sites`; no borra ni transforma cuentas, publicaciones, perfiles o diseños existentes. Respaldar la base propia antes de ejecutar DDL.

Esta migración es independiente de `004_diseno_sitio.sql`. El editor del marketplace general sigue utilizando 004; los sitios de corredores utilizan 005. El backend empaqueta las cinco migraciones para nuevas instalaciones. Se conservó el SQL inicial abierto localmente por el usuario. No se ejecutó 005 en DigitalOcean durante el desarrollo.

Sin la tabla nueva, los perfiles públicos mantienen acceso con una web de diseño predeterminado y datos del perfil. El editor informa de la actualización pendiente y bloquea guardar. La aplicación no ejecuta DDL al arrancar.

## Configurar un sitio

1. Entrar al panel y completar **Perfil de anunciante**. Ahí se administran el nombre, descripción, logo de perfil, teléfono, WhatsApp y correo públicos.
2. Abrir **Mi sitio web**, `/dashboard/sitio`. Los administradores con perfil propio también disponen de `/panel/sitio`.
3. Configurar colores, logo y portada propios, o seleccionar archivos de la biblioteca de esa cuenta. Las imágenes del sitio pueden ser distintas del logo de perfil mostrado en el directorio del marketplace.
4. Editar título e introducción de portada, texto de presentación y títulos de presentación, catálogo y contacto.
5. Mostrar, ocultar y ordenar las cuatro secciones: portada, acerca de nosotros, propiedades y contacto. Debe quedar al menos una visible.
6. Revisar la vista previa y pulsar **Guardar mi sitio**. La dirección pública aparece en el mismo editor.

Los cambios no modifican el diseño del marketplace ni los sitios de otros anunciantes. **Descartar cambios** carga la versión guardada. **Preparar diseño original** coloca valores predeterminados en el formulario; hay que guardar para aplicarlos.

El catálogo incorpora los filtros inmobiliarios existentes y siempre se limita al anunciante de la web, aunque se manipule el identificador en la URL. Las publicaciones deben estar publicadas y la cuenta debe estar activa y aprobada. Los contactos y solicitudes de visita de las fichas siguen entrando en el panel del propietario de esa publicación.

## Permisos, visibilidad y contenido

El servidor determina el anunciante desde la sesión. GET/PATCH `/api/me/site` nunca aceptan un anunciante elegido por el navegador para leer o guardar. Cada cuenta solo selecciona imágenes propias. Hay control de revisión y transacciones para evitar sobrescrituras simultáneas. Las referencias a imágenes impiden borrarlas mientras están en uso.

Un perfil pendiente o suspendido puede conservar y editar su diseño, pero su web no es pública. Las imágenes exclusivas de ese sitio permanecen privadas mientras el perfil no esté aprobado y activo; el propietario puede previsualizarlas mediante firmas temporales. Una imagen que también esté publicada en otro recurso público sigue siendo pública por ese otro uso. Las cachés pueden conservar imágenes previamente públicas hasta una hora.

La API pública entrega una lista explícita de datos de identidad y el diseño público. No incluye usuario interno, correo de cuenta, RUT, razón social, firmas privadas ni contraseñas. No se permite HTML, JavaScript, CSS libre ni URLs de imágenes externas. Los colores se validan, incluidos los requisitos de legibilidad.

Las páginas se renderizan con la marca y contenido guardados desde el HTML inicial. Cada sitio tiene metadatos y URL canónica propios. Las fichas bajo la marca del corredor conservan su título con ese nombre y usan la ficha global como canónica para evitar duplicidad. Los sitios aprobados se agregan al sitemap. La indexación sigue controlada por `SITE_INDEX_ENABLED` del frontend.

Esta entrega utiliza URLs dentro del dominio del marketplace; no configura dominios propios, DNS ni certificados por anunciante.

## Verificación

- Compilación de producción de backend y frontend correcta; lint del frontend sin errores.
- 23 pruebas unitarias y 135 comprobaciones de integración en una instancia de QA aislada, sin conexiones de pruebas a producción.
- Dos anunciantes con colores, imágenes y propiedades distintos; rechazo de imágenes ajenas, revisión antigua, cuenta sin perfil y accesos sin sesión; ocultación por suspensión y conservación de diseños al repetir la migración.
- Compatibilidad de perfiles e imágenes con una tabla de usuarios heredada que utiliza una intercalación distinta; solo se simuló esa diferencia en QA, sin cambiar el esquema remoto de usuarios.
- Guardado desde el panel del corredor, vista previa, selección de imágenes, cambios de textos, orden y visibilidad; catálogo con una publicación propia y sin la del otro corredor; ficha dentro de la marca del corredor.
- Verificación de HTML inicial, 404 para una ficha ajena bajo otra marca y conservación del diseño del marketplace.
- Revisión visual de escritorio y móvil, menú propio y ausencia de desbordamiento horizontal. Evidencias en `docs/qa/corredor-*.png`, con datos ficticios.
