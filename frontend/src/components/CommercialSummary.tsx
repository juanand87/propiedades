"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BarChart3, RefreshCw, ArrowUpRight } from "lucide-react";
import { request, date } from "@/lib/estate-api";
import { Notice } from "./EstateApp";
import "./commercial-summary.css";
type Kind =
  | "new_leads"
  | "unassigned"
  | "open_leads"
  | "negotiation"
  | "pending_tasks"
  | "overdue"
  | "visits";
type Metrics = {
  new_leads: number;
  unassigned: number;
  open_leads: number;
  negotiation: number;
  pending_tasks: number;
  overdue: number;
  visits: number;
};
type Agent = Pick<
  Metrics,
  "open_leads" | "new_leads" | "negotiation" | "pending_tasks" | "overdue"
> & { id?: string; name?: string };
type Data = {
  eligible: boolean;
  company_name: string;
  updated_at: string;
  metrics: Metrics;
  agents: Agent[];
  direct: Agent;
  agents_truncated: boolean;
};
type Item = {
  id: string;
  inquiry_id: string | null;
  booking_id?: string | null;
  title: string;
  name: string;
  stage?: string;
  task_kind?: string;
  note?: string;
  scheduled_at?: string;
  responsible_name?: string;
};
type Cases = { kind: Kind; items: Item[]; page: number; has_more: boolean };
const labels: Record<Kind, string> = {
  new_leads: "Interesados nuevos",
  unassigned: "Interesados sin asignar",
  open_leads: "Interesados abiertos",
  negotiation: "Negociaciones abiertas",
  pending_tasks: "Tareas pendientes",
  overdue: "Tareas vencidas",
  visits: "Visitas confirmadas",
};
const stages: Record<string, string> = {
  new: "Nuevo",
  contacted: "Contactado",
  visit_scheduled: "Visita agendada",
  negotiation: "En negociación",
  closed: "Cerrado",
};
const tasks: Record<string, string> = {
  call: "Llamar",
  send_info: "Enviar información",
  coordinate_visit: "Coordinar visita",
  other: "Otra acción",
};
export function CommercialSummary({ root }: { root: string }) {
  const [data, setData] = useState<Data | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [selection, setSelection] = useState<{
      kind: Kind;
      agentId?: string;
      name?: string;
    } | null>(null),
    [cases, setCases] = useState<Cases | null>(null),
    [caseError, setCaseError] = useState(""),
    [caseBusy, setCaseBusy] = useState(false),
    [page, setPage] = useState(1);
  const generation = useRef(0),
    details = useRef<HTMLDivElement>(null);
  const refresh = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      setData(await request("/me/commercial-summary"));
    } catch {
      setError("No pudimos cargar el resumen comercial. Intenta actualizarlo.");
    } finally {
      setBusy(false);
    }
  }, []);
  useEffect(() => {
    let live = true;
    request("/me/commercial-summary")
      .then((r) => {
        if (live) setData(r);
      })
      .catch(() => {
        if (live)
          setError(
            "No pudimos cargar el resumen comercial. Intenta actualizarlo.",
          );
      });
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    if (!selection) return;
    const run = ++generation.current;
    const controller = new AbortController();
    const query = new URLSearchParams({
      kind: selection.kind,
      page: String(page),
      ...(selection.agentId ? { agentId: selection.agentId } : {}),
    });
    request(`/me/commercial-summary/cases?${query}`, {
      signal: controller.signal,
    })
      .then((r) => {
        if (run === generation.current) {
          setCases(r);
          setCaseError("");
          details.current?.scrollIntoView({
            behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
              .matches
              ? "instant"
              : "smooth",
            block: "start",
          });
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted && run === generation.current)
          setCaseError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted && run === generation.current)
          setCaseBusy(false);
      });
    return () => controller.abort();
  }, [selection, page]);
  function open(kind: Kind, agentId?: string, name?: string) {
    setPage(1);
    setCases(null);
    setCaseError("");
    setCaseBusy(true);
    setSelection({ kind, agentId, name });
  }
  if (data && !data.eligible) return null;
  return (
    <section className="commercial-summary" aria-label="Resumen comercial">
      <header>
        <div>
          <span className="eyebrow">TU EMPRESA, EN UN VISTAZO</span>
          <h2>
            <BarChart3 size={25} />
            Resumen comercial
          </h2>
          {data && (
            <p>
              {data.company_name} · Actualizado {date(data.updated_at)}
            </p>
          )}
        </div>
        <button
          className="button outline small"
          disabled={busy}
          onClick={() => {
            void refresh();
            if (selection)
              open(selection.kind, selection.agentId, selection.name);
          }}
        >
          <RefreshCw size={16} />
          Actualizar resumen
        </button>
      </header>
      <Notice error={error} />
      {!data && !error && (
        <p role="status">Cargando indicadores comerciales…</p>
      )}
      {data?.eligible && (
        <>
          <div className="commercial-cards">
            {(
              [
                "new_leads",
                "unassigned",
                "overdue",
                "visits",
                "negotiation",
                "pending_tasks",
              ] as Kind[]
            ).map((k) => (
              <button
                key={k}
                className={
                  k === "overdue"
                    ? "commercial-metric attention"
                    : "commercial-metric"
                }
                onClick={() => open(k)}
              >
                <strong>{data.metrics[k]}</strong>
                <span>{labels[k]}</span>
                <small>
                  Ver casos <ArrowUpRight size={14} />
                </small>
              </button>
            ))}
          </div>
          <p className="commercial-help">
            Estado actual de toda la empresa. «Sin asignar» cuenta interesados
            abiertos sin un agente activo; «Visitas confirmadas» incluye las
            próximas citas confirmadas y conserva las anteriores que aún están
            vigentes.
          </p>
          <div className="commercial-team-heading">
            <h3>Seguimiento por responsable</h3>
            <Link href={`${root}/equipo`}>
              Administrar mi equipo <ArrowUpRight size={15} />
            </Link>
          </div>
          <div className="commercial-table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Responsable</th>
                  <th scope="col">Interesados abiertos</th>
                  <th scope="col">Nuevos</th>
                  <th scope="col">En negociación</th>
                  <th scope="col">Tareas pendientes</th>
                  <th scope="col">Vencidas</th>
                </tr>
              </thead>
              <tbody>
                {[
                  {
                    ...data.direct,
                    id: "unassigned",
                    name: "Atención de la empresa",
                  },
                  ...data.agents,
                ].map((a) => (
                  <tr key={a.id}>
                    <th scope="row">{a.name}</th>
                    {(
                      [
                        "open_leads",
                        "new_leads",
                        "negotiation",
                        "pending_tasks",
                        "overdue",
                      ] as const
                    ).map((k) => (
                      <td key={k}>
                        <button
                          aria-label={`${labels[k]} de ${a.name}: ${a[k]}`}
                          onClick={() => open(k, a.id, a.name)}
                        >
                          {a[k]}
                        </button>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!data.agents.length && (
            <p>
              Los agentes activos aparecerán cuando acepten su invitación en Mi
              equipo.
            </p>
          )}
          {data.agents_truncated && (
            <p>
              Se muestran los primeros 1.000 agentes; los indicadores generales
              incluyen a toda la empresa.
            </p>
          )}
          {selection && (
            <div ref={details} className="commercial-cases" aria-live="polite">
              <header>
                <h3>
                  {labels[selection.kind]}
                  {selection.name ? ` · ${selection.name}` : ""}
                </h3>
                <button
                  className="button outline small"
                  onClick={() => {
                    generation.current++;
                    setSelection(null);
                    setCases(null);
                  }}
                >
                  Cerrar listado ×
                </button>
              </header>
              <Notice error={caseError} />
              {caseBusy && <p role="status">Cargando casos…</p>}
              {!caseBusy && cases && !cases.items.length && (
                <p>No hay casos en este listado.</p>
              )}
              {cases?.items.map((i) => (
                <article className="commercial-case" key={i.id}>
                  <div>
                    <h4>
                      {i.task_kind ? `${tasks[i.task_kind]} · ` : ""}
                      {i.title}
                    </h4>
                    <p>
                      {i.name || "Visitante"}
                      {i.stage ? ` · ${stages[i.stage] || i.stage}` : ""}
                    </p>
                    {i.responsible_name && (
                      <small>Responsable: {i.responsible_name}</small>
                    )}
                    {i.scheduled_at && <p>{date(i.scheduled_at)} · Santiago</p>}
                    {i.note && <p className="preserve-lines">{i.note}</p>}
                  </div>
                  {selection.kind === "visits" && i.booking_id ? (
                    <Link
                      className="button outline small"
                      href={`${root}/visitas?visitId=${encodeURIComponent(i.booking_id)}`}
                    >
                      Abrir visita
                    </Link>
                  ) : i.inquiry_id ? (
                    <Link
                      className="button outline small"
                      href={`${root}/contactos?inquiryId=${encodeURIComponent(i.inquiry_id)}`}
                    >
                      {i.task_kind
                        ? "Ver tareas e interesado"
                        : "Ver interesado"}
                    </Link>
                  ) : (
                    <Link
                      className="button outline small"
                      href={`${root}/visitas`}
                    >
                      Abrir agenda
                    </Link>
                  )}
                </article>
              ))}
              {cases && (
                <div className="commercial-pagination">
                  <button
                    className="button outline small"
                    disabled={page === 1 || caseBusy}
                    onClick={() => {
                      setCaseBusy(true);
                      setCases(null);
                      setPage((p) => p - 1);
                    }}
                  >
                    Anterior
                  </button>
                  <span>Página {page}</span>
                  <button
                    className="button outline small"
                    disabled={!cases.has_more || caseBusy}
                    onClick={() => {
                      setCaseBusy(true);
                      setCases(null);
                      setPage((p) => p + 1);
                    }}
                  >
                    Siguiente
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
