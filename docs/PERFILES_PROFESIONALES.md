# Perfiles de Proppix

- `person`: Particular (compatible con los perfiles Persona existentes).
- `agent`: Agente / corredor independiente.
- `company`: Empresa / corredora.

El tipo público se guarda en `estate_profile_identity`; no modifica el rol de seguridad (`admin`, `vendor`, `customer`), la membresía ni los permisos de publicación directa. Todos pueden buscar propiedades, seguir perfiles y enviar mensajes. Comprar/publicar sigue siendo una preferencia de uso independiente del tipo público.

El registro por correo, la selección posterior al acceso con Google, la edición del perfil y la búsqueda de la app admiten los tres tipos. El panel de usuarios permite al administrador cambiar el tipo por separado de la membresía y el rol. El tipo del anunciante se sincroniza con `owner`, `broker` o `agency`.

Ejecutar `database/PERFILES_PROFESIONALES.sql` antes del despliegue. Conserva los @usuarios existentes y asigna identificadores editables a las cuentas que aún no tenían perfil público.

La sección web **Mi equipo** permite a las empresas aprobadas invitar agentes con cuentas propias, asignarles propiedades y retirar su acceso. Ejecutar también `database/EQUIPOS_CORREDORAS.sql` antes de desplegar esta sección. Las invitaciones vencen a los siete días, son de un solo uso y deben aceptarse con el correo invitado. Se envían con el SMTP configurado; si falla, el panel informa el fallo y ofrece copiar el enlace privado.

Los permisos por propiedad son **lectura** o **proponer cambios**. El agente puede proponer cambios descriptivos y de precio; la empresa revisa y aplica cada propuesta. La aplicación utiliza las reglas normales de publicación de la empresa, verifica que la revisión de la propiedad siga vigente y conserva su propietario, medios y membresía. No se conceden permisos globales de administración ni acceso a los mensajes de la empresa. Retirar al agente elimina sus asignaciones y rechaza sus propuestas pendientes. La gestión del equipo se realiza desde `/dashboard/equipo`; no requiere instalar un APK nuevo.

La verificación documental de agentes y empresas requiere un flujo posterior; elegir Empresa o Agente no acredita identidad ni concede una insignia de verificación.

La sesión de la web vive en `BrowserSessionProvider`, dentro del layout raíz de Next.js. Navegar con enlaces conserva el estado; una recarga completa vuelve a restaurar/renovar la sesión. Las peticiones siguen validándose en el backend y un 401 continúa usando la renovación existente. El preloader tiene una casa animada y respeta movimiento reducido.
