"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  Check,
  Clock3,
  Eye,
  Heart,
  House,
  ImageIcon,
  MapPin,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Share2,
  Video,
  AlertCircle,
  FileText,
  Pause,
} from "lucide-react";
import { assetUrl, date, labels, price, request, send } from "@/lib/estate-api";
import { ManagedProperty, propertyMissingFields } from "@/lib/managed-property";
import { useEstate } from "./EstateApp";
import styles from "./ManagedProperties.module.css";

type Summary = {
  total: number;
  published: number;
  pending: number;
  drafts: number;
  rejected: number;
  paused: number;
  archived: number;
  views: number;
  likes: number;
  inquiries: number;
  new_inquiries: number;
};
type Page = {
  items: ManagedProperty[];
  page: number;
  pages: number;
  total: number;
};
const count = (n: number | string | undefined) =>
  n == null ? "—" : new Intl.NumberFormat("es-CL").format(Number(n));
const statuses = [
  ["", "Todas", "total"],
  ["published", "Publicadas", "published"],
  ["draft", "Borradores", "drafts"],
  ["pending_review", "En revisión", "pending"],
  ["rejected", "Por corregir", "rejected"],
  ["paused", "Pausadas", "paused"],
  ["archived", "Archivadas", "archived"],
] as const;

function Cover({ property }: { property: ManagedProperty }) {
  const [failed, setFailed] = useState(false);
  const image = property.media[0]?.url;
  return (
    <div className={styles.cover}>
      {image && !failed ? (
        <img
          src={assetUrl(image)}
          alt={property.title || "Fotografía de la propiedad"}
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className={styles.placeholder}>
          <House size={34} />
          <span>
            {image ? "Vista previa no disponible" : "Agrega una fotografía"}
          </span>
        </div>
      )}
      <span className={styles.mediaCount}>
        <ImageIcon size={14} />
        {property.media.length} fotos
        {property.insights?.video_count != null && (
          <>
            <Video size={14} />
            {property.insights.video_count}
          </>
        )}
      </span>
    </div>
  );
}
function Rejection({
  property,
  busy,
  error,
  onClose,
  onSubmit,
}: {
  property: ManagedProperty;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (reason: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = dialog.current;
    el?.showModal();
    return () => el?.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      className={styles.dialog}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      aria-labelledby="review-title"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(String(new FormData(e.currentTarget).get("reason") || ""));
        }}
      >
        <h2 id="review-title">Solicitar correcciones</h2>
        <p>{property.title}</p>
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        <label>
          Indica qué debe corregir el anunciante
          <textarea name="reason" required maxLength={1000} autoFocus />
        </label>
        <div className={styles.actions}>
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className={styles.secondary}
          >
            Cancelar
          </button>
          <button disabled={busy} className={styles.primary}>
            {busy ? "Guardando…" : "Guardar revisión"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
export function ManagedProperties({ root }: { root: string }) {
  const { user } = useEstate();
  const admin = user.role === "admin";
  const [status, setStatus] = useState(""),
    [search, setSearch] = useState(""),
    [query, setQuery] = useState(""),
    [page, setPage] = useState(1);
  const [data, setData] = useState<Page | null>(null),
    [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [revision, refresh] = useState(0),
    [busyId, setBusyId] = useState<string | null>(null),
    [target, setTarget] = useState<ManagedProperty | null>(null);
  const actionLock = useRef(false);
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError("");
      try {
        const [list, stats] = await Promise.all([
          request(
            `/manage/properties?insights=1&page=${page}&status=${status}&search=${encodeURIComponent(query)}`,
            { signal: controller.signal },
          ) as Promise<Page>,
          request("/manage/stats", {
            signal: controller.signal,
          }) as Promise<Summary>,
        ]);
        if (!controller.signal.aborted) {
          if (page > Math.max(1, list.pages)) {
            setPage(Math.max(1, list.pages));
            return;
          }
          setData(list);
          setSummary(stats);
        }
      } catch (e) {
        if (!controller.signal.aborted) {
          setData(null);
          setError(
            e instanceof Error
              ? e.message
              : "No se pudieron cargar tus propiedades.",
          );
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [page, status, query, revision]);
  async function action(
    p: ManagedProperty,
    body: Record<string, unknown>,
    endpoint = "status",
  ) {
    if (actionLock.current || loading) return;
    actionLock.current = true;
    setBusyId(p.id);
    setError("");
    setNotice("");
    try {
      await send(
        `/manage/properties/${p.id}/${endpoint}`,
        { ...body, ...(endpoint === "status" ? { revision: p.revision } : {}) },
        "PATCH",
      );
      setTarget(null);
      setNotice("Los cambios de la propiedad se guardaron.");
      refresh((n) => n + 1);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo guardar el cambio.",
      );
    } finally {
      actionLock.current = false;
      setBusyId(null);
    }
  }
  async function share(p: ManagedProperty) {
    const url = new URL(`/propiedades/${p.slug}`, window.location.origin).href;
    try {
      if (navigator.share) await navigator.share({ title: p.title, url });
      else {
        await navigator.clipboard.writeText(url);
        setNotice("Enlace de la propiedad copiado.");
      }
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError"))
        setError(
          "No se pudo compartir el enlace. Puedes copiarlo desde Ver ficha.",
        );
    }
  }
  function filter(value: string) {
    setStatus(value);
    setPage(1);
  }
  const pending = Number(summary?.drafts || 0) + Number(summary?.rejected || 0);
  return (
    <section className={styles.root} aria-labelledby="managed-title">
      <header className={styles.heading}>
        <div>
          <span className={styles.eyebrow}>TU ESPACIO EN PROPPIX</span>
          <h1 id="managed-title">
            {admin ? "Propiedades" : "Mis propiedades"}
          </h1>
          <p>
            Tu catálogo, sus resultados y el próximo paso de cada publicación.
          </p>
        </div>
        <Link className={styles.primary} href={`${root}/propiedades/nueva`}>
          <Plus size={19} />
          Nueva propiedad
        </Link>
      </header>
      <div className={styles.summary} aria-label="Resumen de todo el catálogo">
        {[
          ["Propiedades", summary?.total, House],
          ["Publicadas", summary?.published, Check],
          ["Vistas de fichas", summary?.views, Eye],
          ["Guardados", summary?.likes, Heart],
          ["Consultas", summary?.inquiries, MessageSquare],
        ].map(([label, value, Icon]) => {
          const Symbol = Icon as typeof House;
          return (
            <div key={String(label)} className={styles.stat}>
              <Symbol size={20} />
              <strong>{count(value as number | undefined)}</strong>
              <span>{String(label)}</span>
            </div>
          );
        })}
      </div>
      <p className={styles.scope}>
        Totales acumulados de todo el catálogo. Los filtros se aplican al
        listado de abajo.
      </p>
      <div className={styles.pending} aria-label="Pendientes de tu catálogo">
        <div className={styles.pendingIntro}>
          <span className={styles.pendingIcon}>
            <Clock3 size={21} />
          </span>
          <div>
            <h2>Tus próximos pasos</h2>
            <p>
              {summary
                ? pending || Number(summary.new_inquiries)
                  ? "Retoma lo pendiente y mantén tus publicaciones al día."
                  : "No tienes borradores, correcciones ni consultas nuevas pendientes."
                : "Consultando pendientes…"}
            </p>
          </div>
        </div>
        <div className={styles.pendingLinks}>
          {Number(summary?.drafts) > 0 && (
            <button onClick={() => filter("draft")}>
              <FileText size={17} />
              {count(summary!.drafts)} borrador
              {Number(summary!.drafts) === 1 ? "" : "es"} por completar
              <ArrowUpRight size={15} />
            </button>
          )}
          {Number(summary?.rejected) > 0 && (
            <button onClick={() => filter("rejected")}>
              <AlertCircle size={17} />
              {count(summary!.rejected)} por corregir
              <ArrowUpRight size={15} />
            </button>
          )}
          {Number(summary?.new_inquiries) > 0 && (
            <Link href={`${root}/contactos`}>
              <MessageSquare size={17} />
              {count(summary!.new_inquiries)} consulta
              {Number(summary!.new_inquiries) === 1 ? "" : "s"} nueva
              {Number(summary!.new_inquiries) === 1 ? "" : "s"}
              <ArrowUpRight size={15} />
            </Link>
          )}
          {Number(summary?.pending) > 0 && (
            <button onClick={() => filter("pending_review")}>
              <Clock3 size={17} />
              {count(summary!.pending)} en revisión
              <ArrowUpRight size={15} />
            </button>
          )}
        </div>
      </div>
      <div className={styles.tools}>
        <label className={styles.search}>
          <Search size={19} />
          <input
            aria-label="Buscar publicaciones"
            placeholder="Buscar por título, comuna o código"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button onClick={() => setSearch("")} aria-label="Limpiar búsqueda">
              ×
            </button>
          )}
        </label>
        <label className={styles.selectLabel}>
          Estado
          <select
            aria-label="Estado de publicación"
            value={status}
            onChange={(e) => filter(e.target.value)}
          >
            {statuses.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div
        className={styles.tabs}
        role="group"
        aria-label="Filtrar propiedades por estado"
      >
        {statuses.map(([value, label, key]) => (
          <button
            key={value}
            aria-pressed={status === value}
            className={status === value ? styles.selectedTab : ""}
            onClick={() => filter(value)}
          >
            {label}
            <span>{count(summary?.[key])}</span>
          </button>
        ))}
      </div>
      <div className={styles.resultLine} role="status">
        {loading
          ? "Actualizando propiedades…"
          : data
            ? `${count(data.total)} ${data.total === 1 ? "propiedad" : "propiedades"}${query ? ` para «${query}»` : ""}${status ? ` · ${labels[status]}` : ""}`
            : "Tu catálogo"}
        <span>Indicadores acumulados por propiedad</span>
      </div>
      {error && (
        <div className={styles.error} role="alert">
          <AlertCircle size={18} />
          <span>{error}</span>
          <button onClick={() => refresh((n) => n + 1)}>Reintentar</button>
        </div>
      )}
      {notice && (
        <p className={styles.success} role="status">
          <Check size={17} />
          {notice}
        </p>
      )}
      <div className={styles.cards} aria-busy={loading}>
        {data?.items.map((p) => {
          const editable = ["draft", "rejected", "paused"].includes(
              p.publication_status,
            ),
            missing = propertyMissingFields(p),
            m = p.insights;
          const disabled = loading || busyId !== null;
          return (
            <article
              className={styles.card}
              key={p.id}
              aria-labelledby={`title-${p.id}`}
            >
              <div className={styles.cardMain}>
                <Cover key={p.media[0]?.url || p.id} property={p} />
                <div className={styles.details}>
                  <div className={styles.badges}>
                    <span
                      className={`${styles.badge} ${styles["state_" + p.publication_status] || ""}`}
                    >
                      {p.publication_status === "published" ? (
                        <Check size={13} />
                      ) : p.publication_status === "pending_review" ? (
                        <Clock3 size={13} />
                      ) : p.publication_status === "paused" ? (
                        <Pause size={13} />
                      ) : (
                        <FileText size={13} />
                      )}
                      {labels[p.publication_status] || p.publication_status}
                    </span>
                    <span className={styles.availability}>
                      {labels[p.availability]}
                    </span>
                  </div>
                  <Link href={`${root}/propiedades/${p.id}/editar`}>
                    <h2 id={`title-${p.id}`}>
                      {p.title || "Borrador sin título"}
                    </h2>
                  </Link>
                  <p className={styles.location}>
                    <MapPin size={15} />
                    {[p.commune_name, p.region_name]
                      .filter(Boolean)
                      .join(", ") || "Ubicación por completar"}
                  </p>
                  <strong className={styles.price}>
                    {price(p.price_amount, p.price_unit)}
                  </strong>
                  <p className={styles.meta}>
                    {p.code} · {labels[p.type_id] || p.type_id}
                    {admin ? ` · ${p.advertiser.name}` : ""}
                  </p>
                  {p.updated_at && (
                    <p className={styles.updated}>
                      Actualizada {date(p.updated_at)}
                    </p>
                  )}
                </div>
                <div className={styles.cardControls}>
                  <Link
                    className={styles.secondary}
                    href={`${root}/propiedades/${p.id}/editar`}
                  >
                    <Pencil size={16} />
                    {editable && missing.length
                      ? "Completar datos"
                      : "Editar propiedad"}
                  </Link>
                  {editable && !missing.length && (
                    <button
                      disabled={disabled}
                      className={styles.primary}
                      onClick={() =>
                        void action(p, { status: "pending_review" })
                      }
                    >
                      {busyId === p.id ? "Guardando…" : "Enviar a revisión"}
                    </button>
                  )}
                  {p.publication_status === "published" && (
                    <>
                      <Link
                        className={styles.textLink}
                        href={`/propiedades/${p.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Ver ficha
                        <ArrowUpRight size={15} />
                      </Link>
                      <button
                        className={styles.textLink}
                        onClick={() => void share(p)}
                      >
                        <Share2 size={15} />
                        Compartir
                      </button>
                    </>
                  )}
                  {admin && p.publication_status === "pending_review" && (
                    <>
                      <button
                        disabled={disabled}
                        className={styles.primary}
                        onClick={() => void action(p, { status: "published" })}
                      >
                        Aprobar y publicar
                      </button>
                      <button
                        disabled={disabled}
                        className={styles.textLink}
                        onClick={() => setTarget(p)}
                      >
                        Solicitar correcciones
                      </button>
                    </>
                  )}
                  <details className={styles.more}>
                    <summary
                      aria-label={`Más acciones de ${p.title || p.code}`}
                    >
                      <MoreHorizontal size={19} />
                      Más acciones
                    </summary>
                    <div className={styles.moreContent}>
                      {p.publication_status === "published" && (
                        <button
                          disabled={disabled}
                          onClick={() => void action(p, { status: "paused" })}
                        >
                          Pausar publicación
                        </button>
                      )}
                      {p.publication_status !== "archived" ? (
                        <button
                          disabled={disabled}
                          onClick={() => void action(p, { status: "archived" })}
                        >
                          Archivar propiedad
                        </button>
                      ) : (
                        <button
                          disabled={disabled}
                          onClick={() => void action(p, { status: "draft" })}
                        >
                          Recuperar borrador
                        </button>
                      )}
                      <label>
                        Disponibilidad
                        <select
                          aria-label={`Disponibilidad de ${p.title}`}
                          value={p.availability}
                          disabled={disabled}
                          onChange={(e) =>
                            void action(
                              p,
                              { availability: e.target.value },
                              "availability",
                            )
                          }
                        >
                          {["available", "reserved", "sold"].map((s) => (
                            <option key={s} value={s}>
                              {labels[s]}
                            </option>
                          ))}
                        </select>
                      </label>
                      {admin && (
                        <label className={styles.featured}>
                          <input
                            type="checkbox"
                            checked={!!p.featured}
                            disabled={disabled}
                            onChange={(e) =>
                              void action(
                                p,
                                { featured: e.target.checked },
                                "featured",
                              )
                            }
                          />
                          Destacada
                        </label>
                      )}
                    </div>
                  </details>
                </div>
              </div>
              <div
                className={styles.metrics}
                aria-label={`Rendimiento de ${p.title || p.code}`}
              >
                <span>
                  <Eye size={17} />
                  <strong>{count(m?.views)}</strong>Vistas de ficha
                </span>
                <span>
                  <Heart size={17} />
                  <strong>{count(m?.favorites)}</strong>Guardados
                </span>
                <span>
                  <MessageSquare size={17} />
                  <strong>{count(m?.inquiries)}</strong>Consultas
                  {Number(m?.new_inquiries) > 0 && (
                    <em>{count(m!.new_inquiries)} nuevas</em>
                  )}
                </span>
                <span>
                  <Video size={17} />
                  <strong>{count(m?.video_count ?? undefined)}</strong>Videos
                  {m?.video_count != null && m.video_count > 0 && (
                    <small>
                      {count(m.published_videos ?? undefined)} publicados
                    </small>
                  )}
                </span>
              </div>
              {p.publication_status !== "archived" && (
                <div className={styles.cardPending}>
                  {p.publication_status === "rejected" ? (
                    <>
                      <AlertCircle size={18} />
                      <p>
                        <strong>Requiere correcciones.</strong>{" "}
                        {p.moderation_reason ||
                          "Revisa los datos de la publicación antes de enviarla nuevamente."}
                      </p>
                    </>
                  ) : editable ? (
                    <>
                      <FileText size={18} />
                      <p>
                        <strong>
                          {missing.length
                            ? "Completa tu publicación."
                            : "Lista para enviar a revisión."}
                        </strong>{" "}
                        {missing.length
                          ? `Falta: ${missing.join(", ")}.`
                          : p.publication_status === "paused"
                            ? "Tu propiedad está pausada. Envíala a revisión para volver a publicarla."
                            : "Revisa los datos y envíala cuando quieras publicarla."}
                      </p>
                    </>
                  ) : p.publication_status === "pending_review" ? (
                    <>
                      <Clock3 size={18} />
                      <p>
                        <strong>Pendiente de aprobación.</strong> La propiedad y
                        el video preparado para publicarse con ella aparecerán
                        al aprobarla.
                      </p>
                    </>
                  ) : (
                    <>
                      <Check size={18} />
                      <p>
                        <strong>Tu propiedad está visible.</strong> Mantén el
                        precio y la disponibilidad actualizados.
                      </p>
                    </>
                  )}
                  {Number(m?.new_inquiries) > 0 && (
                    <Link href={`${root}/contactos`}>
                      Ver consultas
                      <ArrowUpRight size={14} />
                    </Link>
                  )}
                </div>
              )}
            </article>
          );
        })}
        {!loading && data && !data.items.length && (
          <div className={styles.empty}>
            <House size={36} />
            <h2>
              {query || status
                ? "No hay propiedades con estos filtros"
                : "Tu próxima publicación comienza aquí"}
            </h2>
            <p>
              {query || status
                ? "Prueba otro estado o busca por título, comuna o código."
                : "Crea una propiedad y administra aquí sus datos, videos y consultas."}
            </p>
            {query || status ? (
              <button
                className={styles.secondary}
                onClick={() => {
                  setSearch("");
                  setQuery("");
                  filter("");
                }}
              >
                Limpiar filtros
              </button>
            ) : (
              <Link
                className={styles.primary}
                href={`${root}/propiedades/nueva`}
              >
                <Plus size={17} />
                Crear mi primera propiedad
              </Link>
            )}
          </div>
        )}
      </div>
      {data && data.pages > 1 && (
        <nav
          className={styles.pagination}
          aria-label="Paginación de propiedades"
        >
          <button
            disabled={loading || page <= 1}
            onClick={() => setPage((n) => n - 1)}
          >
            Anterior
          </button>
          <span>
            Página {data.page} de {data.pages}
          </span>
          <button
            disabled={loading || page >= data.pages}
            onClick={() => setPage((n) => n + 1)}
          >
            Siguiente
          </button>
        </nav>
      )}
      {target && (
        <Rejection
          property={target}
          error={error}
          busy={busyId !== null}
          onClose={() => setTarget(null)}
          onSubmit={(reason) =>
            void action(target, { status: "rejected", reason })
          }
        />
      )}
    </section>
  );
}
