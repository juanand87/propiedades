# Carga guiada de portada y slider

El editor compartido del sitio principal y los corredores ofrece 12 temas: los seis originales más Marino, Esmeralda, Rubí, Índigo, Oliva y Chocolate. Todas las paletas pasan las reglas de contraste del backend; los colores guardados se conservan.

En Portada y slider se elige entre una foto fija y varias fotos mediante dos tarjetas. El área de carga permite elegir archivos o arrastrarlos y acepta varias fotos a la vez en modo slider. El logo utiliza el mismo control. Se validan formato, tamaño y cantidad de todo el lote antes de enviar archivos. Se impiden cargas simultáneas y se informa el archivo actual, el total y cualquier fallo parcial. Las imágenes agregadas permanecen en el borrador hasta guardar el diseño.

El slider muestra un contador, el mínimo de dos y máximo de ocho fotos, miniaturas grandes, la primera foto identificada y botones para ordenar, usar una foto como primera o quitarla del diseño. La reproducción es una opción desplegable. Cambiar entre portada fija y slider conserva los archivos seleccionados. Quitar una foto del slider no elimina el archivo de la biblioteca.

Un slider incompleto no se puede guardar y la vista previa avisa que la imagen provisional no representa un slider configurado. Las descripciones accesibles son editables. La vista previa sigue la foto seleccionada, incluso al cambiar el orden.

No requiere SQL ni cambios de backend.

## Verificación

Las 12 paletas se validaron con la función real del servidor. En el navegador local, con un corredor ficticio: selección múltiple de dos imágenes, rechazo de una imagen de 9 MB, rechazo de un lote mixto con SVG antes de subir sus imágenes válidas, contador, reordenamiento, cambio de primera foto, persistencia tras guardar y recargar y conservación de fotos al alternar modos. Se utilizó exclusivamente la base aislada de QA.

Compilación de producción y TypeScript correctos; lint sin errores. Revisión a 390 × 844 sin desbordamiento horizontal. Capturas: [carga guiada](qa/carga-guiada-slider.png) y [móvil](qa/carga-guiada-slider-movil.png).

## Vista previa inmediata

El editor incluye una portada junto al cargador, con los textos reales y una tira de miniaturas. Cada foto subida o elegida en la biblioteca se selecciona automáticamente al terminar de agregarse. Se muestra desde la primera foto; el mínimo de dos continúa siendo necesario para guardar el slider. Pulsar una miniatura o una flecha sincroniza la portada del editor y la vista previa del sitio completo. Solo se muestran los ajustes de la foto seleccionada, evitando una lista larga de formularios. La selección es temporal y no cambia qué foto abre el sitio publicado: eso sigue dependiendo del orden.

Verificado localmente: carga real de una imagen ficticia pequeña desde cero, primera foto visible sin guardar, guardado bloqueado con una sola, selección automática al agregar otra desde biblioteca, sincronización entre miniaturas y ambas portadas y móvil sin desbordamientos. Capturas: [portada inmediata](qa/slider-vista-inmediata.png) y [móvil](qa/slider-vista-inmediata-movil.png).
