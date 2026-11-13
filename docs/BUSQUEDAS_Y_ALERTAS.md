# Búsquedas guardadas y alertas

APK 1.0.16: Propiedades → elegir ubicación/tipo/operación/dormitorios/precio → Guardar búsqueda. Se guarda en la cuenta, no solo en el teléfono. Mis búsquedas permite aplicar los filtros guardados, pausar/reactivar alertas y eliminar la búsqueda. La pestaña Novedades reúne las coincidencias nuevas y abre la ficha de cada propiedad.

## Activación

Ejecutar database/BUSQUEDAS_Y_ALERTAS.sql en propiedades de DigitalOcean. Es repetible y solo crea estate_saved_searches, estate_search_matches y estate_search_push_deliveries. No modifica propiedades. Instalar el APK 1.0.16 sobre la versión anterior.

El servidor revisa 25 búsquedas activas por minuto, priorizando las que llevan más tiempo sin revisar. Procesa hasta 100 coincidencias por búsqueda en cada pasada y continúa en las siguientes. Cada combinación búsqueda/propiedad se registra una sola vez. Excluye propiedades de demostración, no publicadas, no disponibles, anunciantes no aprobados y cuentas desactivadas. El catálogo y el detector comparten las condiciones de filtros; la búsqueda textual incluye región y comuna. Los límites de precio comparan únicamente la moneda elegida, CLP o UF.

Al guardar o reactivar se toma una referencia de las propiedades existentes, que no generan avisos. Las alertas corresponden a propiedades cuya primera publicación ocurre desde la activación. Pausar cancela los envíos pendientes; eliminar limpia búsquedas, coincidencias y entregas asociadas. Una entrega que Firebase ya aceptó no se puede retirar. Hasta 50 búsquedas por cuenta; guardar filtros equivalentes reutiliza la búsqueda existente.

Las coincidencias quedan en Novedades aunque no haya un teléfono registrado. Para avisos al dispositivo se usan los tokens FCM existentes y la configuración Firebase directa de DigitalOcean. La cola se procesa cada 10 segundos, aplica espera creciente a fallos temporales y elimina tokens UNREGISTERED. Abrir el aviso lleva a la ficha y marca la coincidencia como leída. No incluye la ubicación privada ni filtros personales en la pantalla bloqueada.

PROPERTY_ALERTS_ENABLED=false detiene el detector de nuevas coincidencias. El detector requiere NODE_ENV=production para su ejecución periódica; las pruebas locales lo invocan explícitamente. El APK no hace consultas continuas para detectar publicaciones. Si falta la migración, las funciones existentes siguen operativas y la API de búsquedas responde con un aviso de configuración pendiente.

## Verificación

scripts/mobile/verify-saved-searches.cjs usa únicamente el sandbox local: migración repetida, permisos, filtros equivalentes, precios CLP/UF, referencia inicial, coincidencias nuevas, duplicados, cola push, lectura, pausa, reactivación, retirada y eliminación. Los tests de PushService verifican datos del aviso, supresión de retiradas y reintento sin consumir el evento ante fallos de Firebase.

En teléfono: guardar una búsqueda, comprobar Mis búsquedas y Ver resultados; luego publicar una propiedad real nueva que coincida. Esperar aproximadamente un minuto más el tiempo de envío. Revisar Novedades y tocar el push. La recepción física se valida manualmente; la aceptación de FCM no prueba entrega al teléfono.
