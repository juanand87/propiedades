"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, ShieldCheck } from "lucide-react";
import { request, send, saveBrowserSession } from "@/lib/estate-api";
import { Notice, useEstate } from "./EstateApp";
export function AuthView({
  register = false,
  panel = false,
}: {
  register?: boolean;
  panel?: boolean;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [choosing, setChoosing] = useState(false),
    [googleEnabled, setGoogleEnabled] = useState(false);
  const [profileKind, setProfileKind] = useState("person");
  const googleRun = useRef(0);
  useEffect(() => {
    let live = true;
    request("/auth/options")
      .then((r) => {
        if (live) setGoogleEnabled(r.google);
      })
      .catch(() => {});
    return () => {
      live = false;
      googleRun.current++;
    };
  }, []);
  const { user, setUser, loading } = useEstate(),
    router = useRouter();
  function finish(r: any) {
    saveBrowserSession(r);
    setUser(r.user);
    const invitation = sessionStorage.getItem("proppix:team-invite");
    if (invitation && /^[a-f0-9]{64}$/.test(invitation)) {
      router.replace(`/invitaciones/equipo#token=${invitation}`);
      return;
    }
    if (r.user.role !== "admin" && r.user.account_type === null) {
      setChoosing(true);
      return;
    }
    router.replace(
      r.user.role === "admin"
        ? "/panel"
        : r.user.account_type === "buyer"
          ? "/descubrir"
          : "/dashboard",
    );
  }
  async function googleLogin() {
    const popup = window.open(
      "about:blank",
      "propiedades-google",
      "width=480,height=700",
    );
    if (!popup) {
      setError("Permite abrir la ventana de Google para continuar.");
      return;
    }
    setBusy(true);
    setError("");
    const run = ++googleRun.current;
    try {
      const start = await send("/auth/google/start", {});
      popup.location.href = start.url;
      for (let i = 0; i < 100; i++) {
        await new Promise((r) => setTimeout(r, 2500));
        if (run !== googleRun.current) return;
        const result = await send("/auth/google/result", {
          id: start.id,
          poll: start.poll,
        });
        if (!result.pending) {
          popup.close();
          finish(result);
          return;
        }
      }
      throw Error("El acceso expiró. Inténtalo nuevamente.");
    } catch (e) {
      setError((e as Error).message);
      popup.close();
    } finally {
      if (run === googleRun.current) setBusy(false);
    }
  }
  return (
    <main className="auth-page">
      <section className="auth-intro">
        <span className="eyebrow">TU PRÓXIMO CAPÍTULO</span>
        <h1>
          Grandes historias
          <br />
          comienzan con
          <br />
          <em>un lugar.</em>
        </h1>
        <p>
          Guarda tus favoritos, encuentra oportunidades y conecta con quienes
          tienen las llaves.
        </p>
        <img
          src="/architecture.svg"
          alt="Ilustración de arquitectura residencial"
        />
      </section>
      <section className="auth-card">
        <ShieldCheck size={28} />
        <h2>
          {register
            ? "Crea tu cuenta"
            : panel
              ? "Acceso de administración"
              : "Qué bueno verte de nuevo"}
        </h2>
        <p>
          {register
            ? "Comienza como interesado y activa tu perfil de anunciante cuando quieras publicar."
            : "Ingresa con tu correo y contraseña."}
        </p>
        <Notice error={error} />
        {choosing || (user?.role !== "admin" && user?.account_type === null) ? (
          <div className="form-grid">
            <h3>¿Cómo usarás Proppix?</h3>
            <label>
              Tu perfil
              <select
                value={profileKind}
                onChange={(e) => setProfileKind(e.target.value)}
              >
                <option value="person">Particular</option>
                <option value="agent">Agente / corredor independiente</option>
                <option value="company">Empresa / corredora</option>
              </select>
            </label>
            <p>Puedes explorar y guardar favoritos incluso si eliges vender.</p>
            {(["buyer", "seller"] as const).map((kind) => (
              <button
                key={kind}
                className="button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  try {
                    const user = await send("/me/account-type", {
                      account_type: kind,
                      profile_kind: profileKind,
                    });
                    setUser(user);
                    router.replace(
                      kind === "buyer"
                        ? "/descubrir"
                        : "/dashboard/propiedades",
                    );
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {kind === "buyer"
                  ? "Soy comprador · Explorar propiedades"
                  : "Soy vendedor · Primera propiedad gratis"}
              </button>
            ))}
          </div>
        ) : (
          <>
            {!panel && (
              <>
                <button
                  type="button"
                  className="button secondary"
                  disabled={busy || !googleEnabled}
                  onClick={() => void googleLogin()}
                >
                  Continuar con Google
                </button>
                {!googleEnabled && (
                  <small>
                    Google estará disponible pronto. Puedes usar tu correo y
                    contraseña.
                  </small>
                )}
              </>
            )}
            <form
              method="post"
              onSubmit={async (e) => {
                e.preventDefault();
                if (loading || busy) return;
                setBusy(true);
                setError("");
                const b = Object.fromEntries(new FormData(e.currentTarget));
                if (register && b.password !== b.confirmPassword) {
                  setError("Las contraseñas no coinciden.");
                  setBusy(false);
                  return;
                }
                try {
                  const r = await send(
                    register
                      ? "/auth/register"
                      : panel
                        ? "/auth/panel/login"
                        : "/auth/login",
                    b,
                  );
                  finish(r);
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {register && (
                <div className="form-grid">
                  <label>
                    Nombre
                    <input
                      name="firstName"
                      required
                      maxLength={100}
                      autoComplete="given-name"
                    />
                  </label>
                  <label>
                    Apellido
                    <input
                      name="lastName"
                      required
                      maxLength={100}
                      autoComplete="family-name"
                    />
                  </label>
                </div>
              )}
              {register && (
                <>
                  <label>
                    ¿Cómo usarás Proppix?
                    <select
                      name="profile_kind"
                      required
                      value={profileKind}
                      onChange={(e) => setProfileKind(e.target.value)}
                    >
                      <option value="" disabled>
                        Selecciona tu perfil
                      </option>
                      <option value="person">Particular</option>
                      <option value="agent">
                        Agente / corredor independiente
                      </option>
                      <option value="company">Empresa / corredora</option>
                    </select>
                  </label>
                  <label>
                    Nombre público
                    <input
                      name="display_name"
                      required
                      minLength={2}
                      maxLength={100}
                    />
                  </label>
                  <label>
                    @usuario
                    <input
                      name="username"
                      required
                      pattern="[a-zA-Z0-9][a-zA-Z0-9._]{2,29}"
                      maxLength={30}
                    />
                  </label>
                  <small>
                    Todos los perfiles pueden buscar propiedades, seguir cuentas
                    y enviar mensajes. Tu membresía se administra por separado.
                  </small>
                </>
              )}
              <label>
                Correo electrónico
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="tu@correo.cl"
                />
              </label>
              <label>
                Contraseña
                <input
                  name="password"
                  type="password"
                  minLength={register ? 10 : undefined}
                  maxLength={72}
                  autoComplete={register ? "new-password" : "current-password"}
                  required
                />
              </label>
              {register && <small>Usa al menos 10 caracteres.</small>}
              {register && (
                <label>
                  Repite la contraseña
                  <input
                    name="confirmPassword"
                    type="password"
                    minLength={10}
                    maxLength={72}
                    required
                    autoComplete="new-password"
                  />
                </label>
              )}
              <button disabled={busy || loading} className="button">
                {loading
                  ? "Preparando acceso…"
                  : busy
                    ? "Procesando…"
                    : register
                      ? "Crear cuenta"
                      : "Ingresar"}{" "}
                <ArrowUpRight size={18} />
              </button>
            </form>
            <p className="auth-switch">
              {register ? "¿Ya tienes cuenta?" : "¿Primera vez aquí?"}{" "}
              <Link href={register ? "/login" : "/register"}>
                {register ? "Ingresar" : "Crear una cuenta"}
              </Link>
            </p>
          </>
        )}
      </section>
    </main>
  );
}
