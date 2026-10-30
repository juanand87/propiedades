# Propiedades

Marketplace inmobiliario en Chile: catálogo, fichas, anunciantes, favoritos, consultas, solicitudes de visita y administración.

- Frontend: Next.js/React, directorio `frontend`. En Vercel, Root Directory=`frontend`, preset Next.js.
- Backend: NestJS/MySQL, directorio `backend`. En DigitalOcean, desde raíz: `npm run build` y `npm start`, puerto 8080.
- Requiere Node.js 22 o posterior.
- SQL de actualización: [database/ACTUALIZAR_PROPIEDADES.sql](database/ACTUALIZAR_PROPIEDADES.sql).
- Entrega, migración, variables y pruebas: [docs/ENTREGA_INMOBILIARIA.md](docs/ENTREGA_INMOBILIARIA.md).

## Desarrollo local

Completar backend/.env y frontend/.env.local siguiendo sus plantillas sin secretos. Aplicar el SQL únicamente en una BD propiedades propia. Desde backend: `npm run start:dev`; desde frontend: `npm run dev`. El arranque normal nunca crea tablas.

## Integraciones

La aplicación activa no registra módulos musicales ni comercio físico. Discogs, Spotify, carrito, pedidos, pagos, envíos e inventario fueron retirados. El código anterior queda archivado solo en la carpeta local ignorada legacy. Los datos históricos de la BD se conservan; no se convierten discos en inmuebles.

Las fotografías se guardan optimizadas en la propia BD de Propiedades. No hacen falta credenciales de almacenamiento o servicios de MundoBeat.

## Publicación

Primero aplicar el SQL, después desplegar backend y frontend. La conversión se prepara en una rama independiente: no desplegar código que requiera tablas pendientes. No copiar entornos, respaldos, datos o credenciales del proyecto original.