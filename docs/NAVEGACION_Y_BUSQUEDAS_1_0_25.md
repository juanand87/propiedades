# Proppix 1.0.25

- Inicio → Propiedades deslizando a la izquierda; regreso a Inicio deslizando a la derecha, con desplazamiento que sigue el dedo y confirma la ruta al terminar. El scroll vertical conserva su gesto nativo.
- La lupa de Inicio abre búsqueda de videos por título, con portadas y paginación. Abre el video elegido sin reemplazar el feed. Propiedades mantiene su buscador y filtros propios.
- Las lecturas recuperan una respuesta JSON incompleta con un único reintento; las escrituras no se repiten. Se solicita JSON explícitamente y los errores de producción ya no indican que se está usando un servidor local. La búsqueda de perfiles valida la forma de los resultados.

Pruebas: TypeScript y lint móvil; 189 pruebas backend; 78 comprobaciones de perfiles autenticados en el entorno aislado; búsqueda de títulos, consultas parametrizadas y comodines literales; regreso animado, cancelación y scroll vertical simulados; respuestas truncadas, reintentos limitados y ausencia de doble escritura.

No se reprodujo el error intermitente de perfiles con una cuenta de producción: la comprobación sin sesión responde JSON 401 correcto y la búsqueda autenticada local pasó. Validar con la sesión del teléfono tras instalar el APK. No se afirma una causa de servidor confirmada.

No necesita migración SQL. APK local 1.0.25, código 26.
