# Separación de Propiedades

Preparación local realizada el 28 de octubre de 2026. No se realizaron conexiones a bases de datos, servicios de MundoBeat, Vercel ni GitHub. Configurar el remoto Git fue una operación local. No se ejecutaron despliegues, importaciones SQL, envíos de correo ni pagos.

## Estado

| Área | Preparado | Pendiente |
| --- | --- | --- |
| Git | Rama main basada en el commit inicial de Propiedades; origin exclusivo | Mantener respaldos, credenciales y documentación heredada fuera del repositorio |
| Backend | NestJS con MySQL; valida PROJECT_ID y BD propiedades; CORS explícito | Host, usuario y contraseña exclusivos; alojamiento propio del backend |
| BD | Inicializador para una BD vacía, sin datos heredados | Revisar esquema e inicializar cuando estén configuradas las credenciales |
| Frontend | Next.js; API, sitio y assets configurables; sin rewrite al backend anterior | Dominio/URL Vercel y URL HTTPS del nuevo backend |
| Integraciones | Salidas TCP distintas de la BD bloqueadas por defecto; cron, intervalos y timeouts apagados | Diseñar cuáles corresponden al negocio inmobiliario y darles credenciales propias |
| Almacenamiento | uploads-propiedades local y separado | Bucket/CDN propios si se necesitan en producción |
| Deploy | Workflow SSH y manifiestos heredados retirados de sus rutas activas | Configurar un despliegue exclusivo |
| Indexación | robots bloquea rastreo y middleware agrega noindex | Revisar marca, SEO y contenido antes de abrir indexación |

## Configuración local

1. Completar `backend/.env`: DB_HOST, DB_PORT, DB_USERNAME y DB_PASSWORD del usuario exclusivo. DB_DATABASE y PROJECT_ID deben seguir siendo propiedades. El usuario root/doadmin está bloqueado. El JWT local ya se generó al separar la copia; no reutilizarlo en otros entornos.
2. Mantener INTEGRATIONS_ENABLED=false, SCHEDULED_JOBS_ENABLED=false y ADMIN_RECOVERY_ENABLED=false.
3. En `frontend/.env.local`, API_URL y NEXT_PUBLIC_API_URL deben terminar en `/api`. NEXT_PUBLIC_SITE_URL es la URL del frontend. NEXT_PUBLIC_ASSET_BASE_URL es el origen del backend o CDN propio, sin `/api`.
4. Desde backend, ejecutar `node scripts/init-properties-db.cjs` para validar el plan sin conectar. Solo `node scripts/init-properties-db.cjs --apply` conecta y crea el esquema, y únicamente si no existe ninguna tabla. No ejecutar si ya se ha diseñado otro esquema inmobiliario.
5. Después de inicializar, arrancar backend con `npm run start:dev` y frontend con `npm run dev`, cada uno desde su directorio. No se creó una cuenta administradora ni se importaron semillas.

El inicializador genera tablas de las entidades heredadas mediante TypeORM. Es una base técnica del código actual, todavía orientada al comercio musical: **no es un modelo inmobiliario**. No debe sustituir una migración diseñada para propiedades, ubicaciones, operaciones de venta/arriendo, corredores y consultas. `synchronize` sigue desactivado durante el arranque normal. MySQL puede aplicar DDL parcialmente si hay un error: revisar el resultado antes de reintentar; el script rechaza una BD que dejó de estar vacía.

## Vercel y backend

En el proyecto Vercel exclusivo, usar Root Directory `frontend`, framework Next.js y build `npm run build`. No se enlazó el CLI ni se tocaron proyectos remotos. Configurar por separado Production y Preview:

| Variable | Valor requerido |
| --- | --- |
| API_URL | https://NUEVO-BACKEND/api |
| NEXT_PUBLIC_API_URL | https://NUEVO-BACKEND/api |
| NEXT_PUBLIC_SITE_URL | https://NUEVO-FRONTEND |
| NEXT_PUBLIC_ASSET_BASE_URL | https://NUEVO-BACKEND o CDN exclusivo |
| NEXT_PUBLIC_STORE_DOMAINS_ENABLED | false |
| NEXT_PUBLIC_ANALYTICS_ENABLED | false |
| INTEGRATIONS_ENABLED | false |

El backend NestJS necesita un alojamiento aparte; el proyecto Vercel del frontend no lo despliega. Configurar allí NODE_ENV=production, PROJECT_ID=propiedades, la BD y usuario exclusivos, JWT_SECRET aleatorio propio, BACKEND_URL/API_PUBLIC_URL del backend, FRONTEND_URL y CORS_ORIGINS del nuevo frontend. DB_PASSWORD es obligatorio en producción. La conexión MySQL conserva la configuración heredada sin TLS explícito: definir CA/TLS antes de utilizar una BD remota que lo requiera. No usar credenciales de MundoBeat para resolverlo.

Las variables NEXT_PUBLIC_* se incorporan durante el build: recompilar tras cambiarlas. Los fallbacks localhost sirven solo para desarrollo. No desplegar con localhost como API. Los dominios personalizados y subdominios quedan desactivados en el middleware; las tiendas usan `/tiendas/:slug`. Reactivar la variable por sí sola no restaura el enrutamiento: requiere implementación y revisión propia.

## Integraciones y límites

Se conservaron módulos de Payku/Flow, SMTP, Spaces/S3, WooCommerce, Mercado Libre, Falabella, Paris, envíos, Spotify, Discogs e IA para revisión posterior. No se transfirieron sus credenciales al entorno activo ni sus ajustes desde la BD original. Storage usa el directorio nuevo; el proxy de imágenes del frontend devuelve 503 mientras las integraciones estén apagadas. Vercel Analytics está apagado.

`project-isolation.ts` instala un control en `net.Socket.connect` antes de inicializar TypeORM: con las integraciones apagadas permite solo el host/puerto configurados de la BD. Rechaza nombres conocidos de infraestructura heredada incluso al habilitar integraciones. Es un control de esta aplicación Node, no un firewall ni una protección para scripts externos, procesos hijos, redirecciones del navegador o recursos identificados solamente por IP. No habilitar integraciones sin revisar destinos y credenciales propios. Los scripts operativos heredados fueron apartados para evitar ejecutarlos por rutina.

Se sustituyeron endpoints productivos y assets remotos de MundoBeat por fallbacks locales. Quedan textos de marca, correos de ejemplo, reglas de dominios heredados, contenido comercial musical y referencias históricas en documentación/pruebas. No se hizo un rebranding completo. Los assets remotos sustituidos pueden quedar sin imagen hasta crear o cargar recursos propios. No copiar uploads, dumps, usuarios, clientes, pedidos ni settings de producción.

## Git y respaldo

El historial original está en `tmp/mundobeat-local-backup/git-history`; se verificó su último commit `a39aa8a`. El repositorio activo usa origin=https://github.com/juanand87/propiedades.git. El 30 de octubre se verificó el acceso de lectura y escritura y se conservó su commit inicial edda087d como base. No incluye el historial de MundoBeat. El cambio previo en `backend/sql/alter-question-annulment.sql` se conservó en disco. Los SQL están ignorados en el repositorio nuevo: seleccionar expresamente las futuras migraciones que corresponda versionar.

El respaldo local incluye los antiguos entornos, README, despliegues, scripts y build Next. **Contiene información sensible y no debe publicarse.** Está excluido de Git, Docker y Vercel. Los entornos activos y uploads también están ignorados; solo se versionan plantillas sin secretos. La exclusión no sustituye una revisión antes del primer commit: los documentos y fuentes heredados también deben auditarse antes de publicar el repositorio.

El único remoto activo es `https://github.com/juanand87/propiedades.git`, indicado por el usuario. No volver a usar el remoto tiendas. La preparación del 28 de octubre no incluyó push. La publicación del proyecto se realiza únicamente en el repositorio Propiedades indicado por el usuario; no se cambiaron secretos o accesos de producción.

## Verificación

- Backend: `npm run build`.
- Backend: `npx jest src/config/project-isolation.spec.ts --runInBand`, tres pruebas de validación y bloqueo antes de una conexión real.
- Frontend: `npm exec tsc -- --noEmit --incremental false`.
- Se validó el modo de planificación del inicializador sin conexión, usando un usuario ficticio solo en el proceso de prueba.
- Se verificaron el respaldo Git, el único remoto activo propiedades y las exclusiones de entornos/respaldo.

No se verificó el arranque contra MySQL, la inicialización real del esquema, un build completo de Next.js ni un despliegue remoto. Esas comprobaciones requieren completar los datos exclusivos y, para el build de Next, sus dependencias de fuentes/servicios.

## Revisión previa a publicación — 30 de octubre de 2026

El repositorio GitHub es público. Se excluyeron de Git los documentos operativos heredados de la raíz, exportaciones de datos, fixtures históricos de recibos y plugins de WooCommerce de la raíz; se conservan localmente. Se revisaron los archivos publicables mediante patrones de claves privadas, tokens, contraseñas literales, credenciales en URLs y JWT. Los únicos candidatos eran valores ficticios de pruebas; no se detectaron credenciales reales con esos patrones. Esta comprobación es limitada y no equivale a una auditoría completa de secretos.

El acceso por Git funciona con el gestor de credenciales del sistema. La sesión de GitHub CLI (gh) reportó un token inválido, pero no es necesaria para commit/push por Git y no se modificó.
