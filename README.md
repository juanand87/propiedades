# Propiedades

Copia local de MundoBeat en proceso de separación para un marketplace inmobiliario.

La configuración activa usa únicamente recursos propios pendientes de completar. Las integraciones y tareas automáticas están desactivadas. Repositorio Git exclusivo: https://github.com/juanand87/propiedades.git. Se conserva el commit inicial remoto y el historial de MundoBeat queda únicamente en el respaldo local.

Consulta [SEPARACION.md](SEPARACION.md) para el diagnóstico, variables, inicialización de la BD vacía, Vercel y pendientes. La documentación restante proviene del proyecto original: no ejecutar sus instrucciones de producción.

- Backend: NestJS + TypeORM + MySQL, directorio backend.
- Frontend: Next.js, directorio frontend.
- Plantillas: backend/.env.example y frontend/.env.example.
- Credenciales locales: backend/.env y frontend/.env.local, ignoradas por Git.
- Respaldo privado: tmp/mundobeat-local-backup, ignorado por Git y empaquetados.

Falta completar el usuario exclusivo de la BD propiedades, preparar su esquema y definir URLs propias. No se conectó a MundoBeat ni se ejecutaron migraciones o despliegues.
