"use client";
import { useEffect, useState } from "react";
import { request, send } from "@/lib/estate-api";
import { Notice, useEstate } from "./EstateApp";
export function ProfessionalProfile({
  onSaved,
}: {
  onSaved: (kind: string) => void;
}) {
  const { user } = useEstate();
  const [profile, setProfile] = useState<any>(null),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    request("/video-profiles/" + user.id)
      .then((p) => {
        if (live)
          setProfile({
            profile_kind: p.profile_kind || "person",
            username: p.username || "",
            display_name: p.display_name || user.firstName,
          });
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [user.id, user.firstName]);
  return (
    <section className="panel-card">
      <h2>¿Cómo usas Proppix?</h2>
      <p>
        Tu tipo de perfil es independiente de tu membresía y de los permisos de
        publicación.
      </p>
      <Notice error={error} success={success} />
      {profile && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            setSuccess("");
            try {
              const p = await send("/me/video-profile", profile);
              onSaved(
                p.profile_kind === "company"
                  ? "agency"
                  : p.profile_kind === "agent"
                    ? "broker"
                    : "owner",
              );
              setSuccess("Perfil actualizado en la web y la app.");
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Tipo de perfil
            <select
              value={profile.profile_kind}
              onChange={(e) =>
                setProfile({ ...profile, profile_kind: e.target.value })
              }
            >
              <option value="person">Particular</option>
              <option value="agent">Agente / corredor independiente</option>
              <option value="company">Empresa / corredora</option>
            </select>
          </label>
          <label>
            Nombre público
            <input
              required
              minLength={2}
              maxLength={100}
              value={profile.display_name}
              onChange={(e) =>
                setProfile({ ...profile, display_name: e.target.value })
              }
            />
          </label>
          <label>
            @usuario
            <input
              required
              pattern="[a-zA-Z0-9][a-zA-Z0-9._]{2,29}"
              maxLength={30}
              value={profile.username}
              onChange={(e) =>
                setProfile({ ...profile, username: e.target.value })
              }
            />
          </label>
          <button disabled={busy} className="button">
            {busy ? "Guardando…" : "Guardar tipo de perfil"}
          </button>
        </form>
      )}
    </section>
  );
}
