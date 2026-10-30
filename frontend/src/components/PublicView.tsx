"use client";
import Link from "next/link";
import { Fragment, useEffect, useState } from "react";
import { siteDesign } from "@/lib/site-design";
import {
  ArrowUpRight,
  MapPin,
  BedDouble,
  Bath,
  Maximize2,
  Search,
  SlidersHorizontal,
  ArrowLeft,
  Check,
  House,
  Building2,
  Trees,
  ShieldCheck,
  MessageSquare,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { assetUrl, labels, price, request, send } from "@/lib/estate-api";
import { Empty, FavoriteButton, Notice, useEstate } from "./EstateApp";
import { getSiteUrl } from "@/lib/siteUrl";

export function PropertyCard({ p }: { p: any }) {
  return (
    <article className="property-card">
      <Link className="property-image" href={`/propiedades/${p.slug}`}>
        <img
          src={assetUrl(p.media?.[0]?.url)}
          alt={p.media?.[0]?.alt_text || p.title}
          loading="lazy"
        />
        <span className="image-label">{labels[p.type_id] || p.type_id}</span>
        {p.featured === 1 && <span className="featured-label">Destacada</span>}
      </Link>
      <FavoriteButton id={p.id} />
      <div className="property-card-body">
        <span className={`availability ${p.availability}`}>
          {labels[p.availability]}
        </span>
        <h3>
          <Link href={`/propiedades/${p.slug}`}>
            {p.title || "Nueva propiedad"}
          </Link>
        </h3>
        <p className="location">
          <MapPin size={14} />
          {[p.neighborhood, p.commune_name].filter(Boolean).join(", ")}
        </p>
        <strong className="card-price">
          {price(p.price_amount, p.price_unit)}
        </strong>
        <div className="property-metrics">
          {p.bedrooms !== null && (
            <span>
              <BedDouble size={17} />
              {p.bedrooms} dorm.
            </span>
          )}
          {p.bathrooms !== null && (
            <span>
              <Bath size={17} />
              {p.bathrooms} baños
            </span>
          )}
          <span>
            <Maximize2 size={16} />
            {Number(p.built_area || p.land_area || 0).toLocaleString(
              "es-CL",
            )}{" "}
            m²
          </span>
        </div>
        <div className="card-bottom">
          <span>{p.advertiser?.name}</span>
          <Link href={`/propiedades/${p.slug}`} aria-label={`Ver ${p.title}`}>
            <ArrowUpRight size={20} />
          </Link>
        </div>
      </div>
    </article>
  );
}
function SearchBar() {
  const { catalog } = useEstate();
  const [region, setRegion] = useState("");
  return (
    <form className="hero-search" action="/propiedades">
      <label>
        <span>¿DÓNDE BUSCAS?</span>
        <select
          name="region_id"
          value={region}
          onChange={(e) => setRegion(e.target.value)}
        >
          <option value="">Todas las regiones</option>
          {catalog.regions.map((r: any) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>TIPO DE PROPIEDAD</span>
        <select name="type_id">
          <option value="">Todas las propiedades</option>
          {catalog.types
            .filter((t: any) => t.active)
            .map((t: any) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
        </select>
      </label>
      <label>
        <span>ESTOY BUSCANDO</span>
        <select name="operation_type">
          <option value="sale">Comprar una propiedad</option>
        </select>
      </label>
      <button className="button" type="submit">
        <Search size={18} />
        Buscar
      </button>
    </form>
  );
}
function Home() {
  const { settings } = useEstate();
  const design = siteDesign(settings);
  const visibleSections = design.sections.filter((s) => s.visible);
  const searchIndex = visibleSections.findIndex((s) => s.id === "search");
  const searchAfterHero =
    searchIndex > 0 && visibleSections[searchIndex - 1].id === "hero";
  const [items, setItems] = useState<any[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    request("/properties?limit=6")
      .then((r) => setItems(r.items))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  const sections: Record<string, React.ReactNode> = {
    hero: (
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">
            <span className="tiny-line" />
            ENCUENTRA TU PRÓXIMO LUGAR
          </span>
          <h1>
            {settings.homepage_title ===
            "Un nuevo lugar para tu próxima historia." ? (
              <>
                Un nuevo lugar
                <br />
                para tu{" "}
                <em>
                  próxima
                  <br className="desktop-break" /> historia.
                </em>
              </>
            ) : (
              settings.homepage_title
            )}
          </h1>
          <p>
            Desde la primera búsqueda hasta encontrar las llaves.
            <br />
            Descubre propiedades y conecta con su anunciante.
          </p>
          <div className="hero-proof">
            <span className="round-icon">
              <ShieldCheck size={19} />
            </span>
            <span>Propiedades reales. Nuevos comienzos.</span>
          </div>
        </div>
        <div className={`hero-art${design.hero_url ? " custom-hero" : ""}`}>
          <img
            src={
              design.hero_url ? assetUrl(design.hero_url) : "/architecture.svg"
            }
            alt={
              design.hero_url
                ? design.hero_alt
                : "Ilustración de una casa contemporánea entre árboles"
            }
          />
          {!design.hero_url && (
            <div className="hero-art-caption">
              <span className="caption-dot" />
              ESPACIOS PARA VIVIR MEJOR<span>01 / CHILE</span>
            </div>
          )}
        </div>
      </section>
    ),
    search: (
      <div
        className={`search-wrap${searchAfterHero ? "" : " search-standalone"}`}
      >
        <SearchBar />
      </div>
    ),
    types: (
      <section className="section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">EXPLORA A TU MANERA</span>
            <h2>Un espacio para cada proyecto.</h2>
          </div>
          <p>
            ¿Una casa, un departamento o un terreno?
            <br />
            Tu búsqueda empieza donde tú quieras.
          </p>
        </div>
        <div className="type-grid">
          {[
            {
              id: "house",
              name: "Casas",
              detail: "Más espacio para tu vida",
              icon: House,
            },
            {
              id: "apartment",
              name: "Departamentos",
              detail: "Todo más cerca",
              icon: Building2,
            },
            {
              id: "plot",
              name: "Parcelas y terrenos",
              detail: "Imagina las posibilidades",
              icon: Trees,
            },
          ].map((t) => (
            <Link
              key={t.id}
              href={`/propiedades?type_id=${t.id}`}
              className="type-tile"
            >
              <t.icon size={35} strokeWidth={1} />
              <div>
                <h3>{t.name}</h3>
                <span>{t.detail}</span>
              </div>
              <ArrowUpRight size={22} />
            </Link>
          ))}
        </div>
      </section>
    ),
    listings: (
      <section className="section listings-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">NUEVAS OPORTUNIDADES</span>
            <h2>El próximo lugar podría estar aquí.</h2>
          </div>
          <Link href="/propiedades" className="text-link">
            Ver todas las propiedades <ArrowUpRight size={18} />
          </Link>
        </div>
        <Notice error={error} />
        {loading ? (
          <div className="empty">Buscando nuevos lugares…</div>
        ) : items.length ? (
          <div className="property-grid">
            {items.map((p) => (
              <PropertyCard key={p.id} p={p} />
            ))}
          </div>
        ) : (
          <Empty>
            <span>
              Aún no hay propiedades publicadas.{" "}
              <Link href="/dashboard/perfil">Sé el primero en publicar.</Link>
            </span>
          </Empty>
        )}
      </section>
    ),
    publish: (
      <section className="publish-banner">
        <div>
          <span className="eyebrow">PARA PROPIETARIOS E INMOBILIARIAS</span>
          <h2>
            Tu propiedad.
            <br />
            Su próximo comienzo.
          </h2>
          <p>
            Crea tu perfil, publica tu propiedad y recibe consultas
            <br />
            de personas que están buscando un lugar como el tuyo.
          </p>
          <Link href="/dashboard/perfil" className="button light">
            Comenzar a publicar <ArrowUpRight size={18} />
          </Link>
        </div>
        <div className="steps">
          <div>
            <span>01</span>
            <p>Crea tu perfil de anunciante</p>
          </div>
          <div>
            <span>02</span>
            <p>Comparte los detalles de tu propiedad</p>
          </div>
          <div>
            <span>03</span>
            <p>Conecta con personas interesadas</p>
          </div>
        </div>
      </section>
    ),
  };
  return (
    <>
      {visibleSections.map((s) => (
        <Fragment key={s.id}>{sections[s.id]}</Fragment>
      ))}
    </>
  );
}
function SearchView({
  advertiserId,
  heading = "Encuentra tu próximo lugar",
}: {
  advertiserId?: string;
  heading?: string;
}) {
  const { catalog } = useEstate();
  const [q, setQ] = useState<any>({ sort: "recent", page: "1" }),
    [initialized, setInitialized] = useState(false),
    [result, setResult] = useState<any>({ items: [], total: 0, pages: 0 }),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [open, setOpen] = useState(false);
  useEffect(() => {
    // Hydrate URL filters only after the browser location is available.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQ({
      sort: "recent",
      page: "1",
      ...Object.fromEntries(new URLSearchParams(window.location.search)),
    });
    setInitialized(true);
  }, []);
  useEffect(() => {
    if (!initialized) return;
    let live = true;
    // Display pending state while synchronizing filters with the remote catalog.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(q)) if (v) params.set(k, String(v));
    if (advertiserId) params.set("advertiser_id", advertiserId);
    const timer = setTimeout(() => {
      request("/properties?" + params)
        .then((r) => {
          if (live) setResult(r);
        })
        .catch((e) => {
          if (live) setError(e.message);
        })
        .finally(() => {
          if (live) setLoading(false);
        });
    }, 250);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [q, initialized, advertiserId]);
  const field = (key: string, value: string) => {
    setQ((prev: any) => ({
      ...prev,
      [key]: value,
      page: "1",
      ...(key === "region_id" ? { commune_id: "" } : {}),
    }));
  };
  const activeAmenities = String(q.amenities || "")
    .split(",")
    .filter(Boolean);
  const applyUrl = () => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(q)) if (v) params.set(k, String(v));
    history.replaceState(null, "", "?" + params.toString());
  };
  return (
    <main className="section catalog-page">
      <div className="breadcrumbs">
        <Link href="/">Inicio</Link>
        <ChevronRight size={13} />
        <span>Propiedades en venta</span>
      </div>
      <div className="section-heading">
        <div>
          <span className="eyebrow">ESPACIOS PARA UN NUEVO COMIENZO</span>
          <h1>{heading}</h1>
          <p>Explora propiedades en venta en Chile.</p>
        </div>
      </div>
      <div className="catalog-toolbar">
        <label className="search-input">
          <Search size={19} />
          <input
            aria-label="Buscar por título, comuna o código"
            placeholder="Comuna, palabra o código de propiedad"
            value={q.search || ""}
            onChange={(e) => field("search", e.target.value)}
          />
        </label>
        <button
          className="button outline filter-toggle"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
        >
          <SlidersHorizontal size={17} />
          Filtros
        </button>
        <select
          aria-label="Ordenar resultados"
          value={q.sort}
          onChange={(e) => field("sort", e.target.value)}
        >
          <option value="recent">Más recientes</option>
          <option value="oldest">Más antiguas</option>
          {q.price_unit && (
            <>
              <option value="price_asc">Menor precio</option>
              <option value="price_desc">Mayor precio</option>
            </>
          )}
        </select>
      </div>
      <div className="catalog-layout">
        <aside className={`filter-panel ${open ? "visible" : ""}`}>
          <div className="filter-title">
            <h3>Refina tu búsqueda</h3>
            <button
              className="text-button"
              onClick={() => {
                setQ({ sort: "recent", page: "1" });
                history.replaceState(null, "", location.pathname);
              }}
            >
              Limpiar
            </button>
          </div>
          <label>
            Tipo
            <select
              value={q.type_id || ""}
              onChange={(e) => field("type_id", e.target.value)}
            >
              <option value="">Todos los tipos</option>
              {catalog.types
                .filter((t: any) => t.active)
                .map((t: any) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Región
            <select
              value={q.region_id || ""}
              onChange={(e) => field("region_id", e.target.value)}
            >
              <option value="">Todas las regiones</option>
              {catalog.regions.map((r: any) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Comuna
            <select
              value={q.commune_id || ""}
              onChange={(e) => field("commune_id", e.target.value)}
            >
              <option value="">Todas las comunas</option>
              {catalog.communes
                .filter(
                  (c: any) =>
                    !q.region_id || String(c.region_id) === String(q.region_id),
                )
                .map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </label>
          <fieldset>
            <legend>Precio</legend>
            <select
              aria-label="Unidad del precio"
              value={q.price_unit || ""}
              onChange={(e) =>
                setQ({
                  ...q,
                  price_unit: e.target.value,
                  min_price: "",
                  max_price: "",
                  sort: "recent",
                  page: "1",
                })
              }
            >
              <option value="">Todas las unidades</option>
              <option value="CLP">Pesos chilenos · CLP</option>
              <option value="UF">Unidad de Fomento · UF</option>
            </select>
            <div className="form-grid">
              <input
                type="number"
                min="0.0001"
                step="any"
                aria-label="Precio mínimo"
                placeholder="Desde"
                disabled={!q.price_unit}
                value={q.min_price || ""}
                onChange={(e) => field("min_price", e.target.value)}
              />
              <input
                type="number"
                min="0.0001"
                step="any"
                aria-label="Precio máximo"
                placeholder="Hasta"
                disabled={!q.price_unit}
                value={q.max_price || ""}
                onChange={(e) => field("max_price", e.target.value)}
              />
            </div>
            <small>Selecciona CLP o UF para comparar precios.</small>
          </fieldset>
          <div className="form-grid">
            <label>
              Dormitorios
              <select
                value={q.bedrooms || ""}
                onChange={(e) => field("bedrooms", e.target.value)}
              >
                <option value="">Cualquiera</option>
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n} o más
                  </option>
                ))}
              </select>
            </label>
            <label>
              Baños
              <select
                value={q.bathrooms || ""}
                onChange={(e) => field("bathrooms", e.target.value)}
              >
                <option value="">Cualquiera</option>
                {[1, 2, 3, 4].map((n) => (
                  <option key={n} value={n}>
                    {n} o más
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label>
            Superficie construida mínima (m²)
            <input
              type="number"
              min="1"
              value={q.min_area || ""}
              onChange={(e) => field("min_area", e.target.value)}
            />
          </label>
          <label>
            Disponibilidad
            <select
              value={q.availability || ""}
              onChange={(e) => field("availability", e.target.value)}
            >
              <option value="">Todas</option>
              {["available", "reserved", "sold"].map((k) => (
                <option key={k} value={k}>
                  {labels[k]}
                </option>
              ))}
            </select>
          </label>
          <fieldset>
            <legend>Características</legend>
            {catalog.amenities
              .filter((a: any) => a.active)
              .map((a: any) => (
                <label className="check-label" key={a.id}>
                  <input
                    type="checkbox"
                    checked={activeAmenities.includes(a.id)}
                    onChange={(e) =>
                      field(
                        "amenities",
                        (e.target.checked
                          ? [...activeAmenities, a.id]
                          : activeAmenities.filter((v) => v !== a.id)
                        ).join(","),
                      )
                    }
                  />
                  {a.name}
                </label>
              ))}
          </fieldset>
          <button className="button outline" onClick={applyUrl}>
            Guardar filtros en la URL
          </button>
        </aside>
        <section>
          <div className="result-count">
            <span>
              {loading
                ? "Buscando…"
                : `${result.total} ${result.total === 1 ? "propiedad encontrada" : "propiedades encontradas"}`}
            </span>
            <span>Venta · Chile</span>
          </div>
          <Notice error={error} />
          {loading ? (
            <div className="empty">Cargando propiedades…</div>
          ) : result.items.length ? (
            <div className="property-grid catalog-grid">
              {result.items.map((p: any) => (
                <PropertyCard key={p.id} p={p} />
              ))}
            </div>
          ) : (
            <Empty title="No encontramos propiedades con estos filtros">
              Prueba otra ubicación o amplía los criterios de búsqueda.
            </Empty>
          )}
          {result.pages > 1 && (
            <div className="pagination">
              <button
                disabled={Number(q.page) <= 1}
                onClick={() => setQ({ ...q, page: String(Number(q.page) - 1) })}
              >
                <ChevronLeft size={17} />
                Anterior
              </button>
              <span>
                Página {q.page} de {result.pages}
              </span>
              <button
                disabled={Number(q.page) >= result.pages}
                onClick={() => setQ({ ...q, page: String(Number(q.page) + 1) })}
              >
                Siguiente
                <ChevronRight size={17} />
              </button>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
function Detail({
  identifier,
  initialProperty,
}: {
  identifier: string;
  initialProperty?: any;
}) {
  const [p, setP] = useState<any>(initialProperty || null),
    [error, setError] = useState(""),
    [selected, setSelected] = useState(0),
    [success, setSuccess] = useState(""),
    [busy, setBusy] = useState(false),
    [visit, setVisit] = useState(false);
  const { user } = useEstate();
  useEffect(() => {
    if (
      initialProperty &&
      (initialProperty.id === identifier || initialProperty.slug === identifier)
    ) {
      setP(initialProperty);
      send(`/properties/${initialProperty.id}/view`, {}).catch(() => {});
      return;
    }
    setP(null);
    setError("");
    request("/properties/" + encodeURIComponent(identifier))
      .then((p) => {
        setP(p);
        send(`/properties/${p.id}/view`, {}).catch(() => {});
      })
      .catch((e) => setError(e.message));
  }, [identifier, initialProperty]);
  if (error)
    return (
      <main className="section">
        <Notice error={error} />
        <Link href="/propiedades" className="text-link">
          <ArrowLeft size={16} />
          Volver a buscar
        </Link>
      </main>
    );
  if (!p) return <main className="section empty">Cargando propiedad…</main>;
  const metrics = [
    ["Dormitorios", p.bedrooms, BedDouble],
    ["Baños", p.bathrooms, Bath],
    ["Construidos", p.built_area, Maximize2],
    ["Terreno", p.land_area, Trees],
  ] as const;
  const jsonld = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: p.title,
    url: getSiteUrl() + "/propiedades/" + p.slug,
    description: p.summary || p.description,
    mainEntity: {
      "@type":
        p.type_id === "house"
          ? "House"
          : p.type_id === "apartment"
            ? "Apartment"
            : "Place",
      name: p.title,
      numberOfRooms: p.bedrooms,
      address: {
        "@type": "PostalAddress",
        addressLocality: p.commune_name,
        addressRegion: p.region_name,
        addressCountry: "CL",
      },
      floorSize: p.built_area
        ? {
            "@type": "QuantitativeValue",
            value: Number(p.built_area),
            unitCode: "MTK",
          }
        : undefined,
    },
  };
  return (
    <main className="section detail-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonld).replace(/</g, "\\u003c"),
        }}
      />
      <div className="breadcrumbs">
        <Link href="/propiedades">Propiedades</Link>
        <ChevronRight size={13} />
        <span>{p.commune_name}</span>
        <ChevronRight size={13} />
        <span>{p.code}</span>
      </div>
      <div className="detail-heading">
        <div>
          <span className="eyebrow">
            {labels[p.type_id] || p.type_id} EN VENTA · {p.code}
          </span>
          <h1>{p.title}</h1>
          <p className="location">
            <MapPin size={17} />
            {[p.neighborhood, p.commune_name, p.region_name]
              .filter(Boolean)
              .join(", ")}
          </p>
        </div>
        <FavoriteButton id={p.id} />
      </div>
      <div className="detail-layout">
        <div>
          <div className="gallery-main">
            <img
              src={assetUrl(p.media[selected]?.url)}
              alt={p.media[selected]?.alt_text || p.title}
            />
            <span>
              {selected + 1} / {p.media.length}
            </span>
          </div>
          <div className="gallery-thumbs">
            {p.media.map((m: any, i: number) => (
              <button
                key={m.id}
                aria-label={`Ver fotografía ${i + 1}`}
                aria-pressed={selected === i}
                className={selected === i ? "selected" : ""}
                onClick={() => setSelected(i)}
              >
                <img
                  src={assetUrl(m.url)}
                  alt={m.alt_text || `Fotografía ${i + 1}`}
                />
              </button>
            ))}
          </div>
          <div className="detail-metrics">
            {metrics
              .filter((m) => m[1] !== null)
              .map(([name, value, Icon]) => (
                <div key={name}>
                  <Icon size={22} />
                  <strong>
                    {Number(value).toLocaleString("es-CL")}
                    {name === "Construidos" || name === "Terreno" ? " m²" : ""}
                  </strong>
                  <span>{name}</span>
                </div>
              ))}
          </div>
          <section className="detail-section">
            <h2>Un lugar que vale la pena conocer.</h2>
            <p className="preserve-lines">{p.description}</p>
          </section>
          <section className="detail-section">
            <h2>Características</h2>
            <div className="amenity-grid">
              {p.amenities.map((a: any) => (
                <span key={a.id}>
                  <Check size={16} />
                  {a.name}
                </span>
              ))}
            </div>
            <dl className="facts">
              {[
                ["Estacionamientos", p.parking],
                ["Bodegas", p.storage_rooms],
                ["Año de construcción", p.construction_year],
                [
                  "Superficie útil",
                  p.usable_area ? `${Number(p.usable_area)} m²` : null,
                ],
                [
                  "Gastos comunes mensuales",
                  p.common_expenses
                    ? price(p.common_expenses, p.expense_unit)
                    : null,
                ],
                [
                  "Contribuciones",
                  p.contributions
                    ? `${price(p.contributions, p.expense_unit)} · ${p.contributions_period === "quarterly" ? "trimestrales" : p.contributions_period === "monthly" ? "mensuales" : "anuales"}`
                    : null,
                ],
              ]
                .filter((v) => v[1] !== null && v[1] !== undefined)
                .map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
            </dl>
          </section>
          <section className="detail-section location-card">
            <MapPin size={25} />
            <div>
              <h2>Ubicación</h2>
              <p>
                {p.location?.address ||
                  [p.neighborhood, p.commune_name].filter(Boolean).join(", ")}
              </p>
              <small>
                {p.show_exact_address
                  ? "Dirección publicada por el anunciante."
                  : "La dirección exacta se entrega al coordinar con el anunciante."}
              </small>
              {p.location?.latitude && (
                <p>
                  <a
                    className="text-link"
                    target="_blank"
                    rel="noreferrer"
                    href={`https://www.openstreetmap.org/?mlat=${p.location.latitude}&mlon=${p.location.longitude}#map=16/${p.location.latitude}/${p.location.longitude}`}
                  >
                    Ver ubicación en el mapa <ArrowUpRight size={15} />
                  </a>
                </p>
              )}
            </div>
          </section>
        </div>
        <aside className="contact-card">
          <span className={`availability ${p.availability}`}>
            {labels[p.availability]}
          </span>
          <h2>{price(p.price_amount, p.price_unit)}</h2>
          <p className="muted">Precio de venta</p>
          <hr />
          <span className="eyebrow">PUBLICADO POR</span>
          <h3>
            <Link href={`/anunciantes/${p.advertiser.slug}`}>
              {p.advertiser.name}
            </Link>
          </h3>
          <p>Consulta directamente con el anunciante.</p>
          {p.advertiser.phone && (
            <a
              className="text-link"
              href={`tel:${p.advertiser.phone.replace(/[^+\d]/g, "")}`}
            >
              {p.advertiser.phone}
            </a>
          )}
          {p.advertiser.whatsapp && (
            <a
              className="button outline"
              target="_blank"
              rel="noreferrer"
              href={`https://wa.me/${p.advertiser.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent("Hola, me interesa " + p.title + " (" + p.code + ")")}`}
            >
              Contactar por WhatsApp <ArrowUpRight size={17} />
            </a>
          )}
          <div className="contact-tabs">
            <button
              className={!visit ? "selected" : ""}
              onClick={() => setVisit(false)}
            >
              <MessageSquare size={16} />
              Consultar
            </button>
            <button
              className={visit ? "selected" : ""}
              onClick={() => setVisit(true)}
            >
              <CalendarDays size={16} />
              Visita
            </button>
          </div>
          <Notice success={success} />
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setSuccess("");
              const form = e.currentTarget,
                b = Object.fromEntries(new FormData(form));
              try {
                const r = await send(`/properties/${p.id}/inquiries`, {
                  ...b,
                  consent: true,
                  requested_at:
                    visit && b.requested_at
                      ? new Date(String(b.requested_at)).toISOString()
                      : undefined,
                });
                setSuccess(r.message);
                form.reset();
              } catch (e) {
                setSuccess("Error: " + (e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              Tu nombre
              <input
                name="name"
                defaultValue={user?.firstName || ""}
                minLength={2}
                maxLength={120}
                required
                autoComplete="name"
              />
            </label>
            <label>
              Correo
              <input
                type="email"
                name="email"
                defaultValue={user?.email || ""}
                required
                autoComplete="email"
              />
            </label>
            <label>
              Teléfono
              <input
                name="phone"
                type="tel"
                maxLength={40}
                autoComplete="tel"
              />
            </label>
            {visit && (
              <label>
                Fecha y hora deseada
                <input name="requested_at" type="datetime-local" required />
                <small>
                  Horario de tu dispositivo. El anunciante confirmará la
                  disponibilidad.
                </small>
              </label>
            )}
            <label>
              Mensaje
              <textarea
                name="message"
                required
                minLength={10}
                maxLength={5000}
                defaultValue={`Hola, me interesa esta propiedad (${p.code}).`}
              />
            </label>
            <label className="honeypot" aria-hidden="true">
              Sitio web
              <input name="website" tabIndex={-1} autoComplete="off" />
            </label>
            <label className="check-label consent">
              <input type="checkbox" required />
              Acepto compartir mis datos con el anunciante para responder esta
              solicitud. <Link href="/privacidad">Privacidad</Link>
            </label>
            <button
              className="button"
              disabled={busy || p.availability === "sold"}
            >
              {busy
                ? "Enviando…"
                : visit
                  ? "Solicitar visita"
                  : "Enviar consulta"}
              <ArrowUpRight size={17} />
            </button>
          </form>
        </aside>
      </div>
    </main>
  );
}
function Advertisers({ slug }: { slug?: string }) {
  const [rows, setRows] = useState<any[]>([]),
    [a, setA] = useState<any>(null),
    [error, setError] = useState("");
  useEffect(() => {
    request(slug ? "/advertisers/" + encodeURIComponent(slug) : "/advertisers")
      .then((r) => (slug ? setA(r) : setRows(r)))
      .catch((e) => setError(e.message));
  }, [slug]);
  if (slug)
    return (
      <>
        <section className="section advertiser-intro">
          <Notice error={error} />
          {a && (
            <>
              <span className="eyebrow">{labels[a.kind]}</span>
              <h1>{a.display_name}</h1>
              <p className="preserve-lines">
                {a.description || "Conoce las propiedades de este anunciante."}
              </p>
              {a.phone && (
                <a
                  className="text-link"
                  href={`tel:${a.phone.replace(/[^+\d]/g, "")}`}
                >
                  {a.phone}
                </a>
              )}
            </>
          )}
        </section>
        {a && <SearchView advertiserId={a.id} heading="Sus propiedades" />}
      </>
    );
  return (
    <main className="section">
      <span className="eyebrow">PERSONAS DETRÁS DE CADA LUGAR</span>
      <h1>Conoce a nuestros anunciantes.</h1>
      <Notice error={error} />
      {rows.length ? (
        <div className="advertiser-grid">
          {rows.map((a) => (
            <Link
              className="advertiser-card"
              key={a.id}
              href={`/anunciantes/${a.slug}`}
            >
              {a.logo_media_id ? (
                <img
                  src={assetUrl("/api/media/" + a.logo_media_id)}
                  alt={a.display_name}
                />
              ) : (
                <Building2 size={35} strokeWidth={1} />
              )}
              <span className="eyebrow">{labels[a.kind]}</span>
              <h2>{a.display_name}</h2>
              <p>
                {a.description?.slice(0, 170) ||
                  "Explora sus publicaciones inmobiliarias."}
              </p>
              <span className="text-link">
                Ver propiedades <ArrowUpRight size={17} />
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <Empty title="Pronto conocerás a nuestros anunciantes">
          Los perfiles aparecerán aquí una vez aprobados.
        </Empty>
      )}
    </main>
  );
}
function Favorites() {
  const { user, loading, favorites } = useEstate();
  const [items, setItems] = useState<any[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    if (user)
      request("/me/favorites")
        .then(setItems)
        .catch((e) => setError(e.message));
  }, [user, favorites]);
  return (
    <main className="section">
      <span className="eyebrow">TUS POSIBILIDADES, EN UN LUGAR</span>
      <h1>Propiedades que te gustan.</h1>
      <Notice error={error} />
      {loading ? (
        <p>Cargando…</p>
      ) : !user ? (
        <Empty title="Guarda tus próximos lugares">
          <Link className="button" href="/login">
            Inicia sesión para ver tus favoritos
          </Link>
        </Empty>
      ) : items.length ? (
        <div className="property-grid">
          {items.map((p) => (
            <PropertyCard key={p.id} p={p} />
          ))}
        </div>
      ) : (
        <Empty title="Tu próxima historia todavía está por guardarse">
          <Link href="/propiedades">Explorar propiedades</Link>
        </Empty>
      )}
    </main>
  );
}
function Account() {
  const { user } = useEstate();
  const [msg, setMsg] = useState("");
  return (
    <main className="section narrow">
      <h1>Tu cuenta</h1>
      {!user ? (
        <Link className="button" href="/login">
          Iniciar sesión
        </Link>
      ) : (
        <>
          <p>
            {user.firstName} · {user.email}
          </p>
          <h2>Cambiar contraseña</h2>
          <Notice success={msg} />
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const form = e.currentTarget;
              try {
                await send(
                  "/auth/change-password",
                  Object.fromEntries(new FormData(form)),
                );
                setMsg("Contraseña actualizada.");
                form.reset();
              } catch (e) {
                setMsg((e as Error).message);
              }
            }}
          >
            <label>
              Contraseña actual
              <input
                required
                name="currentPassword"
                type="password"
                autoComplete="current-password"
              />
            </label>
            <label>
              Nueva contraseña
              <input
                required
                minLength={10}
                maxLength={72}
                name="newPassword"
                type="password"
                autoComplete="new-password"
              />
            </label>
            <button className="button">Actualizar</button>
          </form>
        </>
      )}
    </main>
  );
}
export function PublicView({
  path,
  initialProperty,
}: {
  path: string[];
  initialProperty?: any;
}) {
  const { settings } = useEstate();
  if (path[0] === "propiedades")
    return path[1] ? (
      <Detail identifier={path[1]} initialProperty={initialProperty} />
    ) : (
      <SearchView />
    );
  if (path[0] === "anunciantes") return <Advertisers slug={path[1]} />;
  if (path[0] === "favoritos") return <Favorites />;
  if (path[0] === "cuenta") return <Account />;
  if (path[0] === "informacion" || path[0] === "privacidad")
    return (
      <main className="section narrow">
        <span className="eyebrow">{settings.site_name}</span>
        <h1>
          {path[0] === "privacidad"
            ? "Tus datos y tu privacidad."
            : "Un espacio para conectar."}
        </h1>
        <p className="preserve-lines">
          {path[0] === "privacidad"
            ? "Los datos que entregas al consultar una propiedad se comparten con su anunciante y con la administración para gestionar tu solicitud. No publiques información sensible en los mensajes. La dirección exacta de una propiedad solo se muestra cuando su anunciante lo autoriza. Puedes solicitar información o cambios sobre tus datos al contacto del marketplace."
            : settings.about_text ||
              "Propiedades conecta a propietarios, corredores e inmobiliarias con personas que buscan un nuevo lugar en Chile. Explora publicaciones, guarda tus favoritas y coordina consultas y visitas directamente con el anunciante."}
        </p>
        {settings.contact_email && (
          <a className="button" href={`mailto:${settings.contact_email}`}>
            Contactar al marketplace
          </a>
        )}
      </main>
    );
  return <Home />;
}
