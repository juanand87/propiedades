# Footer del sitio principal

Ruta: **Panel → Diseño del sitio → Contacto y pie**. Solo administración puede publicar esta configuración.

Permite cambiar el texto de presentación, el título de contacto y la nota al pie; añadir Instagram, Facebook, LinkedIn, YouTube, TikTok y X/Twitter; y publicar teléfono, WhatsApp y correo del marketplace. Los campos vacíos se ocultan. Restaurar texto original recupera la presentación anterior. Por defecto se usa el correo general de Configuración del sitio; Volver al correo general del sitio elimina los contactos personalizados del footer.

La vista previa muestra el borrador. Los cambios se guardan juntos con **Guardar y publicar diseño**, y se conservan tras recargar. Las redes requieren HTTPS y un dominio de la red seleccionada; el editor completa el protocolo al pegar enlaces sin él.

Los datos se guardan en el JSON de estate_settings y no se comparten con advertiser_sites. Los footers de inmobiliarias conservan su configuración propia. No requiere SQL. La configuración global devuelve design_version 4 y el editor espera esa versión antes de habilitar los campos nuevos durante el despliegue.

Verificación: 43 pruebas unitarias y 191 comprobaciones de integración, con permisos de administración, persistencia, rechazo de enlaces incorrectos, compatibilidad con diseños anteriores y separación de los corredores. Todas las conexiones de integración se hicieron a la base local aislada, con cero conexiones a producción. Compilaciones de backend y frontend correctas y lint sin errores.

Se comprobó desde el navegador el guardado administrativo, la normalización de HTTPS, persistencia tras recargar y los textos y enlaces del footer público. El footer público se revisó a 390 × 844 sin desbordes.

Capturas: [editor](qa/footer-principal-editor.png), [sitio de QA](qa/footer-principal-publicado.png) y [móvil](qa/footer-principal-movil.png).
