# Registro de compradores y vendedores

## Activación

1. Ejecutar `database/REGISTRO_Y_MEMBRESIA.sql` en `propiedades` con su usuario exclusivo. Es repetible y agrega tablas; conserva las cuentas existentes.
2. Desplegar el código y agregar `USER_ONBOARDING_ENABLED=true` al servicio NestJS, alcance Run time. Mantener `GOOGLE_AUTH_ENABLED=false` hasta disponer de las credenciales.
3. Guardar y desplegar. `/api/auth/options` debe devolver `onboarding: true`.

El registro usa correo (incluido Gmail) y contraseña de al menos 10 caracteres. Después se elige comprador o vendedor. El comprador abre Descubrir; el vendedor obtiene un perfil propietario pendiente de aprobación y puede crear su primera propiedad sin pago. Las propiedades siguen el proceso de revisión existente.

El administrador asigna la membresía en Panel → Usuarios. Gratis permite 1 propiedad y 10 videos activos, Básico permite 10 propiedades y videos ilimitados, y Pro permite 50 propiedades y videos ilimitados. Se cuentan los videos publicados y en borrador. Eliminar un video libera un espacio. Las propiedades archivadas siguen contando y cambiar de plan conserva los datos existentes. Ejecutar `database/PLANES_MEMBRESIA.sql` antes de desplegar esta actualización.

Los compradores pueden guardar favoritos y enviar consultas desde las fichas. Los vendedores ven las consultas y el total de favoritos en su espacio. Las consultas comparten nombre y correo únicamente tras consentimiento; el vendedor puede responder al correo proporcionado. No se implementa chat instantáneo ni notificaciones push en esta entrega.

## Crear acceso con Google

1. Abrir Google Cloud Console y crear un proyecto exclusivo **Propiedades**.
2. Configurar Google Auth Platform: Branding, nombre Propiedades, correo de soporte, página principal `https://propiedades-eta.vercel.app` y las URLs reales de privacidad y términos del sitio. Seleccionar audiencia externa; en modo pruebas agregar los correos de prueba.
3. Crear un cliente OAuth de tipo **Aplicación web**. El acceso móvil abre el navegador del sistema y utiliza el mismo servidor de autenticación.
4. Agregar como URI de redirección autorizada exacta:

```
https://clownfish-app-2-bgbzm.ondigitalocean.app/api/auth/google/callback
```

5. Guardar en DigitalOcean, componente backend, variables Run time:

```
GOOGLE_CLIENT_ID=el_identificador.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=el_secreto_del_cliente
GOOGLE_AUTH_ENABLED=true
USER_ONBOARDING_ENABLED=true
```

Activar Encrypt para el secreto. No enviar credenciales al chat, GitHub ni variables EXPO_PUBLIC/NEXT_PUBLIC. Guardar y desplegar. El botón Continuar con Google se habilita cuando `/api/auth/options` devuelve `google: true`.

El flujo utiliza código de autorización, PKCE, nonce, cookie de estado HttpOnly y una solicitud de un solo uso en BD. La app y la web consultan el resultado con un secreto temporal; no reciben tokens de Google. Un correo existente con contraseña debe seguir entrando con su contraseña: no se vinculan cuentas automáticamente por coincidencia de correo. La prueba real de Google queda pendiente de crear el cliente y requiere intervención del usuario para autenticarse.

Mantener `INTEGRATIONS_ENABLED=false`. La excepción de red autoriza únicamente HTTPS a los dos hosts de Google necesarios para tokens y certificados.

## Prueba local

`npm run mobile:backend` inicia la BD y API locales, aplica el SQL y habilita perfiles, sin Google. `node scripts/mobile/verify-onboarding.cjs` verifica registro, perfiles, límite concurrente, persistencia y bloqueo de evasión. `npm run mobile:android` inicia la app contra esta API local.

Documentación oficial: https://developers.google.com/identity/openid-connect/openid-connect
