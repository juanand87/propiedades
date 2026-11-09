# Propiedades móvil — demo local para Windows

React Native + Expo SDK 58, TypeScript y `expo-video`. Reutiliza el código y los contratos del backend NestJS del marketplace. La web no se modifica ni se despliega con este trabajo.

La conexión opcional de **imágenes** a Spaces ya está disponible y se prueba con `npm run mobile:backend:spaces`; lee únicamente las cinco variables de Spaces del archivo local y fuerza un prefijo de pruebas separado. El arranque normal continúa aislado de almacenamiento externo. Consulta [SPACES_IMAGENES.md](../docs/SPACES_IMAGENES.md). Esta opción no envía videos a Spaces ni cambia la aplicación pública.

## Iniciar en este equipo

Abre una terminal en `C:\xampp\htdocs\propiedades`:

```powershell
npm run mobile:backend
```

Cuando aparezca `READY`, abre otra terminal en la misma carpeta:

```powershell
npm run mobile:android
```

El segundo comando abre el teléfono `medium_phone`, espera el arranque de Android, prepara la conexión con Metro y abre el proyecto en Expo Go. Se instaló una imagen de teléfono Android API 36. Las rutas Android del proceso se ajustan sin modificar las variables globales de Windows ni el emulador de televisión que ya existía.

La primera ejecución del backend crea una instancia MySQL independiente, aplica el esquema y genera 20 propiedades ficticias con imágenes y 20 clips MP4 de cinco segundos. Los clips son animaciones ilustrativas, sin audio; no son grabaciones de inmuebles reales. Si se interrumpe la preparación, el siguiente arranque agrega los clips faltantes. No duplica los ya vinculados ni restaura videos archivados o modificados.

## Cuenta de pruebas

Para probar con las mismas cuentas y BD de la web en DigitalOcean, detén el Metro anterior y ejecuta desde la raíz `npm run mobile:android:production`. Este comando comprueba la API pública, configura el modo de producción y recarga el bundle. Inicia sesión con tu cuenta de la web: las cuentas y propiedades del entorno local permanecen separadas. Las propiedades creadas en este modo se guardan en DigitalOcean y siguen el proceso de revisión para aparecer públicamente. `npm run mobile:android` continúa abriendo la demo local.

- Correo: **mobile-admin@qa.invalid**.
- Contraseña: abrir `tmp/mobile-local/credentials.json` después del primer arranque. Es aleatoria y exclusiva de esta demo; el archivo está ignorado por Git.
- Las credenciales y usuarios del sitio público no se copian a esta base.
- El token se guarda con `expo-secure-store`. Reiniciar el backend genera una nueva clave JWT e invalida las sesiones anteriores: vuelve a iniciar sesión.

Se puede explorar sin iniciar sesión. Para favoritos, carga y publicación de videos se utiliza una cuenta local. El administrador puede gestionar todos los ejemplos; una cuenta de corredor solo puede acceder a sus propiedades, según los permisos existentes de NestJS.

## Qué probar

El nuevo perfil de videos permite crear primero y vincular opcionalmente después. Incluye galería, siguiendo/seguidores/me gusta, comentarios, guardados, foto y menú Editar/Compartir/Descargar. Ver [PERFIL_DE_VIDEOS.md](../docs/PERFIL_DE_VIDEOS.md) para activación y pruebas. La demo local lo activa automáticamente; producción requiere su migración y `SOCIAL_VIDEOS_ENABLED=true`.

1. **Descubrir:** desliza verticalmente; toca el video para pausar/reanudar; activa o silencia el sonido. Solo se reproduce la tarjeta activa y se pausa al abrir la ficha, cambiar de sección o pasar la app a segundo plano. Mantiene pocos reproductores cercanos al elemento visible y carga el feed de cinco en cinco.
2. **Ver propiedad:** abre la ficha obtenida desde la API actual, con fotos, precio y anunciante. Las publicaciones ficticias no reciben consultas.
3. **Propiedades:** recorre el catálogo paginado de la misma instancia local.
4. **Cuenta:** inicia sesión con el administrador local. Guarda una propiedad desde el corazón del feed; los favoritos se almacenan en la misma tabla del backend existente.
5. **Mis videos:** selecciona una propiedad, elige un MP4/H.264 del dispositivo, escribe un título y pulsa **Vincular video como borrador**. Después pulsa **Publicar**. Se permiten cuatro videos activos por propiedad y archivos de hasta 50 MB. También se pueden despublicar o archivar.
6. Pausa la propiedad desde la API/panel conectado a esta misma instancia: tanto el feed como la descarga del video dejan de exponerlo. Se comprueba también que el anunciante esté aprobado y su usuario activo.

Los MP4 generados quedan en `tmp/mobile-local/example-0.mp4` a `example-19.mp4`. Para probar el selector de archivos del emulador puedes arrastrar uno a su ventana; Android lo copia a Descargas. Espera a que aparezca en el selector. La carga puede tardar según el tamaño; espera a que termine antes de salir de la sección.

## Aislamiento

| Recurso | Valor local |
|---|---|
| MySQL | `127.0.0.1:3327`, esquema `propiedades` |
| Archivos del servidor MySQL | `tmp/mobile-local/mysql-data` |
| NestJS en Windows | `http://127.0.0.1:3328/api` |
| NestJS desde Android | `http://10.0.2.2:3328/api` |
| Metro | Puerto `8081`, con redirección ADB |
| Videos del backend | `tmp/mobile-videos` |
| Credenciales y logs | `tmp/mobile-local` |

El esquema se llama `propiedades` por compatibilidad con las protecciones existentes, pero pertenece a **otro proceso MySQL y otro directorio de datos**. No es la BD de DigitalOcean ni la instancia normal de XAMPP. El lanzador comprueba puerto y ruta absoluta antes de ejecutar SQL, rechaza puertos ocupados y no elimina bases de datos.

`LOCAL_MOBILE_SANDBOX=true` impide cargar `backend/.env`. La API escucha solo en loopback; el acceso desde Android usa el alias del host del emulador. Integraciones y tareas están desactivadas. El usuario MySQL de la aplicación tiene permisos de datos solo sobre esta instancia; las migraciones las aplica el lanzador contra el servidor local validado.

Por defecto, la app usa la API local en el puerto 3328 y comprueba `/mobile/environment` antes de mostrar el catálogo. Existe un modo de producción explícito para el backend exclusivo de Propiedades; consulta [Videos en Spaces](../docs/SPACES_VIDEOS.md). Los videos públicos requieren la migración y las variables de Spaces. `mobile:android` conserva el entorno local. Para registro, perfiles y Google consulta [Registro de usuarios](../docs/REGISTRO_USUARIOS.md).

Ctrl+C en la terminal del backend cierra su API y su MySQL. Ctrl+C en la terminal de Expo cierra Metro; el emulador puede permanecer abierto. Los datos se conservan para el siguiente arranque.

## Preparación en otro Windows

Instala Node.js compatible con Expo, XAMPP/MySQL en `C:\xampp\mysql`, Android Studio con Android Emulator y virtualización habilitada. Desde la raíz:

```powershell
npm --prefix backend ci
npm run mobile:install
npm run mobile:setup-android
npm run mobile:backend
# Otra terminal:
npm run mobile:android
```

La preparación descarga herramientas e imagen oficiales de Google; la imagen ocupa varios GB. Se usan las licencias ya aceptadas del SDK o se solicita su aceptación en el proceso oficial. No hace falta una cuenta de Expo para esta prueba en Expo Go. Si ya hay otro emulador abierto, ciérralo antes de iniciar el teléfono de la demo.

Si el puerto 8081 está ocupado, detén el Metro anterior antes de iniciar otro. Si cambias archivos de NestJS, detén y reinicia `mobile:backend`; el comando compila el backend antes de arrancar. Los cambios de React Native se actualizan con Fast Refresh. Los cambios nativos requieren reconstruir la app de desarrollo.

## API y SQL

La tabla adicional se define en `database/VIDEOS_PROPIEDADES_LOCAL.sql` y **el lanzador la instala automáticamente solo en el entorno local**. No debes ejecutar SQL en DigitalOcean para probar esta app.

- `GET /api/mobile/environment`: identifica el sandbox móvil.
- `GET /api/videos?page=1`: videos publicados y su propiedad pública actual.
- `GET /api/videos/:id/content`: MP4 con `Range`, `HEAD`, respuestas 206 y 416; vuelve a comprobar visibilidad en cada petición y evita caché persistente.
- `GET/POST /api/manage/properties/:id/videos`: listado privado y carga multipart (`file`, `title`), con sesión y comprobación de propiedad.
- `PATCH /api/manage/videos/:id`: título y estado `draft`, `published` o `archived`, con control de propiedad.

La relación es `property_videos.property_id → properties.id`. Usuarios, publicaciones, permisos, medios fotográficos y favoritos usan las tablas y servicios existentes. No hay otra copia de las propiedades dentro de la app.

Esta entrega es un prototipo local. Antes de conectar producción se preparará una migración revisada, almacenamiento de videos duradero, validación/transcodificación del contenido, miniaturas, límites de consumo y una app de desarrollo o APK firmada. El almacenamiento local y la validación básica de contenedor de esta demo no sustituyen ese flujo. No está configurado EAS ni se publicó en Play Store.

## Verificaciones

```powershell
npm run mobile:check
cd mobile
npx expo-doctor
npx expo export --platform android --output-dir ../tmp/mobile-export
cd ..
npm run mobile:test  # requiere mobile:backend encendido
```

Resultado de la entrega: TypeScript y bundle Android correctos, 20/20 comprobaciones Expo, 75 pruebas unitarias de backend, 264 comprobaciones de regresión del marketplace y 126 de integración móvil, con cero conexiones a producción. Las pruebas móviles cubren la asociación con propiedades, paginación, permisos, archivos inválidos, streaming parcial, borradores, publicación, archivo y ocultación al pausar la propiedad.

Referencias oficiales: [Expo en Android Emulator](https://docs.expo.dev/workflow/android-studio-emulator/) y [expo-video](https://docs.expo.dev/versions/latest/sdk/video/).
