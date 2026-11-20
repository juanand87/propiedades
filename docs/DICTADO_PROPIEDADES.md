# Dictar propiedad · Proppix 1.0.28

## Configurar la IA

1. Crea un proyecto propio de Proppix en https://platform.openai.com/ y activa la facturación de la API o carga saldo. La suscripción de ChatGPT no sustituye el saldo de la API.
2. Crea una clave de API del proyecto. No la pegues en un chat ni en el repositorio.
3. En DigitalOcean → propiedades-app → Settings → componente backend → Environment Variables agrega estas variables con alcance **Run time**:

| Variable | Valor | Encrypt |
|---|---|---|
| PROPERTY_DICTATION_ENABLED | true | No es necesario |
| OPENAI_API_KEY | Tu clave del proyecto OpenAI | Sí |

Los modelos predeterminados son OPENAI_TRANSCRIBE_MODEL=gpt-transcribe y OPENAI_PROPERTY_MODEL=gpt-6.1-terra. Puedes definirlos como variables Run time si necesitas cambiarlos por otros compatibles con transcripción y Responses con salidas estructuradas, respectivamente. La extracción usa reasoning.effort=none. No se usan modelos antiguos retirados para nuevas integraciones.

Guarda y deja terminar el despliegue del backend. No agregues claves en Vercel, en variables EXPO_PUBLIC ni en la app. No hace falta activar INTEGRATIONS_ENABLED globalmente: solo api.openai.com por HTTPS está permitido para esta función cuando se habilita con clave. No requiere SQL nuevo.

Configura alertas de gasto y/o créditos prepagados en el proyecto OpenAI; una alerta presupuestaria no es necesariamente un corte automático. El backend limita cada cuenta a tres propuestas por minuto y 40 por día por instancia, con un máximo de cuatro procesos simultáneos. Estas protecciones no sustituyen los controles de facturación del proveedor.

## Usar y revisar

Instala el APK 1.0.28 sobre la versión actual. En Crear/Editar propiedad pulsa **Dictar propiedad**, permite el micrófono y describe hasta tres minutos. Termina la grabación y pulsa **Interpretar grabación**. También puedes corregir la transcripción o escribir el texto y volver a interpretarlo. La web ofrece el mismo flujo en el editor; grabar requiere un navegador con micrófono y HTTPS.

La propuesta muestra cada campo, sus valores anteriores y advertencias. Selecciona qué aplicar; precio/moneda y región/comuna se revisan juntos para evitar inconsistencias. Al aplicar, vuelve al formulario editable. Solo sus botones habituales guardan o envían a revisión. Elegir Arriendo conserva rent en el guardado; no se transforma silenciosamente en Venta. No se modifican fotos, propietario ni publicación mediante IA.

El dictado admite los 28 campos de datos: título, resumen, descripción, tipo, operación, precio y moneda, región y comuna, sector, dirección privada, latitud y longitud privadas, tres superficies, dormitorios, baños, estacionamientos, bodegas, año de construcción, pisos, piso de unidad, estado, gastos comunes, contribuciones, moneda de gastos y periodicidad. También propone las 14 características del catálogo. Una característica afirmada se marca; una negada explícitamente se desmarca; las no mencionadas se conservan. Fotos, videos y autorización de mostrar dirección/coordenadas se controlan manualmente. No hay SQL nuevo.

Los datos ausentes no se rellenan con suposiciones. Las ubicaciones se contrastan contra el catálogo de regiones y comunas; una comuna ambigua queda para selección manual. Las advertencias y el formulario permiten completar datos requeridos antes de guardar.

## Audio y pruebas

El audio y el texto se envían a OpenAI para transcripción y extracción. Proppix no crea tablas de audio ni guarda la transcripción como registro separado: solo queda lo que el usuario acepte y guarde en la propiedad. Se valida audio real, duración máxima de 181 segundos (tolerancia de finalización) y máximo de 12 MB. Los temporales del servidor se retiran al terminar, incluso ante errores; la app elimina su grabación al aplicarla o cerrar. Responses se solicita con store=false; el tratamiento del proveedor se rige por sus políticas de API, no por una promesa de retención cero.

Se verificaron TypeScript y lint móvil, build backend, 206 pruebas unitarias (incluyen respuestas de IA simuladas), audio WAV/WebM real con FFprobe/FFmpeg, rechazo de archivos corruptos y largos, limpieza temporal, 10 comprobaciones HTTP locales de permisos y guardado explícito en borrador, y aplicación selectiva sin alterar campos protegidos. Build web con Webpack. Las pruebas no consumieron saldo de OpenAI. La prueba con voz e IA reales requiere completar la configuración anterior y conceder micrófono en el dispositivo.

Referencias: https://developers.openai.com/api/docs/quickstart , https://developers.openai.com/api/docs/guides/speech-to-text , https://developers.openai.com/api/docs/guides/structured-outputs .
