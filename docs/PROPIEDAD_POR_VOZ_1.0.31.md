# Proppix 1.0.31 · Tu propiedad, con tu voz

Al entrar desde un video propio y elegir Crear propiedad en Proppix se abre un editor enfocado, con el título del video/propiedad arriba. No contiene el encabezado del perfil, seguidores, me gusta, visitas, plan ni las acciones de grabar/subir videos o buscar perfiles.

**Dictar mi propiedad** es la acción principal. Al terminar la grabación comienza la transcripción e interpretación automáticamente; no hay que pulsar Interpretar grabación. Sigue apareciendo una revisión antes de aplicar y guardar. Un error no inicia reintentos de IA por sí solo. El usuario puede reintentar explícitamente.

**Usar audio del video** usa el ID de origen ya definido y comienza el análisis cuando está disponible la IA. No carga ni muestra el selector de otros videos en ese contexto. Si se crea una propiedad sin video de origen, el selector continúa disponible.

**Completar por voz** conserva el contexto anterior y permite aclarar/corregir datos con otra grabación. La propuesta muestra lo que falta (precio, ubicación, superficies y otros datos esenciales), conserva los datos anteriores y da prioridad a correcciones explícitas. Los datos no mencionados no se inventan. El texto acumulado tiene un límite de 12.000 caracteres. La API y las cuotas existentes siguen aplicándose.

El formulario ofrece **Publicar propiedad** y **Guardar borrador**. Publicar respeta la revisión de propiedades vigente y la exigencia de fotografías; no elimina controles de aprobación ni publica automáticamente lo que proponga la IA. Se retiró el aviso previo que decía que vincular siempre deja el video en borrador. El backend mantiene sus reglas de visibilidad y vinculación vigentes.

El perfil sigue la referencia: avatar, nombre y @usuario, Persona/Empresa, editar perfil, contadores, Grabar video/Subir video y galería de tres columnas con título, me gusta y opciones. Mis propiedades usa tarjetas con fotos, ubicación, precio y estado, filtros y estadísticas reales. El estado es En revisión, no En condena. Guardados conserva su comportamiento.

Volver al recorrido conserva el orden y la posición del video, sin moverlo al primer lugar ni refrescar el feed al guardar datos de propiedad. Se mantiene el reproductor preparado cuando es posible.

No requiere SQL ni variables nuevas. Instalar Proppix 1.0.31 sobre la versión anterior.
