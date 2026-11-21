"use client";

import { useEffect, useState } from "react";
import { Mail, Save, Send } from "lucide-react";
import { request, send } from "@/lib/estate-api";
import { Notice } from "./EstateApp";

type Settings = {
  enabled: boolean;
  host: string;
  port: number;
  security: "tls" | "starttls";
  username: string;
  from_email: string;
  from_name: string;
  recipients: string[];
  password_configured: boolean;
  delivery: { pending: number; failed: number; last_sent_at: string | null };
  last_error: string | null;
};

export function MailAdmin() {
  const [form, setForm] = useState<Settings | null>(null);
  const [recipients, setRecipients] = useState("");
  const [password, setPassword] = useState("");
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    request("/admin/mail", { signal: controller.signal })
      .then((r: Settings) => {
        setForm(r);
        setRecipients(r.recipients.join("\n"));
      })
      .catch((e: Error) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, []);
  function change(patch: Partial<Settings>) {
    setForm((current) => current && { ...current, ...patch });
    setDirty(true);
    setSuccess("");
  }
  return (
    <>
      <span className="eyebrow">ADMINISTRACIÓN</span>
      <h1>
        <Mail size={28} /> Correos y SMTP
      </h1>
      <p>
        Recibe un aviso cuando una propiedad se envíe a revisión desde la app o
        la web.
      </p>
      <Notice error={error} success={success} />
      {!form ? (
        <p>
          {error
            ? "No se pudo cargar la configuración."
            : "Cargando configuración…"}
        </p>
      ) : (
        <>
          <form
            className="panel-card"
            onSubmit={async (event) => {
              event.preventDefault();
              setBusy(true);
              setError("");
              setSuccess("");
              try {
                const saved = (await send(
                  "/admin/mail",
                  {
                    enabled: form.enabled,
                    host: form.host,
                    port: form.port,
                    security: form.security,
                    username: form.username,
                    from_name: form.from_name,
                    from_email: form.from_email,
                    recipients: recipients
                      .split(/[\n,;]+/)
                      .map((v) => v.trim())
                      .filter(Boolean),
                    ...(password ? { password } : {}),
                  },
                  "PATCH",
                )) as Settings;
                setForm(saved);
                setRecipients(saved.recipients.join("\n"));
                setPassword("");
                setDirty(false);
                setSuccess(
                  "Configuración guardada. Puedes enviar un correo de prueba.",
                );
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <h2>Envío de avisos</h2>
            <label className="check-label">
              <input
                type="checkbox"
                checked={form.enabled}
                disabled={busy}
                onChange={(e) => change({ enabled: e.target.checked })}
              />
              Avisar por correo al enviar una propiedad a revisión
            </label>
            <p>
              Los avisos se envían en segundo plano. Si falla la conexión, se
              reintentan sin impedir que la propiedad quede en revisión.
            </p>
            <div className="form-grid">
              <label>
                Servidor SMTP
                <input
                  required
                  maxLength={253}
                  placeholder="smtp.tuproveedor.com"
                  value={form.host}
                  onChange={(e) => change({ host: e.target.value })}
                />
              </label>
              <label>
                Seguridad
                <select
                  value={form.security}
                  onChange={(e) =>
                    change({
                      security: e.target.value as Settings["security"],
                      port: e.target.value === "tls" ? 465 : 587,
                    })
                  }
                >
                  <option value="starttls">STARTTLS (habitualmente 587)</option>
                  <option value="tls">TLS (habitualmente 465)</option>
                </select>
              </label>
              <label>
                Puerto
                <input
                  required
                  type="number"
                  min={1}
                  max={65535}
                  value={form.port}
                  onChange={(e) => change({ port: Number(e.target.value) })}
                />
              </label>
              <label>
                Usuario SMTP
                <input
                  required
                  maxLength={255}
                  autoComplete="off"
                  value={form.username}
                  onChange={(e) => change({ username: e.target.value })}
                />
              </label>
              <label>
                Contraseña SMTP
                <input
                  type="password"
                  autoComplete="new-password"
                  maxLength={4096}
                  required={!form.password_configured}
                  placeholder={
                    form.password_configured
                      ? "Guardada · deja vacío para conservarla"
                      : "Contraseña del proveedor SMTP"
                  }
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setDirty(true);
                    setSuccess("");
                  }}
                />
              </label>
              <label>
                Nombre del remitente
                <input
                  required
                  maxLength={100}
                  value={form.from_name}
                  onChange={(e) => change({ from_name: e.target.value })}
                />
              </label>
              <label>
                Correo del remitente
                <input
                  required
                  type="email"
                  maxLength={254}
                  placeholder="avisos@tudominio.cl"
                  value={form.from_email}
                  onChange={(e) => change({ from_email: e.target.value })}
                />
              </label>
            </div>
            <label>
              Correos de administradores que recibirán los avisos
              <textarea
                rows={3}
                placeholder="Un correo por línea. Si lo dejas vacío, se notificará a los administradores activos."
                value={recipients}
                onChange={(e) => {
                  setRecipients(e.target.value);
                  setDirty(true);
                  setSuccess("");
                }}
              />
            </label>
            <p>
              Usa un remitente autorizado por tu proveedor de correo. La
              contraseña se guarda cifrada y no vuelve a mostrarse.
            </p>
            <button className="button" disabled={busy}>
              <Save size={18} /> {busy ? "Procesando…" : "Guardar SMTP"}
            </button>
          </form>
          <section className="panel-card">
            <h2>Probar el envío</h2>
            <p>
              Envía un correo a los destinatarios guardados. También puedes
              probar con los avisos desactivados.
            </p>
            {dirty && <p>Guarda los cambios antes de enviar la prueba.</p>}
            <button
              type="button"
              className="button secondary"
              disabled={busy || dirty || !form.password_configured}
              onClick={async () => {
                setBusy(true);
                setError("");
                setSuccess("");
                try {
                  const result = (await send("/admin/mail/test", {})) as {
                    message: string;
                  };
                  setSuccess(result.message);
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Send size={18} /> Enviar correo de prueba
            </button>
            <p>
              Pendientes: {Number(form.delivery.pending)} · Fallidos:{" "}
              {Number(form.delivery.failed)}
            </p>
            {form.delivery.last_sent_at && (
              <p>
                Último aviso aceptado por SMTP:{" "}
                {new Date(form.delivery.last_sent_at).toLocaleString("es-CL")}
              </p>
            )}
            {form.last_error && (
              <p role="status">Último problema: {form.last_error}</p>
            )}
          </section>
        </>
      )}
    </>
  );
}
