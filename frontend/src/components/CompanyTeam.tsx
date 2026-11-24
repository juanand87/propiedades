"use client";
import "./company-team.css";
import { useCallback, useEffect, useState } from "react";
import { request, send } from "@/lib/estate-api";
import { Notice } from "./EstateApp";
import { HousePreloader } from "./HousePreloader";

type Member = {
  user_id: string;
  firstName: string;
  email: string;
  role: string;
  status: string;
};
type Property = {
  id: string;
  title: string;
  revision: number;
  team_can_edit?: boolean;
  [key: string]: unknown;
};
type Assignment = { user_id: string; property_id: string; can_edit: number };
type Proposal = {
  id: string;
  title: string;
  firstName: string;
  status: string;
  changes_json: string | Record<string, unknown>;
};
type Overview = {
  eligible: boolean;
  team: { id: string; name: string } | null;
  memberships: { id: string; name: string }[];
  members?: Member[];
  properties?: Property[];
  assignments?: Assignment[];
  invitations?: { id: string; email: string }[];
  proposals?: Proposal[];
};
const fields: Record<string, string> = {
  title: "Título",
  description: "Descripción",
  price_amount: "Precio",
  price_unit: "Moneda (CLP o UF)",
  bedrooms: "Dormitorios",
  bathrooms: "Baños",
  built_area: "Superficie construida (m²)",
  land_area: "Terreno (m²)",
  parking: "Estacionamientos",
  neighborhood: "Sector",
};
const numeric = new Set([
  "price_amount",
  "bedrooms",
  "bathrooms",
  "built_area",
  "land_area",
  "parking",
]);
export function CompanyTeam() {
  const [data, setData] = useState<Overview | null>(null),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [link, setLink] = useState("");
  const [assigned, setAssigned] = useState<Property[]>([]),
    [company, setCompany] = useState(""),
    [editing, setEditing] = useState<Property | null>(null);
  const load = useCallback(
    async () => setData(await request("/me/company-team")),
    [],
  );
  useEffect(() => {
    let live = true;
    request("/me/company-team")
      .then((d) => {
        if (live) setData(d);
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, []);
  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
      await load();
      if (success) setMessage(success);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function openCompany(id: string) {
    setBusy(true);
    setError("");
    setEditing(null);
    try {
      const r = await request(`/me/company-teams/${id}/properties`);
      setAssigned(r.items);
      setCompany(id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!data)
    return (
      <>
        <Notice error={error} />
        {!error && <HousePreloader />}
      </>
    );
  const agents = (data.members || []).filter(
    (m) => m.role !== "owner" && m.status === "active",
  );
  return (
    <div className="company-team">
      <header>
        <p className="eyebrow">TRABAJA CON TU CORREDORA</p>
        <h1>Mi equipo</h1>
        <p>
          Invita agentes y asigna propiedades. Cada integrante entra con su
          propia cuenta.
        </p>
      </header>
      <Notice error={error} success={message} />
      {!data.team && (
        <section className="team-card">
          <h2>
            {data.eligible
              ? "Crea el equipo de tu empresa"
              : "Tu espacio de colaboración"}
          </h2>
          <p>
            {data.eligible
              ? "Las propiedades y su membresía siguen perteneciendo a tu empresa. Tú revisas y aplicas las propuestas de tus agentes."
              : "Acepta la invitación de una empresa para ver aquí tus propiedades asignadas. Para administrar un equipo necesitas un perfil Empresa / corredora aprobado."}
          </p>
          {data.eligible && (
            <button
              className="button"
              disabled={busy}
              onClick={() =>
                run(() => send("/me/company-team", {}), "Equipo creado.")
              }
            >
              Crear mi equipo
            </button>
          )}
        </section>
      )}
      {data.team && (
        <>
          <section className="team-card">
            <h2>{data.team.name}</h2>
            <h3>Invitar agente</h3>
            <p>
              La invitación vence en siete días y solo puede aceptarse con el
              correo indicado.
            </p>
            <form
              className="team-inline"
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const email = new FormData(form).get("email");
                setLink("");
                void run(async () => {
                  const r = await send("/me/company-team/invitations", {
                    email,
                  });
                  setLink(r.invitation_url);
                  setMessage(r.message);
                  form.reset();
                }, "");
              }}
            >
              <label>
                Correo del agente
                <input name="email" type="email" required maxLength={254} />
              </label>
              <button className="button" disabled={busy}>
                Invitar agente
              </button>
            </form>
            {link && (
              <div className="team-invite">
                <p>
                  Enlace privado de invitación. Compártelo únicamente con el
                  correo invitado.
                </p>
                <input
                  aria-label="Enlace de invitación"
                  value={link}
                  readOnly
                />
                <button
                  className="button secondary"
                  onClick={() =>
                    run(async () => {
                      await navigator.clipboard.writeText(link);
                    }, "Enlace copiado.")
                  }
                  disabled={busy}
                >
                  Copiar enlace
                </button>
              </div>
            )}
            {(data.invitations || []).map((i) => (
              <div className="team-row" key={i.id}>
                <span>{i.email} · Invitación pendiente</span>
                <button
                  disabled={busy}
                  onClick={() =>
                    run(
                      () =>
                        send(`/me/company-team/invitations/${i.id}/revoke`, {}),
                      "Invitación revocada.",
                    )
                  }
                >
                  Revocar invitación
                </button>
              </div>
            ))}
          </section>
          <section className="team-card">
            <h2>Integrantes</h2>
            {agents.length === 0 && (
              <p>
                Aún no hay agentes activos. Aparecerán cuando acepten su
                invitación.
              </p>
            )}
            {agents.map((m) => (
              <div className="team-row" key={m.user_id}>
                <span>
                  <strong>{m.firstName}</strong>
                  <br />
                  {m.email}
                </span>
                <button
                  disabled={busy}
                  onClick={() => {
                    if (
                      confirm(
                        `¿Retirar a ${m.firstName}? Perderá el acceso a todas las propiedades del equipo.`,
                      )
                    )
                      void run(
                        () =>
                          send(
                            `/me/company-team/members/${m.user_id}/revoke`,
                            {},
                          ),
                        "Acceso retirado.",
                      );
                  }}
                >
                  Retirar acceso
                </button>
              </div>
            ))}
          </section>
          <section className="team-card">
            <h2>Asignar propiedades</h2>
            <p>
              Lectura permite consultar. Proponer cambios permite enviar una
              propuesta que tú revisarás antes de aplicarla.
            </p>
            <form
              className="team-inline"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                void run(
                  () =>
                    send("/me/company-team/assignments", {
                      user_id: f.get("agent"),
                      property_id: f.get("property"),
                      can_edit: f.get("edit") === "on",
                    }),
                  "Propiedad asignada.",
                );
              }}
            >
              <label>
                Agente
                <select name="agent" required>
                  <option value="">Selecciona un agente</option>
                  {agents.map((m) => (
                    <option key={m.user_id} value={m.user_id}>
                      {m.firstName} · {m.email}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Propiedad
                <select name="property" required>
                  <option value="">Selecciona una propiedad</option>
                  {data.properties?.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="team-check">
                <input name="edit" type="checkbox" />
                Permitir proponer cambios
              </label>
              <button className="button" disabled={busy || !agents.length}>
                Asignar
              </button>
            </form>
            {data.assignments?.map((a) => (
              <div className="team-row" key={a.user_id + a.property_id}>
                <span>
                  <strong>
                    {data.properties?.find((p) => p.id === a.property_id)
                      ?.title || "Propiedad"}
                  </strong>
                  <br />
                  {agents.find((m) => m.user_id === a.user_id)?.firstName ||
                    "Agente"}{" "}
                  ·{" "}
                  {Number(a.can_edit)
                    ? "Puede proponer cambios"
                    : "Solo lectura"}
                </span>
                <button
                  disabled={busy}
                  onClick={() =>
                    run(
                      () =>
                        send("/me/company-team/assignments", {
                          ...a,
                          remove: true,
                        }),
                      "Asignación retirada.",
                    )
                  }
                >
                  Quitar asignación
                </button>
              </div>
            ))}
          </section>
          <section className="team-card">
            <h2>Propuestas de tus agentes</h2>
            <p>
              Aplicar los cambios utiliza las reglas de publicación de tu
              cuenta. Una propiedad publicada puede volver a revisión.
            </p>
            {!data.proposals?.length && <p>No hay propuestas pendientes.</p>}
            {data.proposals?.map((p) => (
              <article className="team-proposal" key={p.id}>
                <h3>{p.title}</h3>
                <p>
                  {p.firstName} ·{" "}
                  {{
                    pending: "Pendiente",
                    applied: "Aplicada",
                    rejected: "Rechazada",
                  }[p.status] || p.status}
                </p>
                <dl>
                  {Object.entries(
                    typeof p.changes_json === "string"
                      ? JSON.parse(p.changes_json)
                      : p.changes_json,
                  ).map(([key, value]) => (
                    <div key={key}>
                      <dt>{fields[key] || key}</dt>
                      <dd>{String(value ?? "Sin indicar")}</dd>
                    </div>
                  ))}
                </dl>
                {p.status === "pending" && (
                  <div className="team-inline">
                    <button
                      className="button"
                      disabled={busy}
                      onClick={() => {
                        if (confirm("¿Aplicar esta propuesta a la propiedad?"))
                          void run(
                            () =>
                              send(
                                `/me/company-team/proposals/${p.id}/review`,
                                { accept: true },
                              ),
                            "Propuesta aplicada.",
                          );
                      }}
                    >
                      Aplicar cambios
                    </button>
                    <button
                      disabled={busy}
                      onClick={() =>
                        run(
                          () =>
                            send(`/me/company-team/proposals/${p.id}/review`, {
                              accept: false,
                            }),
                          "Propuesta rechazada.",
                        )
                      }
                    >
                      Rechazar
                    </button>
                  </div>
                )}
              </article>
            ))}
          </section>
        </>
      )}
      {!!data.memberships.length && (
        <section className="team-card">
          <h2>Mis empresas</h2>
          <p>
            Tu cuenta personal permanece separada de las propiedades de cada
            empresa.
          </p>
          <div className="team-inline">
            {data.memberships.map((t) => (
              <button
                className="button secondary"
                disabled={busy}
                key={t.id}
                onClick={() => openCompany(t.id)}
              >
                {t.name}
              </button>
            ))}
          </div>
          {company && (
            <>
              <h3>Propiedades asignadas</h3>
              {!assigned.length && (
                <p>Esta empresa aún no te asignó propiedades.</p>
              )}
              {assigned.map((p) => (
                <div className="team-row" key={p.id}>
                  <strong>{p.title}</strong>
                  <button disabled={busy} onClick={() => setEditing(p)}>
                    {p.team_can_edit ? "Ver y proponer cambios" : "Ver datos"}
                  </button>
                </div>
              ))}
            </>
          )}
        </section>
      )}
      {editing && (
        <section className="team-card">
          <div className="team-row">
            <h2>{editing.title}</h2>
            <button
              onClick={() => setEditing(null)}
              aria-label="Cerrar propiedad"
            >
              ×
            </button>
          </div>
          <p>
            {editing.team_can_edit
              ? "Tu propuesta se enviará a la empresa para revisión."
              : "Tienes acceso de solo lectura."}
          </p>
          <form
            key={editing.id}
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const changes: Record<string, unknown> = {};
              for (const key of Object.keys(fields)) {
                const raw = String(f.get(key) ?? "");
                const next = numeric.has(key)
                  ? raw === ""
                    ? null
                    : Number(raw)
                  : raw;
                const old = editing[key] ?? (numeric.has(key) ? null : "");
                if (String(next ?? "") !== String(old ?? ""))
                  changes[key] = next;
              }
              void run(async () => {
                await send(
                  `/me/company-teams/${company}/properties/${editing.id}/proposals`,
                  { revision: editing.revision, changes },
                );
                setEditing(null);
              }, "Propuesta enviada a la empresa.");
            }}
          >
            <div className="team-fields">
              {Object.entries(fields).map(([key, label]) => (
                <label key={key}>
                  {label}
                  {key === "description" ? (
                    <textarea
                      name={key}
                      defaultValue={String(editing[key] ?? "")}
                      disabled={!editing.team_can_edit}
                      rows={5}
                    />
                  ) : (
                    <input
                      name={key}
                      type={numeric.has(key) ? "number" : "text"}
                      min={numeric.has(key) ? 0 : undefined}
                      step={numeric.has(key) ? "any" : undefined}
                      defaultValue={String(editing[key] ?? "")}
                      disabled={!editing.team_can_edit}
                      required={key === "title" || key === "price_unit"}
                    />
                  )}
                </label>
              ))}
            </div>
            {editing.team_can_edit && (
              <button className="button" disabled={busy}>
                Enviar propuesta
              </button>
            )}
          </form>
        </section>
      )}
      {busy && <p role="status">Procesando…</p>}
    </div>
  );
}
