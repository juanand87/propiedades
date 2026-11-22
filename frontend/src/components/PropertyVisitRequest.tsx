"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { CalendarDays } from "lucide-react";
import { send } from "@/lib/estate-api";
import { Notice, useEstate } from "./EstateApp";
import styles from "./PropertyVisitRequest.module.css";

export function PropertyVisitRequest({
  propertyId,
  unavailable,
}: {
  propertyId: string;
  unavailable: boolean;
}) {
  const { user } = useEstate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const receipt = useRef<{ payload: string; id: string } | null>(null);
  const sending = useRef(false);
  if (unavailable)
    return (
      <p className="notice">Esta propiedad no admite solicitudes de visita.</p>
    );
  if (!user)
    return (
      <div className="notice">
        <p>
          Inicia sesión para solicitar una visita y seguir su confirmación desde
          tu agenda.
        </p>
        <Link className="button" href="/login">
          Iniciar sesión
        </Link>
      </div>
    );
  if (sent)
    return (
      <div role="status" className="notice">
        <strong>Visita solicitada</strong>
        <p>
          El anunciante debe confirmar el horario o proponerte otro. Puedes
          revisar la respuesta en tu agenda.
        </p>
        <Link className="button" href="/dashboard/visitas">
          Ver mi agenda de visitas
        </Link>
      </div>
    );
  return (
    <form
      className={styles.form}
      onSubmit={async (event) => {
        event.preventDefault();
        if (sending.current) return;
        const form = new FormData(event.currentTarget);
        const fields = {
          property_id: propertyId,
          date: String(form.get("date")),
          time: String(form.get("time")),
          note: String(form.get("note") || ""),
          consent: form.get("consent") === "on",
        };
        const payload = JSON.stringify(fields);
        if (receipt.current?.payload !== payload)
          receipt.current = { payload, id: crypto.randomUUID() };
        sending.current = true;
        setBusy(true);
        setError("");
        try {
          await send("/me/visits", {
            ...fields,
            request_id: receipt.current.id,
          });
          setSent(true);
        } catch (e) {
          setError(
            e instanceof Error
              ? e.message
              : "No se pudo solicitar la visita. Intenta nuevamente.",
          );
        } finally {
          sending.current = false;
          setBusy(false);
        }
      }}
    >
      <p>
        Elige un horario para conocer esta propiedad. La visita dura 30 minutos
        y requiere confirmación del anunciante.
      </p>
      <Notice error={error} />
      <fieldset disabled={busy} className="demo-contact-fields">
        <label>
          Fecha (Chile · Santiago)
          <input name="date" type="date" required />
        </label>
        <label>
          Hora (Chile · Santiago)
          <input name="time" type="time" required />
          <small>
            Entre una hora y 180 días desde ahora. Todos los horarios
            corresponden a Santiago.
          </small>
        </label>
        <label>
          Mensaje opcional
          <textarea
            name="note"
            maxLength={1000}
            placeholder="Cuéntale al anunciante si tienes alguna preferencia para la visita."
          />
        </label>
        <label className="check-label consent">
          <input type="checkbox" name="consent" required />
          Acepto compartir mi nombre y correo con el anunciante para coordinar
          esta visita. <Link href="/privacidad">Privacidad</Link>
        </label>
        <button className="button" disabled={busy}>
          <CalendarDays size={17} />
          {busy ? "Solicitando visita…" : "Solicitar visita"}
        </button>
      </fieldset>
      <Link className="text-link" href="/dashboard/visitas">
        Ver mis visitas
      </Link>
    </form>
  );
}
