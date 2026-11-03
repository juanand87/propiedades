"use client";
import {
  brokerFooterText,
  marketplaceFooterText,
  socialNetworks,
  type SiteDesign,
  type SiteContact,
} from "@/lib/site-design";

export function BrokerFooterEditor({
  draft,
  update,
  profileContact,
  siteName,
  ready,
  marketplace = false,
}: {
  draft: SiteDesign;
  update: (key: keyof SiteDesign, value: unknown) => void;
  profileContact: SiteContact;
  siteName: string;
  ready: boolean;
  marketplace?: boolean;
}) {
  const contact = draft.footer_contact ?? profileContact;
  function changeSocial(network: string, url: string) {
    update("footer_socials", [
      ...(draft.footer_socials || []).filter(
        (item) => item.network !== network,
      ),
      ...(url ? [{ network, url }] : []),
    ]);
  }
  return (
    <section className="panel-card broker-footer-editor">
      <h2>Personaliza el footer</h2>
      {!ready && (
        <p className="notice">
          La edición del footer estará disponible al terminar la actualización
          del backend. Recarga esta página en unos minutos.
        </p>
      )}
      <fieldset disabled={!ready}>
        <label>
          Texto de presentación del footer
          <textarea
            maxLength={600}
            rows={4}
            value={
              marketplace
                ? marketplaceFooterText(draft)
                : brokerFooterText(draft, siteName)
            }
            onChange={(e) => update("footer_text", e.target.value)}
          />
          <small>Hasta 600 caracteres. Déjalo vacío para ocultarlo.</small>
        </label>
        <button
          className="text-button"
          type="button"
          onClick={() => update("footer_text", null)}
        >
          Restaurar texto original
        </button>
        <label>
          Título de contacto del footer
          <input
            maxLength={100}
            value={draft.footer_contact_title ?? "Hablemos de tu próximo lugar"}
            onChange={(e) => update("footer_contact_title", e.target.value)}
          />
        </label>
        <label>
          Nota al pie (opcional)
          <textarea
            maxLength={200}
            rows={2}
            placeholder="Ejemplo: Atención de lunes a viernes, con cita previa."
            value={draft.footer_note || ""}
            onChange={(e) => update("footer_note", e.target.value)}
          />
        </label>
        <h3>Datos de contacto de tu sitio</h3>
        <p>
          {marketplace
            ? "Se muestran en el footer del sitio principal. No modifican los contactos de las inmobiliarias."
            : "Se muestran en el bloque de contacto, la cabecera y el footer de tu sitio. No modifican los datos de tu perfil en el marketplace."}
        </p>
        <p className="notice">
          {draft.footer_contact
            ? "Usas datos personalizados para este sitio."
            : marketplace
              ? "Usas el correo general de Configuración del sitio."
              : "Usas los datos públicos de tu perfil."}
        </p>
        {(
          [
            ["phone", "Teléfono", "+56 9 1234 5678"],
            ["whatsapp", "WhatsApp", "+56 9 1234 5678"],
            ["email", "Correo de contacto", "contacto@tuinmobiliaria.cl"],
          ] as const
        ).map(([key, label, placeholder]) => (
          <label key={key}>
            {label}
            <input
              type={key === "email" ? "email" : "tel"}
              maxLength={key === "email" ? 190 : 40}
              value={contact[key]}
              placeholder={placeholder}
              onChange={(e) =>
                update("footer_contact", { ...contact, [key]: e.target.value })
              }
            />
            <small>
              {key === "whatsapp"
                ? "Incluye el código de país, por ejemplo +56 para Chile."
                : "Déjalo vacío para no mostrar este canal en tu sitio."}
            </small>
          </label>
        ))}
        <button
          className="button outline small"
          type="button"
          disabled={!draft.footer_contact}
          onClick={() => update("footer_contact", null)}
        >
          {marketplace
            ? "Volver al correo general del sitio"
            : "Volver a usar los datos del perfil"}
        </button>
        <h3>Redes sociales</h3>
        <p>
          Pega el enlace completo de cada perfil. Deja vacías las redes que no
          quieras publicar.
        </p>
        {socialNetworks.map((network) => (
          <label key={network.id}>
            {network.name}
            <input
              type="url"
              maxLength={500}
              placeholder={network.placeholder}
              value={
                draft.footer_socials?.find(
                  (item) => item.network === network.id,
                )?.url || ""
              }
              onChange={(e) => changeSocial(network.id, e.target.value)}
              onBlur={(e) => {
                const value = e.target.value.trim();
                if (value && !/^[a-z][a-z0-9+.-]*:/i.test(value))
                  changeSocial(network.id, `https://${value}`);
              }}
            />
          </label>
        ))}
        <p className="muted">
          {marketplace
            ? "Publica los cambios con Guardar y publicar diseño."
            : "Los cambios se publican con Guardar mi sitio."}{" "}
          Los enlaces deben pertenecer a la red social indicada.
        </p>
      </fieldset>
    </section>
  );
}
