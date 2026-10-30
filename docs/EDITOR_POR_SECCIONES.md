# Editor de diseño por secciones

Disponible en **Panel → Diseño del sitio** para administración y **Mi sitio web** para los corredores.

El menú propio separa Identidad, Colores y estilo, Cabecera, Portada y slider, Buscador (marketplace) o Presentación (corredor), Secciones de inicio, Propiedades, Contacto y pie y Revisar y publicar. Muestra los controles que corresponden a cada sitio; los textos del corredor están distribuidos entre portada, presentación, propiedades y contacto. El nombre y los datos generales siguen en Configuración del sitio o el perfil, accesibles en otra pestaña sin abandonar el borrador.

Los cambios de todas las secciones permanecen en un único borrador. La barra de estado, descarte y guardado permanece visible al desplazarse. Si un campo obligatorio queda vacío en un panel oculto, el editor abre ese panel y enfoca el campo. El guardado conserva las revisiones y controles de autorización existentes.

**Escritorio** representa un lienzo de 1120 px y **Móvil**, uno de 390 px. Ambos se ajustan al espacio disponible sin cambiar el diseño guardado. El lienzo móvil adapta cabecera, títulos y tarjetas mediante consultas de contenedor; funciona incluso dentro de una ventana de escritorio. Se puede recorrer la vista previa con su propio desplazamiento. Los anuncios de la vista previa son representativos, no publicaciones nuevas. El enlace al sitio publicado permite comprobar el contenido real.

En pantallas amplias, menú, campos y vista previa aparecen en tres columnas. En tamaños intermedios, la vista previa queda debajo de los campos. En móvil, el menú se distribuye en botones y el contenido se apila.

No cambia la API ni el esquema de datos y **no requiere SQL**.

## Verificación

Pruebas en navegador con administración y corredor ficticios de una base local aislada: cambio de sección sin perder el borrador, guardado desde Revisar y publicar, validación de campos ocultos, persistencia de textos y tema tras recargar, selección de los dos lienzos y editor móvil a 390 × 844 sin desbordamiento horizontal. Las pruebas no acceden a MundoBeat ni crean datos ficticios en producción.

Capturas: [escritorio](qa/editor-secciones-escritorio.png), [móvil](qa/editor-secciones-movil.png) y [corredor](qa/editor-corredor-secciones.png).
