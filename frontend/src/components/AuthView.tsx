"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, ShieldCheck } from "lucide-react";
import { send } from "@/lib/estate-api";
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
  const { setUser } = useEstate(),
    router = useRouter();
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
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            const b = Object.fromEntries(new FormData(e.currentTarget));
            try {
              const r = await send(
                register
                  ? "/auth/register"
                  : panel
                    ? "/auth/panel/login"
                    : "/auth/login",
                b,
              );
              localStorage.setItem("propiedades:token", r.access_token);
              setUser(r.user);
              router.replace(r.user.role === "admin" ? "/panel" : "/dashboard");
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
          {register && (
            <small>
              Al menos 10 caracteres. Tu contraseña se guarda con cifrado
              bcrypt.
            </small>
          )}
          <button disabled={busy} className="button">
            {busy ? "Procesando…" : register ? "Crear cuenta" : "Ingresar"}{" "}
            <ArrowUpRight size={18} />
          </button>
        </form>
        <p className="auth-switch">
          {register ? "¿Ya tienes cuenta?" : "¿Primera vez aquí?"}{" "}
          <Link href={register ? "/login" : "/register"}>
            {register ? "Ingresar" : "Crear una cuenta"}
          </Link>
        </p>
      </section>
    </main>
  );
}
