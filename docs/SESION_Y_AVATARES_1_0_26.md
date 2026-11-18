# Proppix 1.0.26

## Sesión

La app conserva la sesión cifrada aunque falle la red al iniciar. El acceso sigue durando ocho horas; una credencial separada con audiencia estate-refresh renueva el acceso automáticamente, con vigencia de un año renovable. No sirve para llamar endpoints normales. Se comprueba cuenta activa y una huella del hash de contraseña en cada renovación. Cambiar la contraseña invalida renovaciones anteriores. Cerrar sesión elimina las credenciales del dispositivo; no se afirma revocación remota de todas las sesiones. Google y correo usan el mismo mecanismo.

Las sesiones anteriores aún válidas se actualizan mediante auth/session. Si ya vencieron antes de instalar esta versión, hay que iniciar sesión una vez. Desinstalar puede borrar el almacenamiento cifrado de Android. La web conserva su sesión mediante renovación y no borra credenciales por errores transitorios; elimina token, renovación y usuario al cerrar sesión.

## Directorio

Se elimina la comprobación correlacionada de videos por cada candidato y se usa un conjunto común de perfiles y autores visibles. Se mantienen los filtros, nombres públicos, bloqueos bilaterales, usuarios activos y paginación. La consulta incluye un presupuesto MySQL de cuatro segundos. Medición local autenticada: cinco muestras, mediana 149 ms y máximo 194 ms; no es medición de DigitalOcean. El 504 de la cuenta del teléfono debe comprobarse después del despliegue.

## Videos y avatares

Se retira la capa oscura fija sobre el 48 % inferior. El video usa cover, respetando proporciones y recortando bordes cuando es necesario; nunca se estira. Compartir aparece desde el inicio de un video publicado; el espacio de seguir se mantiene mientras se resuelve su estado.

El feed y la galería incluyen el avatar del creador. Se precarga junto con las portadas siguientes. Las nuevas fotos de perfil se procesan en el servidor a 512 × 512; avatares existentes y nuevos se sirven como WebP de 256 × 256 con URL estable versionada y caché limitada en memoria. Usuarios suspendidos no sirven avatar.

## Validación y entrega

No requiere SQL. APK local 1.0.26, código 27. TypeScript y lint móvil; build backend; 189 pruebas unitarias; 78 casos del directorio; 20 verificaciones de renovación, audiencias, cambio de contraseña, suspensión y tamaños reales de avatar; 15 casos de privacidad de portadas; pruebas de renovación concurrente, persistencia web, gestos y precarga. Build web validado con Webpack después de un fallo local de Turbopack al crear su proceso CSS.
