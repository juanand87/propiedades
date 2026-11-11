# Notificaciones Android con Firebase directo

Proppix envía desde DigitalOcean a Firebase Cloud Messaging HTTP v1. No usa Expo Push Service ni requiere cargar credenciales en Expo. El APK se compila localmente. Se conserva la librería local expo-notifications para registrar el token FCM y mostrar/abrir los avisos.

## Configuración

1. Registrar el paquete Android cl.proppix.app en el proyecto Firebase proppix-66fe8.
2. Guardar google-services.json en C:/xampp/htdocs/propiedades/mobile/google-services.json. Se incorpora automáticamente al generar Android.
3. Guardar la clave privada de la cuenta de servicio FUERA del repositorio. Nunca incluirla en el APK ni pegarla en el chat.
4. En DigitalOcean, componente backend → Settings → Environment Variables, añadir FIREBASE_PROJECT_ID=proppix-66fe8 y FIREBASE_SERVICE_ACCOUNT_BASE64 con el contenido de C:/Users/Juan/.config/proppix/firebase-digitalocean-base64.txt (la cuenta de servicio codificada en Base64) como valor cifrado/secret de ejecución. No usar EXPO_PUBLIC_ para esa credencial. Para ejecución local del backend se admite FIREBASE_SERVICE_ACCOUNT_FILE con una ruta privada absoluta.
5. La cuenta debe tener permiso cloudmessaging.messages.create (rol Firebase Cloud Messaging API Admin). La API Firebase Cloud Messaging HTTP v1 debe estar habilitada.
6. Ejecutar database/NOTIFICACIONES_Y_PORTADAS.sql (ya ejecutado según confirmación). No cambia el esquema al pasar de Expo Push Service a FCM.
7. Compilar y firmar localmente el APK con google-services.json. Instalar la actualización, iniciar sesión y aceptar el permiso de notificaciones.
8. Enviar un mensaje desde otra cuenta con el receptor en segundo plano. Verificar aviso, sonido y apertura del chat. Cerrar sesión y comprobar que ya no recibe avisos de esa cuenta.

La cola guarda mensajes junto al envío, aplica reintentos con espera creciente y retira tokens UNREGISTERED. El estado done significa aceptado por FCM, no confirma lectura ni entrega física al teléfono. Los avisos no muestran texto privado del mensaje en la pantalla bloqueada. Los tokens antiguos de Expo quedan fuera del nuevo envío; iniciar sesión con el APK nuevo registra el token nativo de Google.

## Referencias

- https://firebase.google.com/docs/cloud-messaging/send/v1-api
- https://firebase.google.com/docs/cloud-messaging/error-codes

## Diagnóstico y prueba con la misma cuenta

GET /api/messages/capabilities incluye push.configured y push.google_ready. google_ready comprueba desde el servidor una solicitud validate_only de FCM, sin enviar avisos. La respuesta está almacenada hasta 60 segundos.

En la app, Mensajes → Probar aviso en mi teléfono envía a los dispositivos del usuario autenticado. No requiere otro usuario ni crea conversaciones consigo mismo. Se puede repetir cada 30 segundos y desactivar con PUSH_SELF_TEST_ENABLED=false. FCM accepted confirma que Google aceptó el envío; la recepción física se comprueba en el teléfono. El botón de prueba es independiente de los eventos de comentarios.

## Comentarios y respuestas

Ejecutar database/NOTIFICACIONES_COMENTARIOS.sql. Se guarda una entrega por comentario y dispositivo en la misma transacción del comentario. Un comentario avisa al dueño del video; una respuesta avisa además al autor del comentario padre. Si ambos destinatarios son el mismo usuario, se envía un único aviso de respuesta. Los comentarios propios generan avisos por ahora; se pueden desactivar con PUSH_SELF_ACTIVITY_ENABLED=false sin cambiar el APK. El trabajador procesa la cola cada 10 segundos, aplica reintentos a errores temporales y elimina dispositivos UNREGISTERED. Comprueba que el video siga accesible al destinatario y que comentario, autor y cuenta receptora existan y estén activos. No se incluye el texto privado del comentario en la pantalla bloqueada.

La versión 1.0.10 ya puede recibir estos avisos: no es necesaria otra instalación para esta activación del backend. El enlace de video se incluye en los datos de FCM para la navegación de las siguientes versiones.
