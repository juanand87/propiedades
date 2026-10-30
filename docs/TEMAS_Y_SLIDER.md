# Diseño moderno, temas y slider de portada

## Uso desde el panel

El administrador configura el marketplace en **Diseño del sitio** (`/panel/diseno`). Cada corredor configura su web en **Mi sitio web** (`/dashboard/sitio`). Ambos editores incluyen las mismas opciones de color y portada, con datos y permisos separados.

En **Colores**, elegir Azul portal, Bosque, Océano, Grafito, Terracota o Ciruela. La selección cambia los cuatro colores del borrador y se refleja en la vista previa; hay que guardar para publicarla. **Ajustar colores individualmente** conserva la edición manual. Todas las paletas pasan la validación de contraste del backend.

En **Imágenes de marca → Tipo de portada**, elegir **Una imagen** o **Slider de imágenes**. Para el slider:

1. Subir o seleccionar entre dos y ocho imágenes de la biblioteca propia.
2. Usar las flechas para ordenarlas y escribir sus descripciones accesibles.
3. Elegir reproducción automática y un intervalo de cuatro a doce segundos.
4. Guardar el diseño. No se puede guardar un slider con menos de dos imágenes.

El slider público incluye flechas, indicadores, posición y pausa/reanudación. Se pausa con el ratón, al enfocar sus controles y al ocultar la pestaña. Respeta la preferencia de movimiento reducido. La vista previa no avanza automáticamente.

Cambiar entre imagen y slider conserva los archivos elegidos en el borrador. Las imágenes que sigan referenciadas en el diseño guardado quedan protegidas frente al borrado; para liberarlas hay que quitarlas del diseño y guardar. Quitar una imagen del diseño no borra el archivo de la biblioteca. Los archivos de sitios pendientes o suspendidos continúan privados salvo otro uso público autorizado.

## Compatibilidad

**No requiere otro SQL.** Los datos se guardan en los JSON existentes de las migraciones 004 y 005. Las referencias del slider son validadas y comprobadas al publicar, servir y eliminar imágenes. Las consultas de uso del slider funcionan en el MySQL administrado y se probaron también en MariaDB 10.4.

Los colores y las imágenes previamente guardados se conservan. Para diseños sin personalizar, el tema predeterminado es Azul portal. El nuevo diseño aplica tipografía sans serif, cabecera flotante cuando la portada es la primera sección, fotografía panorámica, buscador superpuesto, tarjetas modernas y navegación por regiones reales. Las secciones conservan sus órdenes y opciones de visibilidad anteriores.

La imagen de ambientación predeterminada es un recurso generado y optimizado de aproximadamente 225 KB, incluido en `frontend/public/hero-ambientacion.webp`; se identifica como ambientación y no se usa como fotografía de un inmueble anunciado. Puede sustituirse desde el panel. No se agregaron anuncios, estadísticas, mapas ni testimonios ficticios a producción.

El buscador admite región, tipo, dormitorios y presupuesto CLP/UF. Conserva el presupuesto al cerrar el selector y limpia los importes al cambiar de unidad; no realiza conversiones automáticas.

## Correcciones encontradas durante la revisión

- El primer guardado de un corredor nuevo preserva la revisión cero; ya no la reemplaza por uno y genera un conflicto falso.
- El acceso y registro utilizan POST como método nativo y deshabilitan enviar hasta que la aplicación esté preparada, evitando envíos prematuros mediante parámetros URL.
- Se normalizan los nombres UTF-8 recibidos por multipart para conservar acentos en los archivos nuevos, sin modificar archivos existentes.

## Verificación

Compilaciones de backend y frontend correctas, lint del frontend sin errores, 29 pruebas unitarias y 170 comprobaciones de integración en la BD local aislada. Se cubren galerías ajenas, orden, intervalos, duplicados, enlaces privados/públicos, suspensión y bloqueo del borrado de todas las imágenes del slider. Se validaron las seis paletas contra las reglas del servidor.

Revisión en navegador: primer guardado de una cuenta nueva, temas, biblioteca, slider, descripciones, navegación manual, pausa durante más de un intervalo y reanudación automática; buscador y presupuesto con cierre del selector; escritorio y móvil de 390 × 844, sin desbordamiento horizontal. Las capturas contienen datos de QA.

Al iniciar la revisión, la API de producción respondió con la BD lista y el editor general habilitado. El directorio público contenía cero anunciantes: no había un sitio de corredor real publicado que se pudiera revisar de forma pública. Las pruebas completas con corredores se realizaron localmente, sin crear cuentas o anuncios ficticios en producción ni acceder a MundoBeat.
