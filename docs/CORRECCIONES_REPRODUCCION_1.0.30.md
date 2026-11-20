# Proppix 1.0.30

- Reproducción: precarga el siguiente video con 1,25 s protegidos del video visible (antes 2,5 s), y el segundo con 4 s (antes 6). Mantiene la prioridad del visible y reduce la precarga si su búfer baja. La comprobación pasa de 250 a 100 ms. Arranque/reanudación nativa con mínimo de 150 ms de contenido en búfer (antes 650 ms). Estos valores no garantizan una latencia real de 150 ms ni reproducción instantánea si no hay datos de red.
- Pausa: el reproductor de video deja pasar el toque a la superficie de control. El comando nativo se envía en el evento de toque, antes de esperar el estado React. Hay un único responsable de reproducir/pausar en el visor del perfil.
- Perfil: un gesto solo puede llegar al video anterior o siguiente; el activo cambia durante el gesto, no al final. Conserva montados los vecinos para evitar recargas al volver.
- Seguir: el feed y la galería incluyen el estado por usuario; mientras no se conoce no se muestra Seguir como valor supuesto. Inicio, perfiles y búsquedas comparten la relación por cuenta durante la sesión, y se reconfirma con el servidor. No se mezcla entre cuentas.
- Diseño: seguir, compartir y me gusta usan contornos blancos e interior transparente. Los estados seleccionados mantienen su indicación accesible y sus contadores.
- Buscar perfiles: elimina la unión global de perfiles y videos de la condición de búsqueda. Comprueba el perfil público directamente y solo busca un video visible del candidato como alternativa. Conserva filtros Persona/Empresa, bloqueos bilaterales, exclusión de cuentas inactivas y privacidad de cuentas sin perfil público.

Sin SQL ni variables nuevas. Instalar el APK 1.0.30 sobre el actual. El backend se publica desde main.

Se reproduce además el error de comparación de identificadores entre colaciones utf8mb4 distintas (ER_CANT_AGGREGATE_2COLLATIONS). La consulta de bloqueos del directorio convierte el identificador del candidato a utf8mb4_unicode_ci explícitamente, como los identificadores sociales. No cambia las tablas de usuarios. La regresión usa tablas temporales y comprueba ambos sentidos del bloqueo.
