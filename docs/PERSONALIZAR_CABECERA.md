# Cabecera, menú y botón principal desde el panel

Rutas: **Panel → Diseño del sitio → Cabecera** para el marketplace y **Mi sitio web → Cabecera** para corredores e inmobiliarias. Ambas configuraciones son independientes.

El menú puede seguir siendo automático o personalizarse con hasta seis enlaces. Cada enlace tiene texto, destino sugerido o dirección propia, apertura en otra pestaña, flechas para ordenar y un botón para quitarlo. Volver al menú automático recupera el comportamiento anterior. En inmobiliarias, el menú automático sigue las secciones visibles; los enlaces personalizados a secciones ocultas no se publican mientras esas secciones estén ocultas.

El botón principal puede usar su comportamiento predeterminado, personalizar texto y destino, abrir otra pestaña u ocultarse. Los accesos de cuenta y edición permanecen disponibles. En las cabeceras personalizadas, el botón también aparece dentro del menú móvil.

Se admiten rutas del sitio que comiencen por /, anclas de sección con # y enlaces externos HTTPS. En una inmobiliaria, #propiedades apunta a su propio catálogo, incluso desde una ficha anidada. Una ruta /propiedades apunta al marketplace. Los enlaces externos en otra pestaña utilizan noopener/noreferrer. Se rechazan protocolos inseguros, credenciales, puertos no estándar, controles, barras invertidas y destinos de doble barra.

La vista previa refleja textos, orden y botón. En modo móvil, su botón de menú abre el desplegable para revisar los enlaces. Los cambios permanecen en el borrador hasta guardar el diseño completo; Descartar vuelve a cargar lo publicado.

No requiere SQL: se usan los JSON existentes de estate_settings y advertiser_sites, con las mismas revisiones y permisos. Los diseños anteriores conservan sus menús y botones automáticos. La edición de enlaces se habilita con design_version 5; tamaños y colores requieren design_version 6.

## Verificación

64 pruebas unitarias y 211 comprobaciones de integración en la base local aislada, con cero conexiones a producción. Se verificaron compatibilidad, límites, destinos inseguros, persistencia, revisiones, permisos e independencia entre sitios. Compilaciones de backend y frontend correctas y lint sin errores.

En navegador, con cuentas ficticias de administrador y corredor: edición de textos y destinos, agregado y orden de enlaces, rechazo de JavaScript, botón personalizado y oculto, persistencia tras recargar, menú interactivo de la vista previa móvil, enlaces externos seguros, acceso del propietario y navegación de los menús publicados a 390 × 844 sin desbordamiento horizontal.

Capturas: [editor principal](qa/cabecera-editor-principal.png), [editor de inmobiliaria](qa/cabecera-editor-inmobiliaria.png), [menú principal móvil](qa/cabecera-principal-movil.png) y [menú de inmobiliaria móvil](qa/cabecera-inmobiliaria-movil.png).

## Tamaños y colores

En Cabecera se ajustan el tamaño del logo (24–80 px), la altura mínima de la cabecera (64–144 px), el fondo, el texto del menú, el resaltado de enlaces y los colores del botón principal. Los colores admiten selector visual o código hexadecimal de seis dígitos. Automático sigue el tema; Restaurar tamaños y colores automáticos recupera la apariencia anterior sin cambiar enlaces ni botón.

La cabecera crece si el logo requiere más espacio y la portada conserva separación respecto a ella. El logo mantiene su proporción y se adapta al ancho móvil. Los colores se aplican también al menú desplegable; el logo del footer mantiene su tamaño independiente. Los controles actualizan el borrador y su vista previa de inmediato, pero se publican únicamente al guardar.

Comprobado con cuentas ficticias: guardado y recarga en administrador e inmobiliaria, estilos distintos entre sitios, restauración y descarte, altura máxima, logo grande, menú móvil sin desbordamiento y footer sin cambios. Capturas: [tamaños y colores](qa/cabecera-tamanos-colores.png), [inmobiliaria en móvil](qa/cabecera-colores-inmobiliaria-movil.png). No requiere SQL ni nuevas variables de entorno.

## Cabecera fija al desplazarse

En Cabecera → Comportamiento de la cabecera, activa Mantener la cabecera visible al hacer scroll y guarda. Se configura de forma independiente en el portal principal y cada inmobiliaria, y está desactivado en diseños anteriores. Requiere backend design_version 7 y no necesita SQL.

La cabecera permanece visible en escritorio y móvil, conserva su presentación sobre la portada y permite abrir el menú después de desplazarse. Los enlaces a secciones dejan espacio bajo la cabecera. El ajuste público del portal no fija la cabecera exterior de los paneles de edición.

La vista previa reproduce el comportamiento dentro de su propio desplazamiento; también se puede enfocar y desplazar con el teclado. Verificado con datos ficticios: guardar, recargar, desactivar, descartar y volver a activar, scroll en escritorio/móvil, navegación a secciones e independencia entre sitios. Capturas: [panel](qa/cabecera-fija-panel.png), [inmobiliaria en móvil](qa/cabecera-fija-inmobiliaria-movil.png).
