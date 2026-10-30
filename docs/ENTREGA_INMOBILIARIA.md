# Entrega del marketplace inmobiliario

## Alcance

El editor visual posterior a esta entrega se documenta en [DISENO_DEL_SITIO.md](DISENO_DEL_SITIO.md). Para activarlo sobre una base ya instalada se ejecuta únicamente `database/004_diseno_sitio.sql`.

El backend activo es NestJS + MySQL y el frontend Next.js. La experiencia está dedicada a propiedades en venta en Chile: casas, departamentos, parcelas, terrenos, oficinas y locales. No incluye cobros de inmuebles, carrito, envíos, inventario musical, radio ni importaciones de Discogs. Los anunciantes se clasifican como propietario, corredor o inmobiliaria.

El código anterior se conserva localmente en `legacy/`, excluido de Git, Docker y Vercel. Git conserva la versión anterior en main. No es necesario copiar esa carpeta al despliegue. Los endpoints retirados responden 404; las credenciales antiguas no se leen por los módulos activos.

## Datos y permisos

- Usuarios existentes y sus contraseñas se conservan. Una instalación vacía recibe la tabla users sin cuentas predeterminadas.
- Los anunciantes nuevos se solicitan desde `/dashboard/perfil`. La administración debe aprobarlos antes de publicar. Un administrador puede crear su perfil aprobado o seleccionar otro anunciante para una propiedad.
- Una identidad compatible de la tabla vendors de **propiedades** se conserva en advertisers como pendiente de revisión. Solo se trasladan ID, usuario, nombre y slug; no tokens, fotografías, pagos, música ni credenciales.
- La ficha pública devuelve solo campos permitidos. La dirección exacta y las coordenadas permanecen privadas salvo autorización explícita del anunciante.
- El propietario y el administrador pueden gestionar una publicación. La cuenta JWT se vuelve a consultar en cada solicitud protegida, para que las suspensiones y roles tengan efecto inmediato.
- Los JWT antiguos no tienen la nueva audiencia de sesión y exigen volver a iniciar sesión. Las firmas privadas de imágenes tienen otra audiencia y no sirven para autenticarse.

## Flujo de publicación

1. Crear cuenta e iniciar sesión.
2. Completar perfil de anunciante y recibir aprobación administrativa.
3. Crear borrador y subir fotografías propias.
4. Completar título (8 caracteres), descripción (40), precio positivo, región, comuna y al menos una fotografía.
5. Para casa: dormitorios, baños, superficie construida y de terreno. Departamento: dormitorios, baños y construida. Terreno/parcela: superficie de terreno.
6. Enviar a revisión. La administración publica o rechaza con motivo.
7. La disponibilidad (disponible, reservada, vendida) es independiente del estado de publicación. Cambiar una ficha publicada vuelve a enviarla a revisión.
8. Pausar o archivar sin borrar consultas o historial. Es posible recuperar un borrador archivado.

La revisión de una publicación incluye comprobación de su revisión/versionado para no sobrescribir una edición simultánea. Los filtros y la ordenación de precios requieren elegir CLP o UF; no existe una conversión implícita entre ambas unidades. Los importes se almacenan como DECIMAL y viajan como texto; el formateo mantiene los decimales de UF sin conversión a flotante. Las superficies se expresan en m².

## Consultas y visitas

Un visitante puede enviar nombre, correo, teléfono y consulta con consentimiento explícito. Puede solicitar una hora de visita; no se confirma automáticamente. Los registros se guardan aunque no haya SMTP. La administración y el anunciante pueden marcar contactos, cambiar el estado de una visita y agregar notas internas. Esas notas no envían correo ni se muestran al visitante. Las fechas se guardan en UTC y se presentan en America/Santiago.

Se muestran las últimas 200 consultas por vista; usuarios administrativos, hasta 500 por consulta. El catálogo público está paginado, hasta 48 publicaciones por página. Los límites de intentos/contactos se mantienen en memoria de cada instancia; para escalar horizontalmente se deberá incorporar un limitador compartido.

## Fotografías persistentes

Las fotos se almacenan en estate_media, **dentro de la BD propiedades**, evitando perderlas al reiniciar un contenedor. El servidor acepta JPG/PNG/WebP de hasta 8 MB, valida y decodifica el contenido, aplica orientación, retira EXIF y genera WebP de hasta 1600 px y 2 MB. Galería: máximo 20 fotos por publicación. Biblioteca por cuenta: máximo 200 imágenes y aproximadamente 150 MB almacenados.

No se habilita un bucket de MundoBeat ni se necesita uno nuevo para esta entrega. El volumen de fotos consume espacio de la BD de Propiedades: dimensionar ese almacenamiento según el uso real. La capa de medios puede reemplazarse por un bucket propio posteriormente. Las fotos de borradores y biblioteca necesitan firma temporal; las asociadas a una publicación pública o logo aprobado son accesibles públicamente. Las imágenes en uso no se pueden eliminar de la biblioteca.

## SQL de actualización

Archivo completo para MySQL Workbench: **database/ACTUALIZAR_PROPIEDADES.sql**. Contiene en orden:

1. 001_propiedades.sql: tablas y catálogos inmobiliarios iniciales.
2. 002_ubicaciones.sql: 16 regiones y 346 comunas del catálogo local del proyecto, separado de envíos.
3. 003_identidades.sql: preservación opcional de identidades de anunciantes y consultas de comprobación.

No es un dump de producción. No crea la base ni altera otro esquema: utiliza `USE propiedades`. Es aditivo y repetible sobre el esquema original vacío o parcialmente inicializado. No convierte productos musicales en propiedades ni borra tablas antiguas. CREATE TABLE IF NOT EXISTS no transforma una tabla inmobiliaria personalizada incompatible: si ya creaste otra tabla properties distinta, revisar esa definición antes de aplicar.

Las consultas a information_schema comprueban únicamente la estructura de propiedades. La migración no cambia usuarios MySQL, GRANT, configuración del servidor, fuentes confiables ni recursos del cluster. MySQL hace commits implícitos para DDL: un fallo puede dejar una migración parcial. Corregir la causa y repetir; no borrar la BD como solución.

El helper `node scripts/package-migration.cjs`, desde la raíz, mantiene el SQL de entrega idéntico al incluido en backend/scripts/estate-schema.sql. No ejecuta consultas. La aplicación nunca ejecuta DDL durante su arranque.

## Orden de puesta en producción

1. Respaldar **solo propiedades** con el usuario correspondiente. Conservar el commit y la configuración actualmente desplegados.
2. Revisar que el usuario de conexión tenga permisos únicamente sobre propiedades; el código no puede sustituir los permisos del servidor.
3. Abrir el SQL completo en Workbench y ejecutarlo con ese usuario. El resultado esperado incluye 16 regiones, 346 comunas y las tres versiones de estate_migrations.
4. Integrar la rama inmobiliaria en main cuando el SQL se haya aplicado. main no se cambió durante el desarrollo.
5. Desplegar el backend de DigitalOcean. Comprobar `/api/ready`: debe responder 200 y schemaReady=true.
6. Desplegar el frontend de Vercel desde frontend, preset Next.js, salida automática.
7. Iniciar sesión de nuevo. Si falta el administrador, usar el SQL de alta que ya se entregó tras crear users o el helper protegido descrito más abajo.
8. Revisar configuración de marca, contacto y perfiles. Crear una propiedad real, subir fotografías, aprobar y probar una consulta y una visita.

Conservar los flags de integraciones apagados y las variables de aislamiento MySQL/TLS existentes, incluida la aprobación explícita del host y usuario compartidos. Usar Node.js 22 o posterior. Root Directory en DigitalOcean puede ser `/`, con `npm run build`, `npm start` y PORT=8080. El frontend en Vercel debe usar Root Directory=frontend.

Variables del frontend: API_URL=https://BACKEND_PROPIO/api; NEXT_PUBLIC_API_URL=https://BACKEND_PROPIO/api o /api; NEXT_PUBLIC_SITE_URL=https://propiedades-eta.vercel.app. Si se usa /api en el navegador, API_URL debe apuntar al backend para el rewrite. CORS_ORIGINS del backend debe incluir el dominio del frontend. Nunca configurar DB_PASSWORD o JWT_SECRET en variables NEXT_PUBLIC.

El backend público confirmado es `https://clownfish-app-2-bgbzm.ondigitalocean.app`. En Vercel, cuando falta una URL absoluta de API en las variables, el proyecto utiliza ese backend y enruta `/api/*` antes de resolver las páginas dinámicas. Las consultas del servidor y el sitemap comparten el mismo destino. El dominio canónico predeterminado de producción es `https://propiedades-eta.vercel.app`; las variables explícitas siguen teniendo prioridad. Estos valores públicos se definen en `frontend/src/lib/deployment.ts` y no contienen credenciales.

SITE_INDEX_ENABLED=false es el valor conservador durante revisión. Habilitarlo en Vercel únicamente cuando el contenido real esté listo; controla robots y las cabeceras noindex. El SMTP y los mapas de terceros no son requisitos de funcionamiento. El mapa solo ofrece un enlace externo cuando el anunciante publica coordenadas exactas. La API no hace geocodificación ni llamadas de terceros.

## Administrador y migración desde consola

El administrador existente no se cambia. Para una BD sin cuenta administradora, el helper crea una cuenta, nunca reemplaza contraseñas ni eleva usuarios existentes. Ejecutar dentro del directorio backend, con las variables propias del componente:

```bash
read -rsp 'Contraseña nueva del administrador: ' ESTATE_ADMIN_PASSWORD; printf '\n'
printf '%s' "$ESTATE_ADMIN_PASSWORD" | node scripts/create-admin.cjs admin@propiedades.local
unset ESTATE_ADMIN_PASSWORD
```

La contraseña entra por stdin y se cifra con bcrypt; no se guarda en Git ni como argumento del proceso. Usar 10 caracteres como mínimo y hasta 72 bytes. No activar ADMIN_RECOVERY_ENABLED del proyecto anterior.

Si se prefiere aplicar el SQL desde la consola del componente en lugar de Workbench, `node scripts/init-properties-db.cjs` muestra el plan sin conectar y `node scripts/init-properties-db.cjs --apply` aplica la copia empaquetada. El despliegue con buildpacks usa `/workspace/backend`; el Dockerfile de backend usa `/app`. Ejecutar un único método de migración; repetir está permitido pero no es necesario.

## Verificación y límites

Comandos: npm run build en backend y frontend; npm test en backend; node test/frontend-format.cjs para importes exactos. La integración `node test/estate.integration.cjs` solo acepta la instancia QA local 127.0.0.1:3317 y verifica que su datadir esté en tmp/qa-mysql-data antes de resetear su base de pruebas. Nunca debe cambiarse para apuntar a un servidor remoto.

El SQL se probó sobre MariaDB 10.4 de XAMPP en una instancia aislada, no sobre el MySQL administrado de DigitalOcean. Las sentencias utilizan sintaxis compatible con MySQL y no dependen de sincronización automática de TypeORM. Las pruebas cubren instalación repetida, preservación de datos, autenticación, permisos, publicación/moderación, privacidad, imágenes, precisión UF, favoritos, contactos y visitas.

No se ejecutaron migraciones, crearon usuarios ni modificaron datos en DigitalOcean. No se alteraron los proyectos Vercel/DigitalOcean ni sus variables. No se creó una publicación real ni se enviaron correos. El rollback del código es el commit anterior; el SQL es aditivo y deja las estructuras anteriores intactas. No se incluye un script DROP automático de tablas que pudieran contener nuevos contactos o publicaciones.
