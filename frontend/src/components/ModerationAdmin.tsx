"use client";
import { useCallback, useEffect, useState } from "react";
import { assetUrl, date, request, send } from "@/lib/estate-api";
import { Notice } from "./EstateApp";
type Report = {
  id: string;
  target_kind: "user" | "video" | "comment";
  target_id: string;
  status: string;
  reason: string;
  details: string;
  reporter_name: string;
  created_at: string;
  resolution_note?: string;
  action?: string;
  snapshot: { display_name?: string; title?: string; body?: string };
  restricted?: boolean;
  preview?: { url: string } | null;
  actions?: {
    id: string;
    action: string;
    note: string;
    created_at: string;
    moderator_name: string;
  }[];
};
const reasons: Record<string, string> = {
  spam: "Spam",
  scam: "Estafa o información falsa",
  harassment: "Acoso o amenazas",
  inappropriate: "Contenido inapropiado",
  privacy: "Privacidad",
  other: "Otro",
};
const statuses: Record<string, string> = {
  open: "Pendiente",
  resolved: "Resuelto",
  dismissed: "Descartado",
};
const actions: Record<string, string> = {
  hide: "Contenido oculto",
  suspend: "Cuenta suspendida",
  dismiss: "Reporte descartado",
  restore: "Restaurado",
};
export function ModerationAdmin() {
  const [status, setStatus] = useState("open"),
    [page, setPage] = useState(1),
    [pages, setPages] = useState(0),
    [total, setTotal] = useState(0),
    [items, setItems] = useState<Report[]>([]),
    [selected, setSelected] = useState<Report | null>(null),
    [note, setNote] = useState(""),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(""),
    [busy, setBusy] = useState(false),
    [revision, setRevision] = useState(0);
  const load = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const data = (await request(
        `/admin/moderation/reports?status=${status}&page=${page}`,
      )) as { items: Report[]; pages: number; total: number };
      setItems(data.items);
      setPages(data.pages);
      setTotal(data.total);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudieron cargar los reportes.",
      );
    } finally {
      setBusy(false);
    }
  }, [status, page]);
  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load, revision]);
  async function detail(id: string) {
    setBusy(true);
    setError("");
    try {
      const data = (await request("/admin/moderation/reports/" + id)) as Report;
      setSelected(data);
      setNote("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo abrir el reporte.");
    } finally {
      setBusy(false);
    }
  }
  async function act(action: string) {
    if (!selected || busy || note.trim().length < 3) return;
    if (
      action !== "dismiss" &&
      !window.confirm(
        action === "suspend"
          ? "La cuenta quedará suspendida y perderá el acceso a Proppix. ¿Continuar?"
          : action === "restore"
            ? "Se restaurará el acceso al contenido o a la cuenta. ¿Continuar?"
            : "El contenido dejará de estar disponible públicamente. ¿Continuar?",
      )
    )
      return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      if (action === "restore")
        await send(
          `/admin/moderation/restore/${selected.target_kind}/${selected.target_id}`,
          { note },
        );
      else
        await send(
          "/admin/moderation/reports/" + selected.id,
          { action, note },
          "PATCH",
        );
      setSuccess("Decisión guardada en el historial de moderación.");
      const data = (await request(
        "/admin/moderation/reports/" + selected.id,
      )) as Report;
      setSelected(data);
      setNote("");
      setRevision((n) => n + 1);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo guardar la decisión.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <span className="eyebrow">CONFIANZA Y SEGURIDAD</span>
      <h1>Moderación</h1>
      <p>
        Revisa los reportes antes de tomar una decisión. Reportar no oculta
        contenido automáticamente. La identidad del denunciante es visible solo
        para administración.
      </p>
      <Notice error={error} success={success} />
      <div
        className="panel-card"
        style={{
          display: "flex",
          gap: 16,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <label>
          Estado
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
              setSelected(null);
            }}
          >
            <option value="open">Pendientes</option>
            <option value="resolved">Resueltos</option>
            <option value="dismissed">Descartados</option>
            <option value="all">Todos</option>
          </select>
        </label>
        <span>{total} reportes</span>
        <button
          className="button secondary"
          disabled={busy}
          onClick={() => setRevision((n) => n + 1)}
        >
          Actualizar
        </button>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,320px),1fr))",
          gap: 24,
          alignItems: "start",
        }}
      >
        <section className="panel-card">
          <h2>Reportes {statuses[status]?.toLowerCase() || ""}</h2>
          {busy && <p role="status">Cargando…</p>}
          {!busy && !items.length && <p>No hay reportes en este estado.</p>}
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => void detail(item.id)}
              disabled={busy}
              style={{
                display: "block",
                width: "100%",
                padding: 16,
                textAlign: "left",
                border: "1px solid #dce5f0",
                borderRadius: 12,
                marginBottom: 12,
                backgroundColor: selected?.id === item.id ? "#edf8ff" : "#fff",
                color: "#17334c",
              }}
            >
              <strong>
                {item.target_kind === "user"
                  ? "Usuario"
                  : item.target_kind === "video"
                    ? "Video"
                    : "Comentario"}{" "}
                · {reasons[item.reason]}
              </strong>
              <p>
                {item.snapshot.title ||
                  item.snapshot.display_name ||
                  item.snapshot.body?.slice(0, 100) ||
                  "Contenido reportado"}
              </p>
              <small>
                {statuses[item.status]} · {date(item.created_at)}
              </small>
            </button>
          ))}
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <button
              disabled={busy || page <= 1}
              onClick={() => setPage((n) => n - 1)}
            >
              Anterior
            </button>
            <span>
              {page} / {Math.max(1, pages)}
            </span>
            <button
              disabled={busy || page >= pages}
              onClick={() => setPage((n) => n + 1)}
            >
              Siguiente
            </button>
          </div>
        </section>
        {selected && (
          <section className="panel-card">
            <div className="section-heading">
              <h2>Revisión del reporte</h2>
              <button
                aria-label="Cerrar reporte"
                onClick={() => setSelected(null)}
              >
                ✕
              </button>
            </div>
            <p>
              <strong>Estado:</strong> {statuses[selected.status]}
            </p>
            <p>
              <strong>Motivo:</strong> {reasons[selected.reason]}
            </p>
            <p>
              <strong>Reportado por:</strong> {selected.reporter_name}
            </p>
            <p>
              <strong>Fecha:</strong> {date(selected.created_at)}
            </p>
            {selected.details && (
              <blockquote style={{ whiteSpace: "pre-wrap" }}>
                {selected.details}
              </blockquote>
            )}
            <h3>Contenido al reportar</h3>
            <p>{selected.snapshot.title || selected.snapshot.display_name}</p>
            {selected.snapshot.body && (
              <blockquote style={{ whiteSpace: "pre-wrap" }}>
                {selected.snapshot.body}
              </blockquote>
            )}
            {selected.preview && (
              <>
                <video
                  key={selected.preview.url}
                  controls
                  preload="metadata"
                  src={assetUrl(selected.preview.url)}
                  style={{ width: "100%", maxHeight: 400, background: "#000" }}
                />
                <button
                  className="text-button"
                  onClick={() => void detail(selected.id)}
                >
                  Renovar vista previa
                </button>
              </>
            )}
            {selected.resolution_note && (
              <p>
                <strong>Resolución:</strong> {selected.resolution_note}
              </p>
            )}
            {(selected.status === "open" || selected.restricted) && (
              <>
                <label>
                  Motivo de la decisión
                  <textarea
                    value={note}
                    maxLength={2000}
                    onChange={(e) => setNote(e.target.value)}
                    rows={4}
                    placeholder="Explica la decisión. Quedará registrada con tu usuario."
                  />
                </label>
                <div
                  style={{
                    display: "flex",
                    gap: 12,
                    flexWrap: "wrap",
                    marginTop: 16,
                  }}
                >
                  {selected.status === "open" && (
                    <>
                      <button
                        className="button secondary"
                        disabled={busy || note.trim().length < 3}
                        onClick={() => void act("dismiss")}
                      >
                        Descartar reporte
                      </button>
                      <button
                        className="button"
                        disabled={busy || note.trim().length < 3}
                        onClick={() =>
                          void act(
                            selected.target_kind === "user"
                              ? "suspend"
                              : "hide",
                          )
                        }
                      >
                        {selected.target_kind === "user"
                          ? "Suspender usuario"
                          : selected.target_kind === "video"
                            ? "Ocultar video"
                            : "Ocultar comentario"}
                      </button>
                    </>
                  )}
                  {selected.restricted && (
                    <button
                      className="button secondary"
                      disabled={busy || note.trim().length < 3}
                      onClick={() => void act("restore")}
                    >
                      {selected.target_kind === "user"
                        ? "Reactivar usuario"
                        : "Restaurar contenido"}
                    </button>
                  )}
                </div>
              </>
            )}
            <h3>Historial de moderación</h3>
            {!selected.actions?.length && (
              <p>Todavía no hay decisiones sobre este contenido.</p>
            )}
            {selected.actions?.map((entry) => (
              <div
                key={entry.id}
                style={{ borderTop: "1px solid #dce5f0", padding: "12px 0" }}
              >
                <strong>{actions[entry.action] || entry.action}</strong>
                <p style={{ whiteSpace: "pre-wrap" }}>{entry.note}</p>
                <small>
                  {entry.moderator_name} · {date(entry.created_at)}
                </small>
              </div>
            ))}
          </section>
        )}
      </div>
    </>
  );
}
