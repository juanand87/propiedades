# Regiones y comunas de Chile

Fuente: [SUBDERE, Códigos Únicos Territoriales](https://www.subdere.gov.cl/documentacion/c%C3%B3digos-%C3%BAnicos-territoriales-actualizados-al-06-de-septiembre-2018), archivo CUT_2018_v04.xls. Catálogo de 16 regiones y 346 comunas, incluida Ñuble.

Ejecutar `database/CODIGOS_TERRITORIALES_CHILE.sql` en `propiedades`, después del esquema base. No requiere cambiar variables ni activar integraciones.

- `estate_regions.cut_code`: CUT regional de dos caracteres.
- `estate_communes.cut_code`: CUT comunal de cinco caracteres, único; conserva ceros iniciales, por ejemplo Iquique `01101`, Santiago `13101`, Los Lagos `14104`.
- `estate_communes.province_code`: código provincial de tres caracteres.
- Los campos `id`, `region_id` y las referencias de las propiedades se conservan. Los IDs internos existentes no equivalen a los CUT oficiales.
- La migración admite repetición, completa comunas oficiales faltantes y conserva comunas personalizadas sin inventarles un código.
- `/api/catalog` entrega los campos nuevos automáticamente mediante el catálogo existente.

La app muestra Seleccionar antes de elegir ubicación. Cambiar región limpia la comuna; el backend comprueba que la comuna pertenezca a la región enviada.

El SQL se aplica al entorno de pruebas local; la BD pública requiere ejecución manual por su responsable.
