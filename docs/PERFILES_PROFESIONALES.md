# Perfiles de Proppix

- `person`: Particular (compatible con los perfiles Persona existentes).
- `agent`: Agente / corredor independiente.
- `company`: Empresa / corredora.

El tipo público se guarda en `estate_profile_identity`; no modifica el rol de seguridad (`admin`, `vendor`, `customer`), la membresía ni los permisos de publicación directa. Todos pueden buscar propiedades, seguir perfiles y enviar mensajes. Comprar/publicar sigue siendo una preferencia de uso independiente del tipo público.

El registro por correo, la selección posterior al acceso con Google, la edición del perfil y la búsqueda de la app admiten los tres tipos. El panel de usuarios permite al administrador cambiar el tipo por separado de la membresía y el rol. El tipo del anunciante se sincroniza con `owner`, `broker` o `agency`.

Ejecutar `database/PERFILES_PROFESIONALES.sql` antes del despliegue. Conserva los @usuarios existentes y asigna identificadores editables a las cuentas que aún no tenían perfil público.

Las tablas `estate_company_teams`, `estate_company_members` y `estate_company_property_assignments` son la base para una etapa posterior. Todavía no hay invitaciones ni acceso compartido: no se amplían los permisos de ninguna cuenta. La verificación documental de agentes y empresas también requiere un flujo posterior; elegir Empresa o Agente no acredita identidad ni concede una insignia de verificación.

La sesión de la web vive en `BrowserSessionProvider`, dentro del layout raíz de Next.js. Navegar con enlaces conserva el estado; una recarga completa vuelve a restaurar/renovar la sesión. Las peticiones siguen validándose en el backend y un 401 continúa usando la renovación existente. El preloader tiene una casa animada y respeta movimiento reducido.
