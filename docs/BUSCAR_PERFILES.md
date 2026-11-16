# Buscar perfiles · Proppix 1.0.23

## Uso

- Perfil y menú superior: **Buscar perfiles**. Permite buscar por nombre público, @usuario o nombre de empresa, con filtros Todos, Personas y Empresas. Requiere iniciar sesión y escribir al menos dos caracteres.
- Cada resultado muestra foto/logo, nombre, @usuario si está definido, tipo y botón Seguir/Siguiendo. Tocar el nombre o la imagen abre el perfil existente, sus videos y opciones de contacto.
- Al registrarse por correo en la app, se elige Persona o Empresa y se define nombre visible y @usuario. En perfiles de empresa se solicitan por separado nombre y apellido del contacto de la cuenta.
- Los perfiles existentes pueden completar estos datos desde Editar perfil. La app ofrece el formulario la primera vez que se abre un perfil propio aún sin clasificar. Si se cierra, puede abrirse de nuevo con el lápiz.
- Empresa es una clasificación elegida por el usuario, no una verificación comercial. No cambia membresías, permisos, aprobación de anunciante ni el perfil comprador/vendedor.

## Datos y compatibilidad

`database/BUSCAR_PERFILES.sql` crea solo `estate_profile_identity`, con tipo y @usuario único. Puede ejecutarse repetidamente y no cambia nombres públicos existentes, imágenes, videos ni seguidores. No se asignan tipos o nombres de usuario automáticamente a cuentas antiguas.

El @usuario tiene de 3 a 30 caracteres ASCII: letras, números, puntos o guiones bajos, comenzando por letra o número. Se normaliza a minúsculas y admite escribir el prefijo @. Una colisión devuelve 409 y revierte toda la operación. El registro de cuenta e identidad se guarda en una transacción para evitar cuentas parciales.

Los clientes anteriores pueden seguir editando el nombre o la foto sin borrar el tipo ni el @usuario. Los perfiles y los enlaces continúan identificándose internamente por UUID, de modo que cambiar el @usuario no rompe enlaces existentes.

La búsqueda lista perfiles públicos ya configurados, perfiles sociales existentes y autores con videos públicamente visibles. No incorpora cuentas sin perfil público ni videos visibles. Excluye al usuario actual, cuentas suspendidas y bloqueos en ambas direcciones. Solo devuelve información pública: no busca ni devuelve correo, teléfono, contraseña o apellido de contacto. Los perfiles antiguos sin tipo aparecen en Todos como Perfil, hasta que su dueño seleccione Persona o Empresa.

## Despliegue

1. Ejecutar `BUSCAR_PERFILES.sql` en la base `propiedades` de DigitalOcean.
2. Desplegar backend. `GET /api/video-profiles/capabilities` debe indicar `search: true` y `profile_types: true`.
3. Instalar el APK 1.0.23 compilado y firmado localmente. Los registros nuevos de la app necesitan el backend actualizado.

## Validación

- Pruebas unitarias de formato de @usuario, tipos y nombres públicos.
- `scripts/mobile/verify-profile-search.cjs`: datos y API exclusivamente locales; migración repetida, búsqueda por nombre y @usuario, tildes, filtros, comodines literales, privacidad, bloqueos, suspensión, seguimiento, logos, compatibilidad de clientes antiguos, conflictos concurrentes, paginación y registro transaccional.
- Regresión general de cuentas y propiedades; compilación backend; TypeScript y lint móvil; APK local y comprobación de firma y API de producción.

Pendiente prueba visual y de uso en el teléfono. Las pruebas automáticas no crean cuentas ni siguen perfiles en producción.
