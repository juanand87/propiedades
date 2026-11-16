# Proppix 1.0.22 · desplazamiento Inicio → Propiedades

El usuario confirmó en su teléfono que el gesto de 1.0.21 abre Propiedades, pero pidió reemplazar el cambio abrupto por un desplazamiento animado.

La nueva superficie mantiene Inicio y Propiedades montados, uno al lado del otro. Al arrastrar hacia la izquierda, el video y su encabezado salen de la pantalla mientras Propiedades entra a la misma velocidad. Al soltar, la animación completa el recorrido o regresa a Inicio. La ruta cambia únicamente cuando finaliza una transición aceptada, evitando desmontar la pantalla en mitad del movimiento.

- Animación de cierre de 240 ms con desaceleración; los botones de navegación entre Inicio y Propiedades usan 260 ms.
- Se completa tras un cuarto de pantalla o un deslizamiento rápido deliberado. Gestos cortos, verticales o cancelados regresan a Inicio.
- Movimiento limitado a los bordes; una animación interrumpida no confirma una ruta anterior.
- Gestos y transformaciones se procesan con Gesture Handler y Reanimated en el hilo de interfaz. El navegador Expo Router permanece montado. La pantalla inactiva no recibe toques ni aparece en accesibilidad.
- La reproducción conserva `textureView`, compatible con transformar visualmente el video. El video se pausa al completar el cambio de sección.

## Validación

TypeScript, lint y `scripts/mobile/verify-home-page-motion.cjs`. Esta prueba ejecuta los callbacks y estilos reales del pager con un entorno de animación simulado; comprueba posiciones de ambas páginas, navegación al finalizar, retorno por gesto corto, gesto rápido, cancelación, movimiento vertical, interrupción y límites.

APK compilado y firmado localmente, paquete `cl.proppix.app`, versión 1.0.22, código 23. Pendiente comprobar la fluidez y la apariencia en el teléfono; no se realizó una nueva prueba visual del emulador en esta entrega.
