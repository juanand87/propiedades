"use client";
import { useCallback, useEffect, useState } from "react";
import { Search, Users, Clock3, X, Send, RefreshCw } from "lucide-react";
import { date, request, send } from "@/lib/estate-api";
import { Empty, Notice } from "./EstateApp";
import { HousePreloader } from "./HousePreloader";
import "./leads-workspace.css";
const stages: Record<string, string> = {
  new: "Nuevo",
  contacted: "Contactado",
  visit_scheduled: "Visita agendada",
  negotiation: "En negociación",
  closed: "Cerrado",
};
type Lead = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  message: string;
  created_at: string;
  title: string;
  code: string;
  company_name: string;
  stage: string;
  revision: number;
  can_manage: number;
  team_id: string | null;
  assignee_id: string | null;
  assignee_name: string | null;
};
type Data = {
  items: Lead[];
  agents: { team_id: string; user_id: string; name: string }[];
  truncated: boolean;
};
type History = {
  notes: {
    id: string;
    message: string;
    created_at: string;
    author_name: string;
  }[];
  events: {
    id: string;
    action: string;
    previous_value: string | null;
    next_value: string | null;
    actor_name: string;
    previous_name: string | null;
    next_name: string | null;
    created_at: string;
  }[];
};
export function LeadsWorkspace() {
  const [data, setData] = useState<Data | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [search, setSearch] = useState(""),
    [stage, setStage] = useState(""),
    [assignee, setAssignee] = useState("");
  const [selected, setSelected] = useState<Lead | null>(null),
    [history, setHistory] = useState<History | null>(null),
    [note, setNote] = useState("");
  const load = useCallback(async () => setData(await request("/me/leads")), []);
  useEffect(() => {
    let live = true;
    request("/me/leads")
      .then((r) => {
        if (live) setData(r);
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    if (!selected) return;
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) setSelected(null);
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [selected, busy]);
  async function act(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
      await load();
      setNotice(success);
    } catch (e) {
      setError((e as Error).message);
      try {
        await load();
      } catch {}
    } finally {
      setBusy(false);
    }
  }
  async function open(lead: Lead) {
    setSelected(lead);
    setHistory(null);
    setNote("");
    setError("");
    try {
      setHistory(await request(`/me/leads/${lead.id}/history`));
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const visible = (data?.items || []).filter(
    (i) =>
      (!stage || i.stage === stage) &&
      (!assignee ||
        (assignee === "unassigned"
          ? !i.assignee_id
          : i.assignee_id === assignee)) &&
      `${i.name} ${i.email} ${i.title} ${i.code} ${i.company_name}`
        .toLocaleLowerCase("es")
        .includes(search.toLocaleLowerCase("es")),
  );
  const people = Array.from(
    new Map(
      (data?.items || [])
        .filter((i) => i.assignee_id)
        .map((i) => [i.assignee_id!, i.assignee_name!]),
    ).entries(),
  );
  return (
    <div className="leads-workspace">
      <header className="leads-heading">
        <div>
          <span className="eyebrow">CADA CONSULTA TIENE UN PRÓXIMO PASO</span>
          <h1>Interesados</h1>
          <p>
            Organiza las consultas y el seguimiento de tus propiedades y de las
            que te asignó una empresa.
          </p>
        </div>
        <button
          className="button outline"
          disabled={busy}
          onClick={() => act(load, "Listado actualizado.")}
        >
          <RefreshCw size={17} />
          Actualizar
        </button>
      </header>
      <Notice error={error} success={notice} />
      {!data && !error && <HousePreloader />}
      {data && (
        <>
          <div className="lead-summary">
            {Object.entries(stages).map(([key, label]) => (
              <button
                key={key}
                className={stage === key ? "selected" : ""}
                aria-pressed={stage === key}
                onClick={() => setStage(stage === key ? "" : key)}
              >
                <strong>
                  {data.items.filter((i) => i.stage === key).length}
                </strong>
                <span>{label}</span>
              </button>
            ))}
          </div>
          <div className="lead-filters">
            <label>
              <span>
                <Search size={16} />
                Buscar interesado o propiedad
              </span>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Nombre, correo, propiedad o código"
              />
            </label>
            <label>
              Estado
              <select value={stage} onChange={(e) => setStage(e.target.value)}>
                <option value="">Todos los estados</option>
                {Object.entries(stages).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Responsable
              <select
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
              >
                <option value="">Todos</option>
                <option value="unassigned">Sin asignar</option>
                {people.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {data.truncated && (
            <p role="status">
              Se muestran las 200 consultas más recientes. Los indicadores y
              filtros corresponden a este listado.
            </p>
          )}
          <p>
            {visible.length}{" "}
            {visible.length === 1 ? "interesado" : "interesados"}
          </p>
          {visible.length ? (
            <div className="lead-list">
              {visible.map((i) => (
                <article className="lead-card" key={i.id}>
                  <header>
                    <div>
                      <span className="eyebrow">
                        {i.code} · {i.company_name}
                      </span>
                      <h2>{i.title}</h2>
                    </div>
                    <span className={`lead-stage lead-stage-${i.stage}`}>
                      {stages[i.stage] || i.stage}
                    </span>
                  </header>
                  <h3>{i.name}</h3>
                  <div className="lead-contact">
                    <a href={`mailto:${i.email}`}>{i.email}</a>
                    {i.phone && <a href={`tel:${i.phone}`}>{i.phone}</a>}
                  </div>
                  <p className="lead-message">{i.message}</p>
                  <small>
                    <Clock3 size={14} />
                    {date(i.created_at)}
                  </small>
                  <div className="lead-controls">
                    <label>
                      Estado del interesado
                      <select
                        aria-label={`Estado de ${i.name}`}
                        disabled={busy}
                        value={i.stage}
                        onChange={(e) =>
                          act(
                            () =>
                              send(
                                `/me/leads/${i.id}`,
                                {
                                  stage: e.target.value,
                                  revision: Number(i.revision),
                                },
                                "PATCH",
                              ),
                            "Estado actualizado.",
                          )
                        }
                      >
                        {Object.entries(stages).map(([key, label]) => (
                          <option key={key} value={key}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                    {!!Number(i.can_manage) && i.team_id ? (
                      <label>
                        Agente responsable
                        <select
                          aria-label={`Responsable de ${i.name}`}
                          disabled={busy}
                          value={i.assignee_id || ""}
                          onChange={(e) =>
                            act(
                              () =>
                                send(`/me/leads/${i.id}/assignment`, {
                                  user_id: e.target.value || null,
                                }),
                              "Responsable actualizado.",
                            )
                          }
                        >
                          <option value="">
                            Sin asignar · atiende la empresa
                          </option>
                          {data.agents
                            .filter((a) => a.team_id === i.team_id)
                            .map((a) => (
                              <option key={a.user_id} value={a.user_id}>
                                {a.name}
                              </option>
                            ))}
                        </select>
                      </label>
                    ) : (
                      <p className="lead-assignee">
                        <Users size={16} />
                        {i.assignee_name || "Atención directa del anunciante"}
                      </p>
                    )}
                    <button className="button outline" onClick={() => open(i)}>
                      Notas e historial
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <Empty
              title={
                data.items.length
                  ? "No hay interesados con estos filtros"
                  : "Aún no hay consultas"
              }
            >
              {data.items.length
                ? "Prueba con otro estado, responsable o búsqueda."
                : "Las consultas de tus propiedades y los interesados que te asigne una empresa aparecerán aquí."}
            </Empty>
          )}
          <p className="lead-help">
            «Visita agendada» registra el avance comercial. Coordina y confirma
            la cita desde la Agenda. Las notas son internas y no se envían al
            interesado.
          </p>
        </>
      )}
      {selected && (
        <div
          className="modal-overlay"
          onClick={() => {
            if (!busy) setSelected(null);
          }}
        >
          <section
            className="modal-card lead-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Notas e historial"
            onClick={(e) => e.stopPropagation()}
          >
            <header>
              <div>
                <h2>Notas e historial</h2>
                <p>
                  {selected.name} · {selected.title}
                </p>
              </div>
              <button
                aria-label="Cerrar historial"
                disabled={busy}
                onClick={() => setSelected(null)}
              >
                <X />
              </button>
            </header>
            <Notice error={error} />
            {!history ? (
              <p role="status">Cargando seguimiento…</p>
            ) : (
              <>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void act(async () => {
                      await send(`/me/leads/${selected.id}/notes`, {
                        message: note,
                      });
                      setNote("");
                      setHistory(
                        await request(`/me/leads/${selected.id}/history`),
                      );
                    }, "Nota guardada.");
                  }}
                >
                  <label>
                    Nueva nota interna
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      required
                      maxLength={5000}
                      rows={3}
                    />
                  </label>
                  <button className="button" disabled={busy || !note.trim()}>
                    <Send size={17} />
                    Guardar nota
                  </button>
                </form>
                <div className="lead-history">
                  {history.notes.map((n) => (
                    <article key={n.id}>
                      <strong>{n.author_name || "Integrante"}</strong>
                      <p>{n.message}</p>
                      <small>{date(n.created_at)}</small>
                    </article>
                  ))}
                  {history.events.map((e) => (
                    <article key={e.id}>
                      <strong>{e.actor_name || "Integrante"}</strong>
                      <p>
                        {e.action === "stage"
                          ? `Estado: ${stages[e.previous_value || ""] || e.previous_value} → ${stages[e.next_value || ""] || e.next_value}`
                          : `Responsable: ${e.previous_name || "Sin asignar"} → ${e.next_name || "Sin asignar"}`}
                      </p>
                      <small>{date(e.created_at)}</small>
                    </article>
                  ))}
                  {!history.notes.length && !history.events.length && (
                    <p>No hay notas ni cambios registrados todavía.</p>
                  )}
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
