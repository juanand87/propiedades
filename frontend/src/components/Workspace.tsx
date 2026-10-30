"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Plus,
  LayoutDashboard,
  House,
  MessageSquare,
  CalendarDays,
  Images,
  Users,
  Settings,
  LogOut,
  Building2,
  ListFilter,
  Eye,
  Check,
  X,
  ChevronUp,
  ChevronDown,
  Trash2,
} from "lucide-react";
import { assetUrl, date, labels, price, request, send } from "@/lib/estate-api";
import { Empty, Notice, useEstate } from "./EstateApp";
import { DesignAdmin } from "./DesignAdmin";

function useLoad(path: string) {
  const [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [count, setCount] = useState(0);
  useEffect(() => {
    let live = true;
    // A new remote resource must clear the previous request's error.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setError("");
    request(path)
      .then((r) => {
        if (live) setData(r);
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [path, count]);
  return { data, error, reload: () => setCount((n) => n + 1), setData };
}
function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", fn);
    return () => document.removeEventListener("keydown", fn);
  }, [onClose]);
  return (
    <div className="modal-overlay" onClick={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="section-heading">
          <h2>{title}</h2>
          <button onClick={onClose} aria-label="Cerrar">
            <X size={19} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
export function Workspace({ path }: { path: string[] }) {
  const { user, setUser, loading } = useEstate(),
    router = useRouter();
  const root = path[0] === "panel" ? "/panel" : "/dashboard",
    section = path[1] || "",
    isAdmin = user?.role === "admin";
  useEffect(() => {
    if (!loading && !user)
      router.replace(root === "/panel" ? "/panel/login" : "/login");
  }, [loading, user, root, router]);
  if (loading || !user)
    return <main className="section empty">Verificando tu cuenta…</main>;
  if (root === "/panel" && !isAdmin)
    return (
      <main className="section">
        <h1>Este espacio es de administración.</h1>
        <Link className="button" href="/dashboard">
          Ir a mi panel
        </Link>
      </main>
    );
  const nav = [
    { href: "", name: "Resumen", icon: LayoutDashboard },
    {
      href: "propiedades",
      name: isAdmin ? "Propiedades" : "Mis propiedades",
      icon: House,
    },
    { href: "contactos", name: "Interesados", icon: MessageSquare },
    { href: "visitas", name: "Solicitudes de visita", icon: CalendarDays },
    { href: "biblioteca", name: "Biblioteca de imágenes", icon: Images },
    { href: "perfil", name: "Perfil de anunciante", icon: Building2 },
    { href: "sitio", name: "Mi sitio web", icon: House },
    ...(isAdmin
      ? [
          { href: "anunciantes", name: "Anunciantes", icon: Users },
          { href: "usuarios", name: "Usuarios", icon: Users },
          { href: "catalogos", name: "Tipos y ubicaciones", icon: ListFilter },
          { href: "diseno", name: "Diseño del sitio", icon: Images },
          {
            href: "configuracion",
            name: "Configuración del sitio",
            icon: Settings,
          },
        ]
      : []),
  ];
  return (
    <div className="workspace">
      <aside className="workspace-nav">
        <span className="eyebrow">
          {isAdmin ? "ADMINISTRACIÓN" : "ESPACIO DEL ANUNCIANTE"}
        </span>
        <h3>Hola, {user.firstName}</h3>
        <nav aria-label="Navegación del panel">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={`${root}/${n.href}`}
              className={section === n.href ? "active" : ""}
            >
              <n.icon size={18} />
              {n.name}
            </Link>
          ))}
        </nav>
        <Link href="/cuenta">
          <Settings size={17} />
          Mi cuenta y contraseña
        </Link>
        <button
          className="text-button"
          onClick={() => {
            localStorage.removeItem("propiedades:token");
            setUser(null);
            router.push("/");
          }}
        >
          <LogOut size={17} />
          Cerrar sesión
        </button>
      </aside>
      <main className="workspace-main">
        <div className="workspace-top">
          <span>
            {isAdmin ? "Panel administrativo" : "Tu espacio de publicaciones"}
          </span>
          <Link href="/propiedades" className="text-link">
            Ver marketplace <ArrowUpRight size={16} />
          </Link>
        </div>
        {section === "propiedades" ? (
          path[2] === "nueva" || path[3] === "editar" ? (
            <PropertyEditor
              root={root}
              id={path[2] === "nueva" ? undefined : path[2]}
            />
          ) : (
            <PropertyList root={root} />
          )
        ) : section === "perfil" ? (
          <Profile />
        ) : section === "biblioteca" ? (
          <Library />
        ) : section === "contactos" || section === "visitas" ? (
          <Contacts visits={section === "visitas"} />
        ) : section === "anunciantes" && isAdmin ? (
          <AdvertiserAdmin />
        ) : section === "usuarios" && isAdmin ? (
          <UserAdmin />
        ) : section === "catalogos" && isAdmin ? (
          <CatalogAdmin />
        ) : section === "sitio" ? (
          user.advertiser_id ? (
            <DesignAdmin key={`broker-${user.advertiser_id}`} broker />
          ) : (
            <Empty title="Primero, crea tu perfil de anunciante">
              <Link className="button" href={`${root}/perfil`}>
                Completar mi perfil
              </Link>
            </Empty>
          )
        ) : section === "diseno" && isAdmin ? (
          <DesignAdmin />
        ) : section === "configuracion" && isAdmin ? (
          <SettingsAdmin />
        ) : section === "" ? (
          <Overview root={root} />
        ) : (
          <Empty title="Esta sección no está disponible">
            <Link href={root}>Volver al resumen</Link>
          </Empty>
        )}
      </main>
    </div>
  );
}
function Overview({ root }: { root: string }) {
  const { data, error } = useLoad("/manage/stats");
  const { user } = useEstate();
  return (
    <>
      <div className="section-heading">
        <div>
          <span className="eyebrow">UNA MIRADA A TU ACTIVIDAD</span>
          <h1>
            Cada publicación,
            <br />
            una nueva posibilidad.
          </h1>
        </div>
        <Link className="button" href={`${root}/propiedades/nueva`}>
          <Plus size={18} />
          Nueva propiedad
        </Link>
      </div>
      <Notice error={error} />
      <div className="stats-grid">
        {[
          ["Publicaciones", data?.total, House],
          ["Publicadas", data?.published, Check],
          ["En revisión", data?.pending, ListFilter],
          ["Interesados", data?.inquiries, MessageSquare],
          ["Visitas a fichas", data?.views, Eye],
          ["Vendidas", data?.sold, Building2],
        ].map(([label, value, Icon]: any) => (
          <div className="stat-card" key={label}>
            <Icon size={22} />
            <strong>{value ?? "—"}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>
      {!user.advertiser_id && (
        <div className="panel-card onboarding">
          <Building2 size={35} />
          <div>
            <h2>Primero, presentémonos.</h2>
            <p>
              Completa tu perfil de propietario, corredor o inmobiliaria para
              comenzar a publicar.
            </p>
            <Link className="button outline" href={`${root}/perfil`}>
              Completar mi perfil <ArrowUpRight size={17} />
            </Link>
          </div>
        </div>
      )}
      <div className="panel-card">
        <h2>Así funciona tu publicación</h2>
        <div className="workflow">
          <span>Borrador</span>
          <ArrowUpRight size={19} />
          <span>Revisión</span>
          <ArrowUpRight size={19} />
          <span>Publicación</span>
          <ArrowUpRight size={19} />
          <span>Consultas y visitas</span>
        </div>
        <p>
          Publica información precisa y fotos propias. Las modificaciones de una
          propiedad publicada vuelven a revisión. Reservada y vendida describen
          la disponibilidad; no son pagos ni reservas online.
        </p>
      </div>
    </>
  );
}
function PropertyList({ root }: { root: string }) {
  const { user } = useEstate();
  const [status, setStatus] = useState(""),
    [page, setPage] = useState(1),
    [search, setSearch] = useState(""),
    [target, setTarget] = useState<any>(null),
    [error, setError] = useState("");
  const {
    data,
    error: loadError,
    reload,
  } = useLoad(
    `/manage/properties?page=${page}&status=${status}&search=${encodeURIComponent(search)}`,
  );
  const action = async (id: string, b: any, endpoint = "status") => {
    setError("");
    try {
      await send(
        `/manage/properties/${id}/${endpoint}`,
        {
          ...b,
          ...(endpoint === "status"
            ? { revision: data?.items.find((p: any) => p.id === id)?.revision }
            : {}),
        },
        "PATCH",
      );
      reload();
      setTarget(null);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <>
      <div className="section-heading">
        <div>
          <span className="eyebrow">TU CATÁLOGO INMOBILIARIO</span>
          <h1>{user.role === "admin" ? "Propiedades" : "Mis propiedades"}</h1>
        </div>
        <Link className="button" href={`${root}/propiedades/nueva`}>
          <Plus size={18} />
          Nueva publicación
        </Link>
      </div>
      <div className="catalog-toolbar">
        <input
          aria-label="Buscar publicaciones"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Título, comuna o código"
        />
        <select
          aria-label="Estado de publicación"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Todos los estados</option>
          {[
            "draft",
            "pending_review",
            "published",
            "paused",
            "rejected",
            "archived",
          ].map((s) => (
            <option key={s} value={s}>
              {labels[s]}
            </option>
          ))}
        </select>
      </div>
      <Notice error={error || loadError} />
      {data?.items.length ? (
        <div className="listing-table">
          {data.items.map((p: any) => (
            <article key={p.id} className="manage-property">
              <img
                src={assetUrl(p.media[0]?.url)}
                alt={p.title || "Borrador"}
              />
              <div>
                <span className={`status-tag ${p.publication_status}`}>
                  {labels[p.publication_status]}
                </span>
                <h3>{p.title || "Borrador sin título"}</h3>
                <p>
                  {p.code} · {p.commune_name || "Ubicación pendiente"} ·{" "}
                  {p.advertiser.name}
                </p>
                <strong>{price(p.price_amount, p.price_unit)}</strong>
                {p.moderation_reason && (
                  <p className="review-reason">
                    Revisión: {p.moderation_reason}
                  </p>
                )}
              </div>
              <div className="manage-actions">
                <Link
                  className="button outline small"
                  href={`${root}/propiedades/${p.id}/editar`}
                >
                  Editar
                </Link>
                {p.publication_status === "published" && (
                  <Link
                    className="text-link"
                    target="_blank"
                    href={`/propiedades/${p.slug}`}
                  >
                    Ver ficha <ArrowUpRight size={15} />
                  </Link>
                )}
                {["draft", "rejected", "paused"].includes(
                  p.publication_status,
                ) && (
                  <button
                    className="button small"
                    onClick={() => action(p.id, { status: "pending_review" })}
                  >
                    Enviar a revisión
                  </button>
                )}
                {user.role === "admin" &&
                  p.publication_status === "pending_review" && (
                    <>
                      <button
                        className="button small"
                        onClick={() => action(p.id, { status: "published" })}
                      >
                        Aprobar y publicar
                      </button>
                      <button
                        className="text-button danger"
                        onClick={() => setTarget(p)}
                      >
                        Rechazar
                      </button>
                    </>
                  )}
                {p.publication_status === "published" && (
                  <button
                    className="text-button"
                    onClick={() => action(p.id, { status: "paused" })}
                  >
                    Pausar
                  </button>
                )}
                {p.publication_status !== "archived" ? (
                  <button
                    className="text-button"
                    onClick={() => action(p.id, { status: "archived" })}
                  >
                    Archivar
                  </button>
                ) : (
                  <button
                    className="text-button"
                    onClick={() => action(p.id, { status: "draft" })}
                  >
                    Recuperar borrador
                  </button>
                )}
                <select
                  aria-label={`Disponibilidad de ${p.title}`}
                  value={p.availability}
                  onChange={(e) =>
                    action(
                      p.id,
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
                {user.role === "admin" && (
                  <label className="check-label">
                    <input
                      type="checkbox"
                      checked={!!p.featured}
                      onChange={(e) =>
                        action(p.id, { featured: e.target.checked }, "featured")
                      }
                    />
                    Destacada
                  </label>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <Empty title="No hay publicaciones en esta vista">
          Crea una propiedad o cambia los filtros.
        </Empty>
      )}
      {data?.pages > 1 && (
        <div className="pagination">
          <button disabled={page === 1} onClick={() => setPage(page - 1)}>
            Anterior
          </button>
          <span>
            {page} / {data.pages}
          </span>
          <button
            disabled={page >= data.pages}
            onClick={() => setPage(page + 1)}
          >
            Siguiente
          </button>
        </div>
      )}
      {target && (
        <Modal title="Motivo del rechazo" onClose={() => setTarget(null)}>
          <Notice error={error} />
          <form
            onSubmit={(e) => {
              e.preventDefault();
              action(target.id, {
                status: "rejected",
                reason: new FormData(e.currentTarget).get("reason"),
              });
            }}
          >
            <p>{target.title}</p>
            <label>
              Qué debe corregir el anunciante
              <textarea name="reason" required maxLength={1000} autoFocus />
            </label>
            <button className="button">Guardar revisión</button>
          </form>
        </Modal>
      )}
    </>
  );
}
const numberLabels: Record<string, string> = {
  price_amount: "Precio de venta",
  built_area: "Superficie construida (m²)",
  usable_area: "Superficie útil (m²)",
  land_area: "Superficie de terreno (m²)",
  bedrooms: "Dormitorios",
  bathrooms: "Baños",
  parking: "Estacionamientos",
  storage_rooms: "Bodegas",
  construction_year: "Año de construcción",
  floors: "Pisos de la propiedad",
  floor_number: "Piso de la unidad",
  common_expenses: "Gastos comunes mensuales",
  contributions: "Contribuciones",
};
function PropertyEditor({ root, id }: { root: string; id?: string }) {
  const { catalog, user } = useEstate(),
    router = useRouter();
  const [form, setForm] = useState<any>({
      type_id: "house",
      price_unit: "CLP",
      expense_unit: "CLP",
      contributions_period: "quarterly",
      condition_type: "unknown",
      show_exact_address: false,
    }),
    [images, setImages] = useState<any[]>([]),
    [amenities, setAmenities] = useState<string[]>([]),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(""),
    [busy, setBusy] = useState(false),
    [library, setLibrary] = useState<any[] | null>(null),
    [advertisers, setAdvertisers] = useState<any[]>([]),
    [history, setHistory] = useState<any[]>([]);
  useEffect(() => {
    if (id) {
      request("/manage/properties/" + id)
        .then((p) => {
          setForm({
            ...p,
            address: p.location?.address || "",
            latitude: p.location?.latitude || "",
            longitude: p.location?.longitude || "",
          });
          setImages(p.media);
          setAmenities(p.amenities.map((a: any) => a.id));
        })
        .catch((e) => setError(e.message));
      request(`/manage/properties/${id}/history`)
        .then(setHistory)
        .catch(() => {});
    }
    if (user.role === "admin")
      request("/admin/advertisers")
        .then(setAdvertisers)
        .catch(() => {});
  }, [id, user.role]);
  const set = (k: string, v: any) =>
    setForm((prev: any) => ({
      ...prev,
      [k]: v,
      ...(k === "region_id" ? { commune_id: "" } : {}),
    }));
  const select = (
    key: string,
    label: string,
    options: any[],
    valueKey = "id",
    labelKey = "name",
  ) => (
    <label key={key}>
      {label}
      <select
        value={form[key] ?? ""}
        onChange={(e) => set(key, e.target.value)}
      >
        <option value="">Seleccionar</option>
        {options.map((o) => (
          <option key={o[valueKey]} value={o[valueKey]}>
            {o[labelKey]}
          </option>
        ))}
      </select>
    </label>
  );
  const number = (key: string) => (
    <label key={key}>
      {numberLabels[key]}
      <input
        type="number"
        min={key === "floor_number" ? -20 : 0}
        step={
          [
            "price_amount",
            "built_area",
            "usable_area",
            "land_area",
            "common_expenses",
            "contributions",
          ].includes(key)
            ? "0.0001"
            : "1"
        }
        value={form[key] ?? ""}
        onChange={(e) => set(key, e.target.value)}
      />
    </label>
  );
  const land = ["land", "plot"].includes(form.type_id);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    setSaved("");
    try {
      const r = await send(
        id ? "/manage/properties/" + id : "/manage/properties",
        { ...form, amenity_ids: amenities, media_ids: images.map((m) => m.id) },
        id ? "PATCH" : "POST",
      );
      router.push(`${root}/propiedades/${r.id}/editar`);
      setSaved(
        "Propiedad guardada. Puedes enviarla a revisión desde el listado.",
      );
      if (id) {
        const p = await request("/manage/properties/" + id);
        setForm({
          ...p,
          address: p.location?.address || "",
          latitude: p.location?.latitude || "",
          longitude: p.location?.longitude || "",
        });
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Link className="text-link" href={`${root}/propiedades`}>
        <ArrowLeft size={16} />
        Volver a propiedades
      </Link>
      <div className="section-heading">
        <div>
          <span className="eyebrow">PUBLICA CON TODOS LOS DETALLES</span>
          <h1>{id ? "Editar propiedad" : "Un nuevo lugar para compartir."}</h1>
        </div>
        {id && (
          <span className="status-tag">
            {labels[form.publication_status] || "Borrador"}
          </span>
        )}
      </div>
      <Notice error={error} success={saved} />
      {form.publication_status === "published" && (
        <div className="notice">
          Al guardar, esta publicación volverá a revisión y dejará de mostrarse
          hasta su aprobación.
        </div>
      )}
      <form onSubmit={save} className="property-editor">
        <section className="panel-card">
          <h2>01 · Lo esencial</h2>
          <p>Puedes guardar un borrador incompleto y retomarlo más adelante.</p>
          {user.role === "admin" &&
            !id &&
            select(
              "advertiser_id",
              "Cuenta anunciante",
              advertisers,
              "id",
              "display_name",
            )}
          <label>
            Título de la propiedad
            <input
              maxLength={180}
              value={form.title || ""}
              onChange={(e) => set("title", e.target.value)}
              placeholder="Casa con jardín en una ubicación privilegiada"
            />
          </label>
          <div className="form-grid">
            {select(
              "type_id",
              "Tipo de propiedad",
              catalog.types.filter((t: any) => t.active),
            )}
            <label>
              Operación
              <input value="Venta" readOnly />
            </label>
          </div>
          <label>
            Resumen
            <input
              maxLength={400}
              value={form.summary || ""}
              onChange={(e) => set("summary", e.target.value)}
            />
          </label>
          <label>
            Descripción
            <textarea
              rows={7}
              maxLength={30000}
              value={form.description || ""}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Cuéntanos cómo es vivir aquí, su distribución y qué hace especial a esta propiedad."
            />
          </label>
        </section>
        <section className="panel-card">
          <h2>02 · Ubicación y privacidad</h2>
          <div className="form-grid">
            {select("region_id", "Región", catalog.regions)}
            {select(
              "commune_id",
              "Comuna",
              catalog.communes.filter(
                (c: any) => String(c.region_id) === String(form.region_id),
              ),
            )}
          </div>
          <label>
            Sector o barrio
            <input
              maxLength={120}
              value={form.neighborhood || ""}
              onChange={(e) => set("neighborhood", e.target.value)}
            />
          </label>
          <label>
            Dirección exacta
            <input
              maxLength={255}
              value={form.address || ""}
              onChange={(e) => set("address", e.target.value)}
            />
          </label>
          <label className="check-label">
            <input
              type="checkbox"
              checked={!!form.show_exact_address}
              onChange={(e) => set("show_exact_address", e.target.checked)}
            />
            Mostrar dirección y coordenadas exactas en la ficha pública
          </label>
          <small>
            Sin esta autorización, la API pública solo entrega comuna y sector.
          </small>
          <div className="form-grid">
            <label>
              Latitud (opcional)
              <input
                type="number"
                step="any"
                min="-90"
                max="90"
                value={form.latitude || ""}
                onChange={(e) => set("latitude", e.target.value)}
              />
            </label>
            <label>
              Longitud (opcional)
              <input
                type="number"
                step="any"
                min="-180"
                max="180"
                value={form.longitude || ""}
                onChange={(e) => set("longitude", e.target.value)}
              />
            </label>
          </div>
        </section>
        <section className="panel-card">
          <h2>03 · Precio y superficies</h2>
          <div className="form-grid">
            {number("price_amount")}
            {select("price_unit", "Unidad del precio", [
              { id: "CLP", name: "Pesos chilenos (CLP)" },
              { id: "UF", name: "Unidad de Fomento (UF)" },
            ])}
            {!land && number("built_area")}
            {!land && number("usable_area")}
            {number("land_area")}
          </div>
          <small>
            Los precios en UF y CLP se muestran y filtran por separado.
          </small>
        </section>
        <section className="panel-card">
          <h2>04 · Características</h2>
          <div className="form-grid">
            {(!land
              ? [
                  "bedrooms",
                  "bathrooms",
                  "parking",
                  "storage_rooms",
                  "construction_year",
                  "floors",
                  ...(form.type_id === "apartment" ? ["floor_number"] : []),
                ]
              : ["parking"]
            ).map(number)}
            {select("condition_type", "Estado", [
              { id: "unknown", name: "Sin especificar" },
              { id: "new", name: "Nueva" },
              { id: "used", name: "Usada" },
              { id: "renovated", name: "Remodelada" },
              { id: "project", name: "En proyecto" },
            ])}
          </div>
          <div className="amenity-grid">
            {catalog.amenities
              .filter((a: any) => a.active)
              .map((a: any) => (
                <label className="check-label" key={a.id}>
                  <input
                    type="checkbox"
                    checked={amenities.includes(a.id)}
                    onChange={(e) =>
                      setAmenities(
                        e.target.checked
                          ? [...amenities, a.id]
                          : amenities.filter((k) => k !== a.id),
                      )
                    }
                  />
                  {a.name}
                </label>
              ))}
          </div>
          <div className="form-grid">
            {number("common_expenses")}
            {number("contributions")}
            {select("expense_unit", "Unidad de gastos", [
              { id: "CLP", name: "CLP" },
              { id: "UF", name: "UF" },
            ])}
            {select("contributions_period", "Periodicidad de contribuciones", [
              { id: "monthly", name: "Mensual" },
              { id: "quarterly", name: "Trimestral" },
              { id: "yearly", name: "Anual" },
            ])}
          </div>
        </section>
        <section className="panel-card">
          <h2>05 · Fotografías</h2>
          <p>
            La primera imagen es la portada. Hasta 20 fotografías propias; JPG,
            PNG o WebP de hasta 8 MB cada una.
          </p>
          <div className="upload-actions">
            <label className="button outline">
              Subir fotografías
              <input
                className="file-input"
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp"
                disabled={busy}
                onChange={async (e) => {
                  const files = Array.from(e.target.files || []);
                  e.target.value = "";
                  setBusy(true);
                  setError("");
                  try {
                    if (files.length + images.length > 20)
                      throw new Error("Máximo 20 fotografías.");
                    const added: any[] = [];
                    for (const file of files) {
                      const fd = new FormData();
                      fd.set("file", file);
                      added.push(
                        await request("/manage/media", {
                          method: "POST",
                          body: fd,
                        }),
                      );
                    }
                    setImages((prev) => [...prev, ...added]);
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              />
            </label>
            <button
              type="button"
              className="button outline"
              onClick={async () => {
                try {
                  setLibrary(await request("/manage/media"));
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              Elegir de mi biblioteca
            </button>
          </div>
          <div className="editor-gallery">
            {images.map((m, i) => (
              <div key={m.id}>
                <img src={assetUrl(m.url)} alt={`Fotografía ${i + 1}`} />
                <span>{i === 0 ? "Portada" : i + 1}</span>
                <div>
                  <button
                    type="button"
                    disabled={i === 0}
                    aria-label="Mover antes"
                    onClick={() => {
                      const copy = [...images];
                      [copy[i - 1], copy[i]] = [copy[i], copy[i - 1]];
                      setImages(copy);
                    }}
                  >
                    <ChevronUp size={17} />
                  </button>
                  <button
                    type="button"
                    disabled={i === images.length - 1}
                    aria-label="Mover después"
                    onClick={() => {
                      const copy = [...images];
                      [copy[i + 1], copy[i]] = [copy[i], copy[i + 1]];
                      setImages(copy);
                    }}
                  >
                    <ChevronDown size={17} />
                  </button>
                  <button
                    type="button"
                    aria-label="Quitar fotografía"
                    onClick={() =>
                      setImages(images.filter((v) => v.id !== m.id))
                    }
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
        <div className="editor-save">
          <p>
            Guardar no publica automáticamente. Envía el borrador a revisión
            desde el listado.
          </p>
          <button className="button" disabled={busy}>
            {busy ? "Guardando…" : "Guardar propiedad"}
            <Check size={18} />
          </button>
        </div>
      </form>
      {history.length > 0 && (
        <section className="panel-card">
          <h2>Historial de publicación</h2>
          {history.map((h, i) => (
            <p key={i}>
              {date(h.created_at)} ·{" "}
              {labels[h.previous_status] || h.previous_status} →{" "}
              {labels[h.next_status] || h.next_status} {h.note && `· ${h.note}`}
            </p>
          ))}
        </section>
      )}
      {library && (
        <Modal title="Tu biblioteca" onClose={() => setLibrary(null)}>
          <div className="editor-gallery">
            {library
              .filter((m) => !images.some((i) => i.id === m.id))
              .map((m) => (
                <button
                  type="button"
                  key={m.id}
                  disabled={images.length >= 20}
                  onClick={() => {
                    setImages([...images, m]);
                    setLibrary(null);
                  }}
                >
                  <img src={assetUrl(m.url)} alt={m.name} />
                  <span>Agregar</span>
                </button>
              ))}
          </div>
          {!library.length && <p>No hay fotografías disponibles.</p>}
        </Modal>
      )}
    </>
  );
}
function Profile() {
  const { user, setUser } = useEstate();
  const { data, error } = useLoad("/me/advertiser");
  const [form, setForm] = useState<any>({ kind: "owner" }),
    [message, setMessage] = useState(""),
    [failure, setFailure] = useState("");
  useEffect(() => {
    // Populate the editable draft after loading the server's advertiser profile.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (data) setForm(data);
  }, [data]);
  const set = (k: string, v: string) => setForm((p: any) => ({ ...p, [k]: v }));
  return (
    <>
      <span className="eyebrow">LA PRESENTACIÓN DE TUS PUBLICACIONES</span>
      <h1>Tu perfil de anunciante</h1>
      <Notice error={error || failure} success={message} />
      {data && (
        <p>
          Estado: <span className="status-tag">{labels[data.status]}</span> ·{" "}
          <Link href={`/anunciantes/${data.slug}`}>Ver mi sitio público</Link> ·{" "}
          <Link
            className="text-link"
            href={user.role === "admin" ? "/panel/sitio" : "/dashboard/sitio"}
          >
            Personalizar mi sitio web
          </Link>
        </p>
      )}
      <form
        className="panel-card"
        onSubmit={async (e) => {
          e.preventDefault();
          setFailure("");
          try {
            const a = await send("/me/advertiser", form);
            setForm(a);
            setUser(await request("/auth/profile"));
            setMessage(
              a.status === "pending"
                ? "Perfil guardado. La administración revisará tu solicitud."
                : "Perfil actualizado.",
            );
          } catch (e) {
            setFailure((e as Error).message);
          }
        }}
      >
        <label>
          Nombre público
          <input
            required
            maxLength={160}
            value={form.display_name || ""}
            onChange={(e) => set("display_name", e.target.value)}
          />
        </label>
        <label>
          Tipo de anunciante
          <select
            value={form.kind}
            onChange={(e) => set("kind", e.target.value)}
          >
            {["owner", "broker", "agency"].map((k) => (
              <option key={k} value={k}>
                {labels[k]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Presentación
          <textarea
            maxLength={4000}
            value={form.description || ""}
            onChange={(e) => set("description", e.target.value)}
          />
        </label>
        <div className="form-grid">
          {[
            ["phone", "Teléfono público"],
            ["whatsapp", "WhatsApp público (con código de país)"],
            ["public_email", "Correo público"],
            ["legal_name", "Razón social (privada)"],
            ["tax_id", "RUT (privado)"],
          ].map(([k, label]) => (
            <label key={k}>
              {label}
              <input
                type={k === "public_email" ? "email" : "text"}
                value={form[k] || ""}
                onChange={(e) => set(k, e.target.value)}
              />
            </label>
          ))}
        </div>
        <label>
          Logo (opcional)
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                const fd = new FormData();
                fd.set("file", file);
                const m = await request("/manage/media", {
                  method: "POST",
                  body: fd,
                });
                setForm((p: any) => ({ ...p, logo_media_id: m.id }));
              } catch (e) {
                setFailure((e as Error).message);
              }
            }}
          />
        </label>
        <button className="button">
          Guardar perfil <Check size={17} />
        </button>
        <small>
          Solo se publican los datos marcados como públicos. El perfil debe
          estar aprobado para publicar propiedades.
        </small>
      </form>
      {user.advertiser_status === "suspended" && (
        <div className="notice error">
          Tu cuenta está suspendida. Contacta a la administración.
        </div>
      )}
    </>
  );
}
function Library() {
  const { data, error, reload } = useLoad("/manage/media");
  const [failure, setFailure] = useState("");
  return (
    <>
      <div className="section-heading">
        <div>
          <span className="eyebrow">TUS RECURSOS VISUALES</span>
          <h1>Biblioteca de imágenes</h1>
        </div>
        <label className="button">
          Subir imagen
          <input
            className="file-input"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                const fd = new FormData();
                fd.set("file", file);
                await request("/manage/media", { method: "POST", body: fd });
                reload();
              } catch (e) {
                setFailure((e as Error).message);
              }
            }}
          />
        </label>
      </div>
      <p>
        Las imágenes utilizadas en publicaciones o en tu perfil no se pueden
        eliminar.
      </p>
      <Notice error={error || failure} />
      {data?.length ? (
        <div className="library-grid">
          {data.map((m: any) => (
            <article key={m.id}>
              <img src={assetUrl(m.url)} alt={m.name} />
              <p>{m.name}</p>
              <small>{Math.round(m.size_bytes / 1024)} KB</small>
              <button
                className="text-button danger"
                onClick={async () => {
                  try {
                    await request("/manage/media/" + m.id, {
                      method: "DELETE",
                    });
                    reload();
                    setFailure("");
                  } catch (e) {
                    setFailure((e as Error).message);
                  }
                }}
              >
                Eliminar imagen sin uso
              </button>
            </article>
          ))}
        </div>
      ) : (
        <Empty title="Tu biblioteca está lista para recibir fotografías" />
      )}
    </>
  );
}
function Contacts({ visits = false }: { visits?: boolean }) {
  const { data, error, reload } = useLoad("/manage/inquiries");
  const [failure, setFailure] = useState(""),
    [selected, setSelected] = useState<any>(null),
    [messages, setMessages] = useState<any[]>([]);
  const update = async (id: string, b: any) => {
    try {
      await send("/manage/inquiries/" + id, b, "PATCH");
      reload();
      setFailure("");
      if (selected?.id === id)
        setMessages(await request(`/manage/inquiries/${id}/messages`));
    } catch (e) {
      setFailure((e as Error).message);
    }
  };
  const rows = (data || []).filter((i: any) => !visits || i.visit_id);
  return (
    <>
      <span className="eyebrow">CONVERSACIONES QUE ABREN PUERTAS</span>
      <h1>{visits ? "Solicitudes de visita" : "Personas interesadas"}</h1>
      <Notice error={error || failure} />
      {rows.length ? (
        <div className="contact-list">
          {rows.map((i: any) => (
            <article className="panel-card" key={i.id}>
              <div className="section-heading">
                <div>
                  <span className="eyebrow">{i.code}</span>
                  <h2>{i.title}</h2>
                </div>
                <span className="status-tag">{labels[i.status]}</span>
              </div>
              <strong>{i.name}</strong>
              <p>
                <a href={`mailto:${i.email}`}>{i.email}</a>
                {i.phone && ` · ${i.phone}`}
              </p>
              <p className="preserve-lines">{i.message}</p>
              <small>{date(i.created_at)}</small>
              {i.requested_at && (
                <div className="visit-detail">
                  <CalendarDays size={19} />
                  <span>Visita solicitada: {date(i.requested_at)} · Chile</span>
                  <select
                    aria-label="Estado de visita"
                    value={i.visit_status}
                    onChange={(e) =>
                      update(i.id, { visit_status: e.target.value })
                    }
                  >
                    {["requested", "confirmed", "cancelled", "completed"].map(
                      (k) => (
                        <option key={k} value={k}>
                          {labels[k]}
                        </option>
                      ),
                    )}
                  </select>
                </div>
              )}
              <div className="row-actions">
                <select
                  aria-label="Estado del interesado"
                  value={i.status}
                  onChange={(e) => update(i.id, { status: e.target.value })}
                >
                  {["new", "contacted", "closed"].map((k) => (
                    <option key={k} value={k}>
                      {labels[k]}
                    </option>
                  ))}
                </select>
                <button
                  className="button outline small"
                  onClick={async () => {
                    setSelected(i);
                    try {
                      setMessages(
                        await request(`/manage/inquiries/${i.id}/messages`),
                      );
                    } catch (e) {
                      setFailure((e as Error).message);
                    }
                  }}
                >
                  Seguimiento interno
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <Empty
          title={
            visits ? "Aún no hay visitas solicitadas" : "Aún no hay consultas"
          }
        >
          Las solicitudes de tus propiedades aparecerán aquí.
        </Empty>
      )}
      {selected && (
        <Modal title="Seguimiento interno" onClose={() => setSelected(null)}>
          <Notice error={failure} />
          <p>
            Notas para el anunciante y administración. No se envían por correo.
          </p>
          {messages.map((m: any, i: number) => (
            <div className="message" key={i}>
              <p>{m.message}</p>
              <small>{date(m.created_at)}</small>
            </div>
          ))}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget;
              update(selected.id, {
                message: new FormData(form).get("message"),
              });
              form.reset();
            }}
          >
            <label>
              Nueva nota
              <textarea name="message" required maxLength={5000} />
            </label>
            <button className="button">Guardar nota</button>
          </form>
        </Modal>
      )}
    </>
  );
}
function AdvertiserAdmin() {
  const { data, error, reload } = useLoad("/admin/advertisers");
  const [failure, setFailure] = useState("");
  return (
    <>
      <h1>Anunciantes y solicitudes</h1>
      <Notice error={error || failure} />
      {data?.length ? (
        <div className="contact-list">
          {data.map((a: any) => (
            <article className="panel-card" key={a.id}>
              <span className="eyebrow">{labels[a.kind]}</span>
              <h2>{a.display_name}</h2>
              <p>
                {a.account_email} · {a.public_email || "Sin correo público"}
              </p>
              <p>{a.description}</p>
              <p>
                Razón social: {a.legal_name || "—"} · RUT: {a.tax_id || "—"}
              </p>
              <label>
                Estado de la cuenta
                <select
                  value={a.status}
                  onChange={async (e) => {
                    try {
                      await send(
                        "/admin/advertisers/" + a.id,
                        { status: e.target.value },
                        "PATCH",
                      );
                      reload();
                    } catch (e) {
                      setFailure((e as Error).message);
                    }
                  }}
                >
                  {["pending", "approved", "suspended"].map((s) => (
                    <option key={s} value={s}>
                      {labels[s]}
                    </option>
                  ))}
                </select>
              </label>
            </article>
          ))}
        </div>
      ) : (
        <Empty title="No hay solicitudes de anunciantes" />
      )}
    </>
  );
}
function UserAdmin() {
  const { data, error, reload } = useLoad("/admin/users");
  const [failure, setFailure] = useState("");
  const { user } = useEstate();
  return (
    <>
      <h1>Usuarios</h1>
      <Notice error={error || failure} />
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Correo</th>
              <th>Rol</th>
              <th>Cuenta</th>
            </tr>
          </thead>
          <tbody>
            {(data || []).map((u: any) => (
              <tr key={u.id}>
                <td>
                  {u.firstName} {u.lastName}
                </td>
                <td>{u.email}</td>
                <td>
                  <select
                    aria-label={`Rol de ${u.email}`}
                    disabled={u.id === user.id}
                    value={u.role}
                    onChange={async (e) => {
                      try {
                        await send(
                          "/admin/users/" + u.id,
                          { role: e.target.value, isActive: !!u.isActive },
                          "PATCH",
                        );
                        reload();
                      } catch (e) {
                        setFailure((e as Error).message);
                      }
                    }}
                  >
                    {["admin", "vendor", "customer"].map((s) => (
                      <option key={s} value={s}>
                        {labels[s]}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <label className="check-label">
                    <input
                      type="checkbox"
                      checked={!!u.isActive}
                      disabled={u.id === user.id}
                      onChange={async (e) => {
                        try {
                          await send(
                            "/admin/users/" + u.id,
                            { role: u.role, isActive: e.target.checked },
                            "PATCH",
                          );
                          reload();
                        } catch (e) {
                          setFailure((e as Error).message);
                        }
                      }}
                    />
                    Activa
                  </label>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
function CatalogAdmin() {
  const { catalog, reload } = useEstate();
  const [group, setGroup] = useState("types"),
    [error, setError] = useState(""),
    [success, setSuccess] = useState("");
  const rows = catalog[group] || [];
  return (
    <>
      <h1>Tipos, características y ubicaciones</h1>
      <div className="tabs">
        {[
          ["types", "Tipos"],
          ["amenities", "Características"],
          ["regions", "Regiones"],
          ["communes", "Comunas"],
        ].map(([id, name]) => (
          <button
            key={id}
            className={group === id ? "selected" : ""}
            onClick={() => setGroup(id)}
          >
            {name}
          </button>
        ))}
      </div>
      <Notice error={error} success={success} />
      <form
        className="panel-card form-grid"
        key={group}
        onSubmit={async (e) => {
          e.preventDefault();
          const form = e.currentTarget;
          try {
            await send("/admin/catalog", {
              ...Object.fromEntries(new FormData(form)),
              group,
            });
            await reload();
            form.reset();
            setSuccess("Catálogo actualizado.");
            setError("");
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        <label>
          Nombre
          <input required name="name" maxLength={100} />
        </label>
        {group !== "communes" && (
          <label>
            {group === "regions" ? "ID numérico" : "Código (opcional)"}
            <input
              name="id"
              type={group === "regions" ? "number" : "text"}
              required={group === "regions"}
            />
          </label>
        )}
        {group === "communes" && (
          <label>
            Región
            <select name="region_id" required>
              {catalog.regions.map((r: any) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <button className="button">Agregar o actualizar</button>
      </form>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Código</th>
              <th>Nombre</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r: any) => (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td>{r.name}</td>
                <td>
                  {["types", "amenities"].includes(group) ? (
                    <button
                      className="text-button"
                      onClick={async () => {
                        try {
                          await send("/admin/catalog", {
                            group,
                            id: r.id,
                            name: r.name,
                            active: !r.active,
                          });
                          await reload();
                        } catch (e) {
                          setError((e as Error).message);
                        }
                      }}
                    >
                      {r.active ? "Activo · desactivar" : "Inactivo · activar"}
                    </button>
                  ) : group === "communes" ? (
                    catalog.regions.find((x: any) => x.id === r.region_id)?.name
                  ) : (
                    "Región"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
function SettingsAdmin() {
  const { settings, reload } = useEstate();
  const [form, setForm] = useState<any>(settings),
    [error, setError] = useState(""),
    [success, setSuccess] = useState("");
  return (
    <>
      <h1>La identidad de tu marketplace</h1>
      <p>
        Para cambiar colores, logo, portada y orden de secciones, entra en{" "}
        <Link className="text-link" href="/panel/diseno">
          Diseño del sitio
        </Link>
        .
      </p>
      <Notice error={error} success={success} />
      <form
        className="panel-card"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await send("/admin/settings", form, "PATCH");
            await reload();
            setSuccess("Configuración guardada.");
            setError("");
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        {[
          ["site_name", "Nombre del marketplace"],
          ["tagline", "Frase de marca"],
          ["homepage_title", "Título de la portada"],
          ["contact_email", "Correo de contacto"],
        ].map(([k, label]) => (
          <label key={k}>
            {label}
            <input
              type={k === "contact_email" ? "email" : "text"}
              value={form[k] || ""}
              onChange={(e) => setForm({ ...form, [k]: e.target.value })}
            />
          </label>
        ))}
        <label>
          Acerca del marketplace
          <textarea
            rows={8}
            value={form.about_text || ""}
            onChange={(e) => setForm({ ...form, about_text: e.target.value })}
          />
        </label>
        <button className="button">Guardar configuración</button>
        <p>
          La indexación de buscadores se habilita con SITE_INDEX_ENABLED en el
          entorno del frontend, después de revisar el contenido público.
        </p>
      </form>
    </>
  );
}
