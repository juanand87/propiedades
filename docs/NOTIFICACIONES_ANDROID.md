# Notificaciones Android con Firebase directo

Proppix envía desde DigitalOcean a Firebase Cloud Messaging HTTP v1. No usa Expo Push Service ni requiere cargar credenciales en Expo. El APK se compila localmente. Se conserva la librería local expo-notifications para registrar el token FCM y mostrar/abrir los avisos.

## Configuración

1. Registrar el paquete Android cl.proppix.app en el proyecto Firebase proppix-66fe8.
2. Guardar google-services.json en C:/xampp/htdocs/propiedades/mobile/google-services.json. Se incorpora automáticamente al generar Android.
3. Guardar la clave privada de la cuenta de servicio FUERA del repositorio. Nunca incluirla en el APK ni pegarla en el chat.
4. En DigitalOcean, componente backend → Settings → Environment Variables, añadir FIREBASE_PROJECT_ID=proppix-66fe8 y FIREBASE_SERVICE_ACCOUNT_JSON con el JSON completo de la cuenta de servicio como valor cifrado/secret de ejecución. No usar EXPO_PUBLIC_ para esa credencial. Para ejecución local del backend se admite FIREBASE_SERVICE_ACCOUNT_FILE con una ruta privada absoluta.
5. La cuenta debe tener permiso cloudmessaging.messages.create (rol Firebase Cloud Messaging API Admin). La API Firebase Cloud Messaging HTTP v1 debe estar habilitada.
6. Ejecutar database/NOTIFICACIONES_Y_PORTADAS.sql (ya ejecutado según confirmación). No cambia el esquema al pasar de Expo Push Service a FCM.
7. Compilar y firmar localmente el APK con google-services.json. Instalar la actualización, iniciar sesión y aceptar el permiso de notificaciones.
8. Enviar un mensaje desde otra cuenta con el receptor en segundo plano. Verificar aviso, sonido y apertura del chat. Cerrar sesión y comprobar que ya no recibe avisos de esa cuenta.

La cola guarda mensajes junto al envío, aplica reintentos con espera creciente y retira tokens UNREGISTERED. El estado done significa aceptado por FCM, no confirma lectura ni entrega física al teléfono. Los avisos no muestran texto privado del mensaje en la pantalla bloqueada. Los tokens antiguos de Expo quedan fuera del nuevo envío; iniciar sesión con el APK nuevo registra el token nativo de Google.

## Referencias

- https://firebase.google.com/docs/cloud-messaging/send/v1-api
- https://firebase.google.com/docs/cloud-messaging/error-codes
