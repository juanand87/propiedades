# Notificaciones de mensajes de Proppix

Se usa Expo Push Service con Firebase Cloud Messaging V1 para Android. La aplicación solicita permiso, registra el dispositivo de la sesión y abre la conversación al tocar el aviso. El servidor guarda el envío en una cola junto con el mensaje, comprueba recibos, reintenta fallos temporales y retira dispositivos inválidos. No incluye el texto privado del chat en la pantalla bloqueada. El cierre de sesión retira el dispositivo antes de borrar la sesión.

## Activación

1. Ejecutar `database/NOTIFICACIONES_Y_PORTADAS.sql` en la base `propiedades`. Es repetible y no borra datos.
2. En https://console.firebase.google.com crear un proyecto Proppix. Añadir una aplicación Android con paquete **cl.proppix.app**.
3. Descargar la configuración de esa aplicación, `google-services.json`, y guardarla en **C:/xampp/htdocs/propiedades/mobile/google-services.json**. También se admite una ruta en la variable `GOOGLE_SERVICES_JSON`. `mobile/app.config.js` la incorpora al generar Android. No pegar archivos ni claves en el chat.
4. En Firebase → Configuración del proyecto → Cuentas de servicio → Generar nueva clave privada. Guardar esa credencial fuera del repositorio.
5. En el proyecto **Proppix** de https://expo.dev → Credentials → Android → **cl.proppix.app** → FCM V1 service account key, cargar esa clave. Es distinta de `google-services.json`. Alternativamente, desde `mobile`, ejecutar `npx eas-cli@latest credentials`, elegir Android y configurar la clave de Push Notifications FCM V1.
6. Generar Android con Expo prebuild y compilar/firmar el APK de nuevo. No hace falta usar la cola de compilaciones de Expo: FCM funciona también con el APK local.
7. Instalar la actualización en un Android con Google Play Services, entrar en la cuenta y aceptar el permiso de notificaciones. En Mensajes debe aparecer “Notificaciones de mensajes activas”.
8. Desde otra cuenta enviar un mensaje con el teléfono receptor en segundo plano. Comprobar aviso, sonido, apertura del chat y que no se repita por reintentar el envío. Cerrar sesión y comprobar que el dispositivo deja de recibir avisos de esa cuenta.

DigitalOcean usa las variables de Spaces existentes para las portadas. El trabajador de avisos arranca en producción cada 10 segundos; se puede desactivar con `PUSH_NOTIFICATIONS_ENABLED=false`. Si el proyecto Expo exige autenticación adicional para Push Service, configurar `EXPO_ACCESS_TOKEN` solo en el servidor.

## Portadas

Los videos nuevos generan un JPEG de hasta 480 × 640 conservando su proporción, guardado en `property_video_posters`. La galería usa imágenes, sin crear reproductores para las miniaturas. Los videos anteriores generan su portada la primera vez que se solicita; se limita a dos trabajos simultáneos por proceso. Las portadas de borradores requieren una firma del propietario y las públicas comprueban que el video siga publicado.

## Referencias

- https://docs.expo.dev/push-notifications/fcm-credentials/
- https://docs.expo.dev/push-notifications/sending-notifications/
