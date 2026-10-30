"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { getImageUrl } from "@/lib/utils";

type ApplicationStatus = "pending" | "approved" | "rejected";

interface VendorApplication {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  rut: string;
  storeName?: string;
  logoUrl?: string;
  city?: string;
  region?: string;
  catalogDescription?: string;
  estimatedProducts?: string;
  mainFormats?: string;
  message?: string;
  status: ApplicationStatus;
  adminNotes?: string;
  createdAt: string;
  reviewedAt?: string;
}

const statusLabel: Record<ApplicationStatus, string> = {
  pending: "Pendiente",
  approved: "Aprobada",
  rejected: "Rechazada",
};

const statusClass: Record<ApplicationStatus, string> = {
  pending: "bg-amber-100 text-amber-800",
  approved: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-100 text-red-800",
};

export default function SolicitudesVendedoresPage() {
  const [applications, setApplications] = useState<VendorApplication[]>([]);
  const [statusFilter, setStatusFilter] = useState<"all" | ApplicationStatus>("pending");
  const [selected, setSelected] = useState<VendorApplication | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    if (statusFilter === "all") return applications;
    return applications.filter((app) => app.status === statusFilter);
  }, [applications, statusFilter]);

  const loadApplications = async () => {
    try {
      setLoading(true);
      const data = await api.getVendorApplications(statusFilter === "all" ? undefined : statusFilter);
      const parsed = Array.isArray(data) ? data : [];
      setApplications(parsed);

      if (selected) {
        const next = parsed.find((app) => app.id === selected.id) || null;
        setSelected(next);
      }
    } catch (error: any) {
      alert(error.message || "No se pudieron cargar las solicitudes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadApplications();
  }, [statusFilter]);

  const handleApprove = async () => {
    if (!selected) return;

    if (!confirm("¿Aprobar esta solicitud y crear la tienda con acceso para el vendedor?")) {
      return;
    }

    try {
      setSaving(true);
      await api.approveVendorApplication(selected.id, adminNotes);
      setAdminNotes("");
      alert("Solicitud aprobada. Se creó la tienda y se enviaron credenciales por correo.");
      await loadApplications();
    } catch (error: any) {
      alert(error.message || "No se pudo aprobar la solicitud");
    } finally {
      setSaving(false);
    }
  };

  const handleReject = async () => {
    if (!selected) return;
    if (!rejectionReason.trim()) {
      alert("Debes indicar el motivo del rechazo.");
      return;
    }

    try {
      setSaving(true);
      await api.rejectVendorApplication(selected.id, rejectionReason.trim());
      setRejectionReason("");
      alert("Solicitud rechazada y notificada al postulante.");
      await loadApplications();
    } catch (error: any) {
      alert(error.message || "No se pudo rechazar la solicitud");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Solicitudes de vendedores</h1>
        <p className="text-gray-600 mt-2">Gestión separada de postulaciones: pendiente, aprobada y rechazada.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["pending", "approved", "rejected", "all"] as const).map((status) => (
          <Button
            key={status}
            variant={statusFilter === status ? "default" : "outline"}
            onClick={() => setStatusFilter(status)}
          >
            {status === "all" ? "Todas" : statusLabel[status]}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Listado</CardTitle>
            <CardDescription>
              {loading ? "Cargando..." : `${filtered.length} solicitudes`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 max-h-[70vh] overflow-auto">
            {filtered.map((app) => (
              <button
                key={app.id}
                className={`w-full text-left border rounded-lg p-4 transition ${selected?.id === app.id ? "border-purple-500 bg-purple-50" : "border-gray-200 hover:border-gray-300"}`}
                onClick={() => {
                  setSelected(app);
                  setAdminNotes(app.adminNotes || "");
                  setRejectionReason("");
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-gray-900">{app.fullName}</p>
                  <Badge className={statusClass[app.status]}>{statusLabel[app.status]}</Badge>
                </div>
                <p className="text-sm text-gray-600 mt-1">{app.email}</p>
                <p className="text-xs text-gray-500 mt-1">{new Date(app.createdAt).toLocaleString("es-CL")}</p>
              </button>
            ))}

            {!loading && filtered.length === 0 && (
              <div className="text-sm text-gray-500 py-6 text-center">No hay solicitudes en este estado.</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Detalle</CardTitle>
            <CardDescription>Revisión y resolución de la solicitud seleccionada.</CardDescription>
          </CardHeader>
          <CardContent>
            {!selected ? (
              <p className="text-sm text-gray-500">Selecciona una solicitud para ver su detalle.</p>
            ) : (
              <div className="space-y-4">
                <div className="text-sm space-y-1">
                  <p><strong>Nombre:</strong> {selected.fullName}</p>
                  <p><strong>Email:</strong> {selected.email}</p>
                  <p><strong>RUT:</strong> {selected.rut}</p>
                  <p><strong>Tienda:</strong> {selected.storeName || "-"}</p>
                  {selected.logoUrl && (
                    <div className="my-3 flex h-24 w-40 items-center justify-center rounded border bg-white p-2">
                      <img src={getImageUrl(selected.logoUrl)} alt={`Logo de ${selected.storeName || selected.fullName}`} className="max-h-full max-w-full object-contain" />
                    </div>
                  )}
                  <p><strong>Región / Ciudad:</strong> {selected.region || "-"} / {selected.city || "-"}</p>
                  <p><strong>Formatos:</strong> {selected.mainFormats || "-"}</p>
                  <p><strong>Productos estimados:</strong> {selected.estimatedProducts || "-"}</p>
                </div>

                {selected.catalogDescription && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Catálogo</p>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{selected.catalogDescription}</p>
                  </div>
                )}

                {selected.message && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Mensaje adicional</p>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{selected.message}</p>
                  </div>
                )}

                {selected.status === "pending" ? (
                  <>
                    <div>
                      <p className="text-sm font-medium mb-1">Notas internas (opcional)</p>
                      <Textarea
                        value={adminNotes}
                        onChange={(e) => setAdminNotes(e.target.value)}
                        placeholder="Notas para el equipo admin"
                      />
                    </div>

                    <div>
                      <p className="text-sm font-medium mb-1">Motivo de rechazo</p>
                      <Textarea
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        placeholder="Explica por qué se rechaza esta solicitud"
                      />
                    </div>

                    <div className="flex gap-2">
                      <Button onClick={handleApprove} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
                        {saving ? "Procesando..." : "Aprobar"}
                      </Button>
                      <Button onClick={handleReject} disabled={saving} variant="destructive">
                        {saving ? "Procesando..." : "Rechazar"}
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
                    <p><strong>Estado:</strong> {statusLabel[selected.status]}</p>
                    <p><strong>Revisado:</strong> {selected.reviewedAt ? new Date(selected.reviewedAt).toLocaleString("es-CL") : "-"}</p>
                    <p><strong>Notas:</strong> {selected.adminNotes || "-"}</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
