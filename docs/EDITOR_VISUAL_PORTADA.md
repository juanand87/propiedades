# Editor visual de portada y slider

Disponible en **Diseño del sitio → Portada y slider** para el portal y **Mi sitio web → Portada y slider** para cada inmobiliaria.

Escribe el título y la descripción directamente sobre la imagen. Ampliar editor abre una vista grande; cerrar o Escape conserva el borrador. La miniatura selecciona la foto que editas y las flechas permiten recorrer las imágenes sin reproducción automática durante la edición.

Por defecto editas el texto compartido por las fotos sin texto propio. Activa **Usar textos propios para esta foto** para personalizar solo esa imagen. Desactivarlo recupera el texto compartido; **Restaurar texto compartido original** vuelve a los textos anteriores del sitio. El título admite hasta 180 caracteres y la descripción hasta 400, incluyendo descripción vacía. Los saltos de línea se conservan.

Puedes cambiar la foto desde el equipo o la biblioteca. Reemplazar o reordenar una imagen conserva su texto propio. Los controles existentes mantienen el texto alternativo, orden y reproducción; los sliders admiten entre 2 y 8 fotos JPG, PNG o WebP de hasta 8 MB cada una. El texto alternativo describe la imagen para accesibilidad y es distinto del texto visible sobre ella.

La vista previa de escritorio y móvil y el slider público usan el mismo texto de la imagen activa. Los cambios se publican solo al guardar y Descartar recupera lo guardado. Portal e inmobiliarias conservan configuraciones independientes.

No requiere SQL: se guardan `hero_copy` y los textos opcionales de cada `hero_slides[].copy` en los JSON existentes. Los diseños anteriores conservan sus textos y el control se habilita con backend `design_version` 10. Los campos antiguos del perfil/configuración siguen siendo el respaldo cuando no hay personalización visual.

Verificado con datos ficticios: textos comunes y propios, cambio de miniatura, carga de dos fotos, reemplazo de foto y reordenamiento sin pérdida de texto, edición ampliada, guardado y recarga, sincronización pública imagen/texto y edición independiente desde el panel del corredor. La entrega incluye 72 pruebas unitarias y 264 comprobaciones de integración.

Capturas: [editor ampliado](qa/editor-portada-ampliado.png), [slider público](qa/slider-textos-publico.png).
