# Personalización del footer desde el panel

Ruta: **Mi sitio web → Contacto y pie**. Para un administrador con perfil de anunciante también está disponible desde su propio **Mi sitio web**; no permite editar el sitio de otra inmobiliaria.

Se puede cambiar el texto de presentación del footer, su título de contacto y una nota opcional al pie. El texto vacío se oculta y Restaurar texto original recupera la presentación predeterminada.

Los campos Teléfono, WhatsApp y Correo permiten personalizar los canales del sitio. Inicialmente se utilizan los datos públicos del perfil; al editar un campo se crea un contacto personalizado para ese sitio. Los cambios se reflejan en el bloque de contacto, la cabecera y el footer, sin modificar el perfil del marketplace. Dejar un canal vacío lo oculta. Volver a usar los datos del perfil elimina la personalización del contacto.

Las redes disponibles son Instagram, Facebook, LinkedIn, YouTube, TikTok y X/Twitter. Se pega el enlace en el campo correspondiente y se deja vacío para ocultarlo. El editor completa https:// cuando falta; el servidor exige HTTPS, dominios de la red elegida, ausencia de credenciales en la URL y una sola entrada por red. Los enlaces públicos abren otra pestaña con protección noopener/noreferrer.

La vista previa se sitúa en el footer y muestra el borrador. Todos los cambios se publican juntos con Guardar mi sitio, conservando el control de revisiones y la propiedad del anunciante. Descartar cambios vuelve a cargar lo guardado.

## Compatibilidad y despliegue

No requiere SQL: utiliza el JSON de advertiser_sites existente. Los diseños anteriores conservan sus colores, imágenes, textos y contactos heredados. El backend devuelve design_version 3 para el editor personal; los nuevos campos permanecen deshabilitados durante el despliegue si todavía responde la versión anterior, evitando guardarlos contra un servidor que no los reconoce. Si aparece ese aviso, recargar al terminar la actualización del backend.

## Verificación

40 pruebas unitarias y 181 comprobaciones de integración en la base local aislada: compatibilidad con diseños anteriores, enlaces seguros, límites de textos, contactos válidos, persistencia, revisiones, rechazo sin modificar datos e independencia entre anunciantes. Cero conexiones a bases de producción.

Navegador con cuenta ficticia: edición completa, rechazo de un enlace de otra red social, agregado automático de HTTPS, guardado y persistencia tras recargar, recuperación de contactos del perfil, vista previa y editor móvil de 390 × 844 sin desbordes. Se verificaron el texto y los enlaces del footer público. Compilaciones de backend y frontend correctas y lint sin errores.

Capturas: [editor](qa/footer-editor-personalizable.png), [móvil](qa/footer-editor-personalizable-movil.png) y [sitio de QA](qa/footer-personalizado-publicado.png).
