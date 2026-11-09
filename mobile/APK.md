# Proppix para Android

Desde mobile, iniciar sesión en Expo y generar un APK firmado:

```powershell
npx eas-cli@latest login
npx eas-cli@latest build -p android --profile preview
```

El primer build vincula el proyecto a tu cuenta Expo y configura la firma Android. Al finalizar entrega un enlace para descargar e instalar el APK en el teléfono. No necesita Metro ni la computadora encendida. Se conecta a DigitalOcean. El perfil social requiere aplicar PERFILES_Y_VIDEOS_SOCIALES.sql y activar SOCIAL_VIDEOS_ENABLED=true en el backend.
