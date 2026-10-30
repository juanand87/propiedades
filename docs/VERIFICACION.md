# Verificación de la entrega

Comprobaciones realizadas el 30 de octubre de 2026:

- Compilación de producción de backend NestJS y frontend Next.js: correcta.
- Backend: 14 pruebas unitarias, en tres suites, correctas.
- Integración: 50 comprobaciones correctas en una instancia MariaDB 10.4 aislada, dentro de `tmp/qa-mysql-data`, puerto 3317. Incluyen migración repetida, conservación de cuentas, permisos, moderación, conflictos de edición, privacidad, multimedia, contactos, visitas y retirada de endpoints anteriores.
- Formato monetario: cinco comprobaciones correctas, incluida UF de gran importe sin pérdida de precisión.
- Auditoría npm: cero vulnerabilidades en dependencias de producción de ambos proyectos; frontend completo también sin vulnerabilidades. El backend conserva nueve avisos en herramientas de desarrollo (ocho bajos y uno alto). No se aplicaron cambios incompatibles mediante `audit fix --force`.
- Navegador: revisión de portada, catálogo y filtros, ficha pública, acceso y panel administrativo; escritorio y viewport móvil de 390 × 844. Capturas en [qa/](qa/).
- Lint del frontend: sin errores. Conserva diez avisos de `no-img-element` por las imágenes WebP ya procesadas por el backend y las previsualizaciones de la biblioteca, servidas directamente sin otro optimizador.

Las fotografías, cuentas y publicaciones de las capturas son datos exclusivos de prueba local. No se incluyen en la migración.

No se ejecutó el SQL en DigitalOcean ni se comprobó contra su instancia administrada de MySQL. No se construyó una imagen Docker; se verificaron compilaciones e inicio directo con Node.js 22. No se modificaron los despliegues ni los recursos de MundoBeat. La publicación requiere aplicar el SQL y desplegar la rama siguiendo [la guía de entrega](ENTREGA_INMOBILIARIA.md).
