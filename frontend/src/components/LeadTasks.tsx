"use client";
import { useCallback, useEffect, useState } from "react";
import { CalendarClock, Check, Clock3 } from "lucide-react";
import { request, send, date as formatDate } from "@/lib/estate-api";
import { Notice } from "./EstateApp";
import "./lead-tasks.css";
const kinds: Record<string, string> = {
  call: "Llamar",
  send_info: "Enviar información",
  coordinate_visit: "Coordinar visita",
  other: "Otra acción",
};
const actions: Record<string, string> = {
  created: "Programada",
  rescheduled: "Reprogramada",
  completed: "Realizada",
  cancelled: "Cancelada",
};
type Task = {
  id: string;
  inquiry_id: string;
  kind: string;
  note: string;
  due_at: string;
  status: string;
  revision: number;
  overdue: boolean;
  name: string;
  title: string;
  responsible_name: string;
};
type Data = {
  items: Task[];
  summary: { pending: number; overdue: number; completed: number };
  truncated: boolean;
};
function parts(value: string) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Santiago",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(value))
      .map((i) => [i.type, i.value]),
  );
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    time: `${p.hour}:${p.minute}`,
  };
}
type Draft = {
  id: string;
  kind: string;
  note: string;
  date: string;
  time: string;
  revision?: number;
};
export function LeadTasks({
  inquiryId,
  revision = 0,
  onChanged,
  onOpen,
}: {
  inquiryId?: string;
  revision?: number;
  onChanged?: () => void;
  onOpen?: (id: string) => void;
}) {
  const [data, setData] = useState<Data | null>(null),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(""),
    [status, setStatus] = useState("pending"),
    [due, setDue] = useState("all"),
    [busy, setBusy] = useState(false),
    [draft, setDraft] = useState<Draft | null>(null),
    [events, setEvents] = useState<
      | {
          id: string;
          actor_name: string;
          action: string;
          snapshot_json:
            | string
            | { due_at: string; note: string; kind: string };
          created_at: string;
        }[]
      | null
    >(null),
    [eventTask, setEventTask] = useState("");
  const path = `/me/lead-tasks?${new URLSearchParams({ status, due, ...(inquiryId ? { inquiryId } : {}) })}`;
  const load = useCallback(async () => setData(await request(path)), [path]);
  useEffect(() => {
    let live = true;
    request(path)
      .then((d) => {
        if (live) setData(d);
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [path, revision]);
  async function act(action: () => Promise<unknown>, message: string) {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await action();
      await load();
      onChanged?.();
      setSuccess(message);
    } catch (e) {
      setError((e as Error).message);
      try {
        await load();
      } catch {}
    } finally {
      setBusy(false);
    }
  }
  function edit(task?: Task) {
    setError("");
    setSuccess("");
    setDraft({
      id: task?.id || crypto.randomUUID(),
      kind: task?.kind || "call",
      note: task?.note || "",
      ...parts(task?.due_at || new Date(Date.now() + 3600000).toISOString()),
      revision: task?.revision,
    });
  }
  return (
    <section className="lead-tasks">
      <header>
        <h2>
          <CalendarClock size={23} />
          {inquiryId ? "Próximas acciones" : "Pendientes de seguimiento"}
        </h2>
        {inquiryId && (
          <button
            className="button small"
            disabled={busy}
            onClick={() => edit()}
          >
            Programar acción
          </button>
        )}
      </header>
      <Notice error={error} success={success} />
      {draft && (
        <form
          className="task-form"
          onSubmit={(e) => {
            e.preventDefault();
            const value = draft;
            void act(
              async () => {
                if (value.revision)
                  await send(
                    `/me/lead-tasks/${value.id}`,
                    { ...value, action: "reschedule" },
                    "PATCH",
                  );
                else await send(`/me/leads/${inquiryId}/tasks`, value);
                setDraft(null);
              },
              value.revision ? "Acción reprogramada." : "Acción programada.",
            );
          }}
        >
          <h3>
            {draft.revision ? "Reprogramar acción" : "Nueva próxima acción"}
          </h3>
          <div className="task-fields">
            <label>
              Acción
              <select
                value={draft.kind}
                onChange={(e) => setDraft({ ...draft, kind: e.target.value })}
              >
                {Object.entries(kinds).map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Fecha · Santiago
              <input
                type="date"
                required
                value={draft.date}
                onChange={(e) => setDraft({ ...draft, date: e.target.value })}
              />
            </label>
            <label>
              Hora · Santiago
              <input
                type="time"
                required
                value={draft.time}
                onChange={(e) => setDraft({ ...draft, time: e.target.value })}
              />
            </label>
          </div>
          <label>
            Detalle interno · opcional
            <textarea
              rows={2}
              maxLength={1000}
              value={draft.note}
              onChange={(e) => setDraft({ ...draft, note: e.target.value })}
            />
          </label>
          <p>
            Se avisará a quien atienda este interesado cuando llegue la hora.
          </p>
          <div className="task-actions">
            <button className="button" disabled={busy}>
              Guardar acción
            </button>
            <button
              type="button"
              className="button outline"
              disabled={busy}
              onClick={() => setDraft(null)}
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
      {data && (
        <>
          <div className="task-filters">
            <button
              aria-pressed={status === "pending" && due === "all"}
              onClick={() => {
                setStatus("pending");
                setDue("all");
              }}
            >
              Pendientes <strong>{data.summary.pending}</strong>
            </button>
            <button
              className="task-overdue-filter"
              aria-pressed={due === "overdue"}
              onClick={() => {
                setStatus("pending");
                setDue("overdue");
              }}
            >
              Vencidos <strong>{data.summary.overdue}</strong>
            </button>
            <label>
              Mostrar
              <select
                aria-label="Filtrar tareas"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setDue("all");
                }}
              >
                <option value="pending">Pendientes</option>
                <option value="completed">Realizadas</option>
                <option value="cancelled">Canceladas</option>
                <option value="all">Todas</option>
              </select>
            </label>
          </div>
          {data.truncated && (
            <p>Se muestran las primeras 200 tareas de este filtro.</p>
          )}
          {!data.items.length && (
            <p>
              {inquiryId
                ? "No hay acciones con este filtro."
                : "No hay acciones con este filtro. Puedes programarlas desde «Notas, acciones e historial» de una consulta."}
            </p>
          )}
          <div className="task-list">
            {data.items.map((t) => (
              <article
                key={t.id}
                className={t.overdue ? "task-item overdue" : "task-item"}
              >
                <div>
                  <h3>{kinds[t.kind]}</h3>
                  <span className={t.overdue ? "task-late" : "task-time"}>
                    <Clock3 size={15} />
                    {formatDate(t.due_at)} · Santiago
                    {t.overdue ? " · Vencida" : ""}
                  </span>
                  <p>
                    {t.name} · {t.title}
                  </p>
                  <p className="task-responsible">
                    Responsable: {t.responsible_name}
                  </p>
                  {t.note && <p className="task-note">{t.note}</p>}
                  {t.status !== "pending" && (
                    <strong>
                      {t.status === "completed" ? "Realizada" : "Cancelada"}
                    </strong>
                  )}
                </div>
                <div className="task-actions">
                  {t.status === "pending" && (
                    <>
                      <button
                        className="button small"
                        disabled={busy}
                        onClick={() =>
                          act(
                            () =>
                              send(
                                `/me/lead-tasks/${t.id}`,
                                { action: "complete", revision: t.revision },
                                "PATCH",
                              ),
                            "Acción realizada.",
                          )
                        }
                      >
                        <Check size={16} />
                        Realizada
                      </button>
                      <button
                        className="button outline small"
                        disabled={busy}
                        onClick={() => edit(t)}
                      >
                        Reprogramar
                      </button>
                      <button
                        className="button outline small"
                        disabled={busy}
                        onClick={() => {
                          if (
                            confirm(
                              "¿Cancelar esta acción? Se conservará en el historial.",
                            )
                          )
                            void act(
                              () =>
                                send(
                                  `/me/lead-tasks/${t.id}`,
                                  { action: "cancel", revision: t.revision },
                                  "PATCH",
                                ),
                              "Acción cancelada.",
                            );
                        }}
                      >
                        Cancelar
                      </button>
                    </>
                  )}
                  {!inquiryId && onOpen && (
                    <button
                      className="button outline small"
                      onClick={() => onOpen(t.inquiry_id)}
                    >
                      Ver interesado
                    </button>
                  )}
                  <button
                    className="button outline small"
                    disabled={busy}
                    onClick={() =>
                      act(async () => {
                        setEvents(
                          await request(`/me/lead-tasks/${t.id}/history`),
                        );
                        setEventTask(t.id);
                      }, "")
                    }
                  >
                    Historial
                  </button>
                </div>
                {eventTask === t.id && events && (
                  <div className="task-events">
                    <button
                      className="button outline small"
                      onClick={() => {
                        setEvents(null);
                        setEventTask("");
                      }}
                    >
                      Cerrar historial
                    </button>
                    {events.map((e) => {
                      const snapshot =
                        typeof e.snapshot_json === "string"
                          ? JSON.parse(e.snapshot_json)
                          : e.snapshot_json;
                      return (
                        <p key={e.id}>
                          <strong>{actions[e.action]}</strong> ·{" "}
                          {e.actor_name || "Integrante"} ·{" "}
                          {formatDate(e.created_at)}
                          <br />
                          {kinds[snapshot.kind]} · {formatDate(snapshot.due_at)}{" "}
                          · Santiago
                        </p>
                      );
                    })}
                  </div>
                )}
              </article>
            ))}
          </div>
        </>
      )}
      {!data && !error && <p role="status">Cargando próximas acciones…</p>}
      <p className="task-help">
        Las tareas siguen al responsable del interesado. Al cerrar la consulta
        se cancelan los pendientes. Coordinar visita no crea una reserva en la
        Agenda.
      </p>
    </section>
  );
}
