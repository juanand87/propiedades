# Avisos de propiedades en revisión

## Activación

1. Ejecutar `database/CORREOS_SMTP.sql` en la base `propiedades` de DigitalOcean. Es repetible; crea dos tablas, no modifica propiedades ni importa envíos anteriores.
2. Desplegar backend y frontend.
3. Entrar como administrador en `/panel/correos` (menú **Correos y SMTP**).
4. Configurar servidor, puerto, TLS/STARTTLS, usuario, contraseña, remitente autorizado y destinatarios. Si los destinatarios quedan vacíos, se usan los correos de hasta 20 administradores activos.
5. Guardar y usar **Enviar correo de prueba**. La prueba funciona también con los avisos desactivados. SMTP puede aceptar un mensaje y después enviarlo a spam o rebotarlo: comprobar la bandeja real.
6. Activar los avisos y enviar una propiedad nueva a revisión desde la app o la web.

No requiere un APK nuevo. El disparador está en el backend.

## Seguridad y operación

- Solo administradores pueden leer o modificar SMTP y ejecutar pruebas.
- La contraseña se cifra con AES-256-GCM. No se devuelve por API ni se escribe en logs. Dejar la contraseña vacía conserva la guardada.
- Se usa `SMTP_SETTINGS_ENCRYPTION_KEY` si existe, o la clave persistente `JWT_SECRET` del backend. La clave debe tener al menos 32 caracteres. Si se cambia la clave de cifrado utilizada, volver a guardar la contraseña SMTP en el panel. No compartir claves aquí ni subirlas a Git.
- TLS valida certificados; STARTTLS es obligatorio en ese modo. No existe opción de enviar credenciales sin cifrar.
- Solo se conecta a un destino IPv4 público resuelto para ese envío. No se habilita `INTEGRATIONS_ENABLED`, ni se permiten destinos locales o metadatos de infraestructura.
- El remitente debe estar autorizado por el proveedor (SPF/DKIM según sus instrucciones). Los destinatarios se envían como BCC.
- El aviso incluye título y enlace `/panel/propiedades/{id}/editar`. Se construye con `FRONTEND_URL`; si no está definida, usa `https://propiedades-eta.vercel.app`.

## Cola y reintentos

Al entrar en `pending_review` se registra un evento en la misma transacción que el historial del estado. También se registra cuando editar una propiedad publicada la devuelve a revisión. Editar una propiedad que ya está en revisión no genera otro aviso.

Con los avisos desactivados no se crean eventos nuevos. Si se desactivan, los eventos ya pendientes se conservan y se detiene su envío hasta reactivarlos.

El worker revisa cada 15 segundos, reclama cada evento con una exclusión temporal y envía hasta cinco por ciclo. Reintenta hasta ocho veces con espera creciente, hasta una hora. El panel informa pendientes, fallidos y último error sin exponer respuestas SMTP. La entrega es al menos una vez: si el servidor acepta el mensaje y el proceso se interrumpe antes de guardar el resultado, puede repetirse. El Message-ID se mantiene estable en los reintentos.

Si falla SMTP, la propiedad permanece en revisión y el error no se devuelve al vendedor. Si no se ejecutó la migración, el backend conserva su funcionamiento anterior y el panel explica qué archivo ejecutar; no se generan avisos hasta instalarla.

## Conexión desde DigitalOcean

Usar el puerto indicado por el proveedor: habitualmente 465/TLS o 587/STARTTLS. Si la infraestructura restringe esos puertos, usar un puerto alternativo que el proveedor soporte, por ejemplo 2525/STARTTLS. El panel admite puertos personalizados. Comprobarlo con el correo de prueba; no desactivar la validación TLS.

Referencia: https://docs.digitalocean.com/support/why-is-smtp-blocked/

## Validación

- `npm --prefix backend test`
- `npm --prefix backend run build`
- `node scripts/mobile/verify-review-mail.cjs` con el sandbox local `node scripts/mobile/local.cjs` iniciado.
- `npx tsc --noEmit` y ESLint en `frontend`.

Las pruebas automatizadas no utilizan credenciales ni envían correos reales. La prueba con el proveedor se realiza desde el panel después de configurarlo.
