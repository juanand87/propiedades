# Usar audio del video · Proppix 1.0.29

En Crear/Editar propiedad, pulsa **Usar audio del video**, elige un video propio y pulsa **Extraer audio y proponer datos**. En Android, al crear los datos desde un video, ese video queda seleccionado. Revisa la transcripción, corrígela si hace falta y selecciona los campos que quieres aplicar. Aplicar solo modifica el formulario: guardar y enlazar siguen siendo acciones explícitas del flujo habitual.

La web ofrece la misma opción en el editor de propiedades. El selector incluye videos publicados y borradores accesibles al usuario, con carga de páginas de 20 videos. No hace falta volver a subir el video ni autorizar el micrófono para extraer su audio.

El backend verifica la propiedad/permisos antes de leer el original privado desde Spaces (o el sandbox local). No acepta URLs ni rutas del cliente. Extrae únicamente audio mono AAC para enviarlo a OpenAI; las imágenes del video no se envían. Se aceptan originales de hasta 50 MB y 3 minutos. Un video sin pista de audio, corrupto o demasiado largo muestra un error y permite seguir mediante dictado o texto. Los temporales se eliminan al terminar. El original no cambia.

Reutiliza PROPERTY_DICTATION_ENABLED y OPENAI_API_KEY ya configuradas en DigitalOcean, las cuotas por cuenta y la revisión de los 28 campos y características. No requiere nuevas variables ni SQL. La transcripción e interpretación consumen la API; no se reintentan automáticamente los errores de IA.

Pruebas: extracción con MP4 real, rechazo de video sin audio/corrupto/largo, limpieza de temporales, bloqueo de videos ajenos antes del acceso al almacenamiento, rechazo de orígenes mezclados y propuesta sin guardar ni enlazar.
