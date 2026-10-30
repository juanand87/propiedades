# Separación y transformación inmobiliaria

La versión activa del proyecto está descrita en [docs/ENTREGA_INMOBILIARIA.md](docs/ENTREGA_INMOBILIARIA.md).

## Estado

- Repositorio propio: https://github.com/juanand87/propiedades.git.
- Rama de implementación: codex/marketplace-inmobiliario. main conserva la versión desplegada.
- BD de destino: propiedades, con usuario exclusivo. Comparte servidor MySQL por decisión del usuario; no utiliza otros esquemas.
- El host compartido requiere DB_SHARED_HOST y DB_SHARED_USERNAME exactamente iguales a DB_HOST y DB_USERNAME, DB_SSL=true y DB_SSL_CA con la CA del servidor.
- Las integraciones y recuperación administrativa heredadas permanecen apagadas.
- Migración manual: database/ACTUALIZAR_PROPIEDADES.sql. La aplicación no ejecuta DDL al arrancar.
- Los índices duplicados de shipping_methods y analytics_daily_summary del proyecto musical ya no se generan: esas entidades no están en el registro activo.
- Los respaldos e historial originales se conservan localmente en tmp/mundobeat-local-backup; el código anterior está en legacy. Ambas carpetas contienen material privado y están excluidas de Git y empaquetados.

Se conserva el cambio previo del usuario en backend/sql/alter-question-annulment.sql. Los archivos históricos no forman parte de la migración nueva. No se borran tablas históricas ni se modifica producción de MundoBeat.

Para instalación, administración, pruebas y puesta en producción, seguir exclusivamente la documentación de entrega actual. Las guías históricas de la raíz no describen este marketplace inmobiliario.