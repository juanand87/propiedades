"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { date, request, send } from "@/lib/estate-api";
import { Notice, useEstate } from "./EstateApp";
type Visit = {
  id: string;
  property_title: string;
  buyer_name: string;
  seller_name: string;
  state: string;
  version: number;
  starts_at: string;
  note: string;
  property_available: boolean;
  allowed_actions: string[];
  events?: {
    id: string;
    state: string;
    actor_name: string;
    starts_at: string;
    note: string;
  }[];
};
const labels: Record<string, string> = {
  requested: "Por confirmar",
  proposed: "Nuevo horario propuesto",
  confirmed: "Confirmada",
  cancelled: "Cancelada",
  rejected: "Rechazada",
  completed: "Realizada",
  accept: "Confirmar horario",
  propose: "Proponer otro horario",
  reject: "Rechazar",
  cancel: "Cancelar visita",
  complete: "Marcar como realizada",
};
function slot(value: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const get = (type: string) => parts.find((p) => p.type === type)?.value;
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}`,
  };
}
export function VisitsAgenda() {
  const { user } = useEstate();
  const isAdmin = user?.role === "admin";
  const [items, setItems] = useState<Visit[]>([]),
    [selected, setSelected] = useState<Visit | null>(null),
    [page, setPage] = useState(1),
    [more, setMore] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(false),
    [proposing, setProposing] = useState(false),
    [note, setNote] = useState("");
  const [time, setTime] = useState({ date: "", time: "" });
  const mutation = useRef(false);
  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      try {
        const data = (await request(
          `/${isAdmin ? "admin" : "me"}/visits?page=${page}`,
          { signal },
        )) as { items: Visit[]; has_more: boolean };
        if (!signal?.aborted) {
          setItems(data.items);
          setMore(data.has_more);
          setError("");
        }
      } catch (e) {
        if (!signal?.aborted)
          setError(
            e instanceof Error ? e.message : "No se pudo cargar la agenda.",
          );
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [isAdmin, page],
  );
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => void load(controller.signal), 0);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [load]);
  async function open(id: string) {
    setBusy(true);
    setError("");
    try {
      setSelected(await request(`/me/visits/${id}`));
      setProposing(false);
      setNote("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function act(action: string) {
    if (!selected || mutation.current) return;
    if (
      action !== "propose" &&
      !window.confirm(
        `${labels[action]}: ${date(selected.starts_at)} (Santiago). Se avisará a la otra persona. ¿Continuar?`,
      )
    )
      return;
    mutation.current = true;
    setBusy(true);
    setError("");
    try {
      const data = (await send(
        `/me/visits/${selected.id}`,
        {
          action,
          version: selected.version,
          note,
          ...(action === "propose" ? time : {}),
        },
        "PATCH",
      )) as Visit;
      setSelected(data);
      setProposing(false);
      setNote("");
      await load();
    } catch (e) {
      const message = (e as Error).message;
      try {
        setSelected(await request(`/me/visits/${selected.id}`));
      } catch {}
      setError(message);
    } finally {
      mutation.current = false;
      setBusy(false);
    }
  }
  return (
    <section aria-label="Agenda de visitas">
      <span className="eyebrow">ENCUENTROS QUE ABREN PUERTAS</span>
      <h1>Agenda de visitas</h1>
      <p>
        Horarios de Chile · Santiago. Duración: 30 minutos. La solicitud
        requiere confirmación de la otra persona.
      </p>
      <Notice error={error} />
      <div className="row-actions">
        <button
          className="button outline small"
          disabled={busy || loading}
          onClick={() => void load()}
        >
          Actualizar
        </button>
        {selected && (
          <button
            className="button outline small"
            onClick={() => {
              setSelected(null);
              setProposing(false);
            }}
          >
            Volver al listado
          </button>
        )}
      </div>
      {loading && <p role="status">Cargando agenda…</p>}
      {selected ? (
        <article className="panel-card">
          <div className="section-heading">
            <h2>{selected.property_title}</h2>
            <span className="status-tag">{labels[selected.state]}</span>
          </div>
          <h3>{date(selected.starts_at)} · Santiago</h3>
          <p>
            Visitante: {selected.buyer_name} · Vendedor: {selected.seller_name}
          </p>
          {!!selected.note && <p className="preserve-lines">{selected.note}</p>}
          {!selected.property_available && (
            <p>
              Esta propiedad ya no está disponible. Puedes cancelar la visita.
            </p>
          )}
          {!proposing && (
            <div className="row-actions">
              {selected.allowed_actions.map((action) => (
                <button
                  key={action}
                  className={`button ${action === "accept" ? "" : "outline"} small`}
                  disabled={busy}
                  onClick={() => {
                    if (action === "propose") {
                      setTime(slot(selected.starts_at));
                      setProposing(true);
                    } else void act(action);
                  }}
                >
                  {labels[action]}
                </button>
              ))}
            </div>
          )}
          {proposing && (
            <form
              className="form-grid"
              onSubmit={(e) => {
                e.preventDefault();
                void act("propose");
              }}
            >
              <label>
                Fecha (Santiago)
                <input
                  required
                  type="date"
                  value={time.date}
                  onChange={(e) =>
                    setTime((t) => ({ ...t, date: e.target.value }))
                  }
                />
              </label>
              <label>
                Hora (Santiago)
                <input
                  required
                  type="time"
                  value={time.time}
                  onChange={(e) =>
                    setTime((t) => ({ ...t, time: e.target.value }))
                  }
                />
              </label>
              <label>
                Nota opcional
                <textarea
                  maxLength={1000}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </label>
              <div className="row-actions">
                <button className="button" disabled={busy}>
                  Enviar propuesta
                </button>
                <button
                  className="button outline"
                  type="button"
                  disabled={busy}
                  onClick={() => setProposing(false)}
                >
                  Volver
                </button>
              </div>
            </form>
          )}
          <h3>Historial</h3>
          {selected.events?.map((event) => (
            <div className="message" key={event.id}>
              <strong>
                {labels[event.state]} · {event.actor_name}
              </strong>
              <p>{date(event.starts_at)} · Santiago</p>
              {!!event.note && <p className="preserve-lines">{event.note}</p>}
            </div>
          ))}
        </article>
      ) : (
        <>
          <div className="contact-list">
            {items.map((visit) => (
              <article className="panel-card" key={visit.id}>
                <div className="section-heading">
                  <h2>{visit.property_title}</h2>
                  <span className="status-tag">{labels[visit.state]}</span>
                </div>
                <p>{date(visit.starts_at)} · Santiago</p>
                <p>
                  {visit.buyer_name} · {visit.seller_name}
                </p>
                <button
                  className="button outline small"
                  disabled={busy}
                  onClick={() => void open(visit.id)}
                >
                  Ver y gestionar visita
                </button>
              </article>
            ))}
          </div>
          {!loading && !items.length && (
            <p>Aún no hay visitas agendadas desde la app.</p>
          )}
          <div className="row-actions">
            {page > 1 && (
              <button
                className="button outline small"
                onClick={() => setPage((p) => p - 1)}
              >
                Anterior
              </button>
            )}
            {more && (
              <button
                className="button outline small"
                onClick={() => setPage((p) => p + 1)}
              >
                Siguiente
              </button>
            )}
          </div>
        </>
      )}
      <p>
        <Link href={isAdmin ? "/panel/propiedades" : "/dashboard/propiedades"}>
          Ver propiedades
        </Link>
      </p>
    </section>
  );
}
