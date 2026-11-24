"use client";
import "./company-team.css";
import { useEffect, useState } from "react";
import Link from "next/link";
import { send } from "@/lib/estate-api";
import { Notice, useEstate } from "./EstateApp";
export function TeamInvitation() {
  const { user, loading } = useEstate();
  const [token, setToken] = useState(""),
    [error, setError] = useState(""),
    [done, setDone] = useState(false),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    const value =
      new URLSearchParams(location.hash.slice(1)).get("token") ||
      sessionStorage.getItem("proppix:team-invite") ||
      "";
    if (/^[a-f0-9]{64}$/.test(value)) {
      setToken(value);
      sessionStorage.setItem("proppix:team-invite", value);
      history.replaceState(null, "", location.pathname);
    } else setError("El enlace de invitación no es válido.");
  }, []);
  return (
    <main className="section company-team">
      <section className="team-card">
        <h1>Invitación a un equipo</h1>
        <Notice error={error} />
        {done ? (
          <>
            <p>
              Ya formas parte del equipo. La empresa puede asignarte
              propiedades.
            </p>
            <Link className="button" href="/dashboard/equipo">
              Ir a Mi equipo
            </Link>
          </>
        ) : loading ? (
          <p>Comprobando tu sesión…</p>
        ) : !user ? (
          <>
            <p>
              Inicia sesión o crea una cuenta con el correo al que se envió la
              invitación.
            </p>
            <div className="team-inline">
              <Link className="button" href="/login">
                Iniciar sesión
              </Link>
              <Link href="/register">Crear cuenta</Link>
            </div>
          </>
        ) : (
          <>
            <p>
              Aceptarás la invitación con <strong>{user.email}</strong>. Tendrás
              acceso únicamente a las propiedades que te asigne la empresa.
            </p>
            <button
              className="button"
              disabled={!token || busy}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  await send("/me/company-team/accept", { token });
                  sessionStorage.removeItem("proppix:team-invite");
                  setToken("");
                  setDone(true);
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Aceptar invitación
            </button>
          </>
        )}
      </section>
    </main>
  );
}
