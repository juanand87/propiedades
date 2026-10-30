"use client";
import Link from "next/link";
import { createContext, useContext, useEffect, useState } from "react";
import { House, Menu, X, ArrowUpRight, Heart } from "lucide-react";
import { request } from "@/lib/estate-api";
import { assetUrl } from "@/lib/estate-api";
import { designStyle, siteDesign } from "@/lib/site-design";
import { PublicView } from "./PublicView";
import { Workspace } from "./Workspace";
import { AuthView } from "./AuthView";

type State = {
  user: any;
  setUser: (u: any) => void;
  catalog: any;
  settings: any;
  loading: boolean;
  reload: () => Promise<void>;
  favorites: string[];
  setFavorites: (ids: string[]) => void;
};
const Context = createContext<State>(null!);
export const useEstate = () => useContext(Context);
export function Notice({
  error,
  success,
}: {
  error?: string;
  success?: string;
}) {
  return error ? (
    <div role="alert" className="notice error">
      {error}
    </div>
  ) : success ? (
    <div role="status" className="notice success">
      {success}
    </div>
  ) : null;
}
export function Empty({
  title = "Todavía no hay publicaciones",
  children,
}: {
  title?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <House size={38} strokeWidth={1} />
      <h3>{title}</h3>
      <p>
        {children ||
          "Las nuevas propiedades aparecerán aquí cuando sean publicadas."}
      </p>
    </div>
  );
}
export function FavoriteButton({ id }: { id: string }) {
  const { user, favorites, setFavorites } = useEstate();
  const [error, setError] = useState("");
  const active = favorites.includes(id);
  return (
    <>
      <button
        aria-label={active ? "Quitar de favoritos" : "Guardar propiedad"}
        aria-pressed={active}
        className={`favorite ${active ? "saved" : ""}`}
        onClick={async (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!user) {
            location.href = "/login";
            return;
          }
          try {
            await request(`/me/favorites/${id}`, {
              method: active ? "DELETE" : "POST",
            });
            setFavorites(
              active ? favorites.filter((v) => v !== id) : [...favorites, id],
            );
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        <Heart size={19} fill={active ? "currentColor" : "none"} />
      </button>
      {error && (
        <span role="alert" className="small-error">
          {error}
        </span>
      )}
    </>
  );
}
export default function EstateApp({
  path,
  initialProperty,
  initialSettings,
}: {
  path: string[];
  initialProperty?: any;
  initialSettings?: any;
}) {
  const [user, setUser] = useState<any>(null),
    [loading, setLoading] = useState(true),
    [favorites, setFavorites] = useState<string[]>([]),
    [menu, setMenu] = useState(false);
  const [catalog, setCatalog] = useState<any>({
      types: [],
      amenities: [],
      regions: [],
      communes: [],
    }),
    [settings, setSettings] = useState<any>(
      initialSettings || {
        site_name: "Propiedades",
        tagline: "Encuentra tu próximo lugar",
        homepage_title: "Un nuevo lugar para tu próxima historia.",
      },
    );
  const reload = async () => {
    const [c, s] = await Promise.all([
      request("/catalog"),
      request("/settings"),
    ]);
    setCatalog(c);
    if (s) setSettings(s);
  };
  useEffect(() => {
    // Initialize remote catalogs and browser-only session state once on hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload().catch(() => {});
    const token = localStorage.getItem("propiedades:token");
    if (token) {
      request("/auth/profile")
        .then(setUser)
        .catch(() => setUser(null))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    if (user)
      request("/me/favorites")
        .then((rows) => setFavorites(rows.map((p: any) => p.id)))
        .catch(() => {});
    else {
      // Clear the previous account's favorites on logout.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFavorites([]);
    }
  }, [user]);
  const routeKey = path.join("/");
  useEffect(() => {
    // Close mobile navigation after a client-side route change.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMenu(false);
    window.scrollTo(0, 0);
  }, [routeKey]);
  const workspace =
    (path[0] === "panel" || path[0] === "dashboard") && path[1] !== "login";
  const auth =
    path[0] === "login" || path[0] === "register" || path[1] === "login";
  const design = siteDesign(settings);
  const brand = design.logo_url ? (
    <img
      className="site-logo"
      src={assetUrl(design.logo_url)}
      alt={settings.site_name}
    />
  ) : (
    <span className="brand-icon">
      <House size={23} />
    </span>
  );
  return (
    <Context.Provider
      value={{
        user,
        setUser,
        catalog,
        settings,
        loading,
        reload,
        favorites,
        setFavorites,
      }}
    >
      <div className="estate-site" style={designStyle(design)}>
        <header className="site-header">
          <Link
            href="/"
            className="brand"
            aria-label={`${settings.site_name}, inicio`}
          >
            {brand}
            {(!design.logo_url || design.show_site_name) && (
              <>
                {settings.site_name}
                <span className="brand-dot">.</span>
              </>
            )}
          </Link>
          <nav
            className={menu ? "main-nav open" : "main-nav"}
            aria-label="Navegación principal"
          >
            <Link
              href="/propiedades"
              className={path[0] === "propiedades" ? "active" : ""}
            >
              Buscar propiedades
            </Link>
            <Link href="/anunciantes">Anunciantes</Link>
            <Link href="/informacion">Nosotros</Link>
          </nav>
          <div className="header-actions">
            <Link
              href="/favoritos"
              aria-label="Mis favoritos"
              className="icon-link"
            >
              <Heart size={20} />
            </Link>
            <Link
              className="account-link"
              href={
                user
                  ? user.role === "admin"
                    ? "/panel"
                    : "/dashboard"
                  : "/login"
              }
            >
              {user ? "Mi panel" : "Ingresar"}
            </Link>
            <Link
              className="button small publish-link"
              href={user ? "/dashboard/perfil" : "/register"}
            >
              Publicar propiedad <ArrowUpRight size={16} />
            </Link>
            <button
              className="mobile-toggle"
              aria-label="Abrir navegación"
              aria-expanded={menu}
              onClick={() => setMenu(!menu)}
            >
              {menu ? <X /> : <Menu />}
            </button>
          </div>
        </header>
        {workspace ? (
          <Workspace path={path} />
        ) : auth ? (
          <AuthView
            register={path[0] === "register"}
            panel={path[0] === "panel"}
          />
        ) : (
          <PublicView path={path} initialProperty={initialProperty} />
        )}
        {!workspace && (
          <footer className="site-footer">
            <div>
              <Link href="/" className="brand">
                {brand}
                {(!design.logo_url || design.show_site_name) && (
                  <>
                    {settings.site_name}
                    <span className="brand-dot">.</span>
                  </>
                )}
              </Link>
              <p>
                Un lugar para comenzar algo nuevo.
                <br />
                Propiedades y personas, más cerca.
              </p>
            </div>
            <div>
              <span className="eyebrow">EXPLORA</span>
              <Link href="/propiedades">Propiedades en venta</Link>
              <Link href="/anunciantes">Nuestros anunciantes</Link>
              <Link href="/favoritos">Tus favoritos</Link>
            </div>
            <div>
              <span className="eyebrow">PUBLICA</span>
              <Link href="/dashboard/perfil">Propietarios y corredores</Link>
              <Link href="/informacion">Acerca del marketplace</Link>
              <Link href="/privacidad">Privacidad y contacto</Link>
            </div>
            <div className="footer-bottom">
              <span>
                © {new Date().getFullYear()} {settings.site_name}. Chile.
              </span>
              <span>
                Las consultas y visitas se coordinan directamente con el
                anunciante.
              </span>
            </div>
          </footer>
        )}
      </div>
    </Context.Provider>
  );
}
