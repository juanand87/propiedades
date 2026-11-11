import { formatClpInput, parseClpInput } from "./clp";
import { videoColors } from "./video-colors";
import { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Image,
  StyleSheet,
  Alert,
  Linking,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { File } from "expo-file-system";
import { api, Page, Property, Session, mediaUrl } from "./api";
type Catalog = {
  types: { id: string; name: string }[];
  regions: { id: number; name: string; cut_code?: string }[];
  communes: {
    id: number;
    region_id: number;
    name: string;
    cut_code?: string;
  }[];
};
type Allowance = { can_create: boolean; used: number; message: string };
const publicationLabels: Record<string, string> = {
  draft: "Borrador",
  pending_review: "En revisión",
  published: "Publicada",
  paused: "Pausada",
  rejected: "Rechazada",
  archived: "Archivada",
};
type Lead = {
  id: string;
  title: string;
  name: string;
  message: string;
  email: string;
  phone: string;
  status: string;
};
export function SellerPanel({
  session,
  onChanged,
  pendingVideoId,
  propertyMode,
  onRecordFirst,
}: {
  session: Session;
  onChanged: () => void;
  pendingVideoId?: string;
  propertyMode?: "new" | "link";
  onRecordFirst?: () => void;
}) {
  const [allowance, setAllowance] = useState<Allowance | null>(null),
    [catalog, setCatalog] = useState<Catalog | null>(null),
    [stats, setStats] = useState<{
      likes: number;
      inquiries: number;
      views: number;
    } | null>(null),
    [leads, setLeads] = useState<Lead[]>([]),
    [editing, setEditing] = useState(
      !!pendingVideoId && propertyMode === "new",
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(""),
    [savedId, setSavedId] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({
      type_id: "house",
      price_unit: "CLP",
    }),
    [photos, setPhotos] = useState<{ id: string; url: string }[]>([]),
    [picker, setPicker] = useState<string | null>(null),
    [search, setSearch] = useState(""),
    [showMessages, setShowMessages] = useState(false);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [list, setList] = useState<Page<Property> | null>(null);
  const token = session.access_token;
  const [linked, setLinked] = useState(false);
  const linkingExisting =
    !!pendingVideoId && propertyMode === "link" && !linked;
  useEffect(() => {
    let live = true;
    Promise.all([
      api<Allowance>("/me/publication-allowance", { token }),
      api<Catalog>("/catalog"),
      api<typeof stats>("/manage/stats", { token }),
    ])
      .then(([a, c, s]) => {
        if (live) {
          setAllowance(a);
          setCatalog(c);
          setStats(s);
        }
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [token]);
  const button = (label: string, fn: () => void) => (
    <Pressable
      accessibilityRole="button"
      disabled={busy}
      onPress={fn}
      style={[s.button, busy && { opacity: 0.5 }]}
    >
      <Text style={s.buttonText}>{label}</Text>
    </Pressable>
  );
  const set = (key: string, value: string) =>
    setForm((v) => ({
      ...v,
      [key]: value,
      ...(key === "price_unit" && value === "CLP"
        ? { price_amount: (v.price_amount || "").split(".")[0] }
        : {}),
      ...(key === "region_id" ? { commune_id: "" } : {}),
    }));
  const clpPrice = (key: string) =>
    key === "price_amount" && form.price_unit === "CLP";
  const field = (key: string, label: string, numeric = false) => (
    <View key={key}>
      <Text style={s.text}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        style={s.input}
        value={clpPrice(key) ? formatClpInput(form[key]) : form[key] || ""}
        onChangeText={(v) => set(key, clpPrice(key) ? parseClpInput(v) : v)}
        keyboardType={
          clpPrice(key) ? "number-pad" : numeric ? "decimal-pad" : "default"
        }
        multiline={key === "description"}
        maxLength={key === "description" ? 30000 : 180}
      />
    </View>
  );
  async function images() {
    setBusy(true);
    setError("");
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: true,
        selectionLimit: 8 - photos.length,
        quality: 0.85,
      });
      if (result.canceled) return;
      for (const asset of result.assets) {
        if ((asset.fileSize || 0) > 8 * 1024 * 1024)
          throw Error("Cada imagen debe pesar menos de 8 MB.");
        const fd = new FormData();
        fd.append(
          "file",
          new File(asset.uri),
          asset.fileName || "propiedad.jpg",
        );
        const m = await api<{ id: string; url: string }>("/manage/media", {
          method: "POST",
          token,
          body: fd,
        });
        setPhotos((p) => [...p, m].slice(0, 8));
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function save(sendForReview = true) {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      let id = savedId;
      if (!id) {
        const p = await api<{ id: string }>("/manage/properties", {
          method: "POST",
          token,
          body: { ...form, media_ids: photos.map((p) => p.id) },
        });
        id = p.id;
        setSavedId(id);
      } else {
        await api("/manage/properties/" + id, {
          method: "PATCH",
          token,
          body: { ...form, media_ids: photos.map((p) => p.id) },
        });
      }
      const current = await api<{ publication_status: string }>(
        "/manage/properties/" + id,
        { token },
      );
      if (sendForReview && current.publication_status !== "pending_review")
        await api("/manage/properties/" + id + "/status", {
          method: "PATCH",
          token,
          body: { status: "pending_review" },
        });
      if (pendingVideoId && !linked) await linkVideo(id);
      setSuccess(
        pendingVideoId
          ? sendForReview
            ? "Video vinculado. La propiedad fue enviada a revisión."
            : "Video vinculado. Los datos de la propiedad quedaron como borrador."
          : sendForReview
            ? "Tu propiedad fue enviada a revisión. Al aprobarla aparecerá en el recorrido."
            : "Borrador guardado. Puedes continuar editándolo desde la app o el panel web.",
      );
      setEditing(false);
      setList(null);
      setAllowance(
        await api<Allowance>("/me/publication-allowance", { token }),
      );
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function linkVideo(id: string) {
    if (!pendingVideoId) return;
    await api(`/manage/videos/${pendingVideoId}/property`, {
      method: "POST",
      token,
      body: { property_id: id },
    });
    setLinked(true);
    onChanged();
  }
  async function linkExistingProperty(id: string) {
    setBusy(true);
    setError("");
    try {
      await linkVideo(id);
      setList(null);
      setSuccess("Video vinculado a la propiedad.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function loadProperties(page: number) {
    setBusy(true);
    setError("");
    try {
      const result = await api<Page<Property>>(
        `/manage/properties?limit=24&page=${page}`,
        { token },
      );
      setList((previous) =>
        page === 1
          ? result
          : { ...result, items: [...(previous?.items ?? []), ...result.items] },
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function editProperty(id: string) {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const property = await api<Property>(`/manage/properties/${id}`, {
        token,
      });
      setSavedId(property.id);
      setForm(
        Object.fromEntries(
          Object.entries(property)
            .filter(
              ([, value]) =>
                typeof value === "string" || typeof value === "number",
            )
            .map(([key, value]) => [key, String(value)]),
        ),
      );
      setPhotos(property.media);
      setPicker(null);
      setEditing(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!session.user.advertiser_id)
    return (
      <View style={s.card}>
        <Text style={s.text}>
          Elige «Soy vendedor» en Cuenta para publicar propiedades gratis.
        </Text>
      </View>
    );
  const options =
    picker === "type_id"
      ? catalog?.types
      : picker === "region_id"
        ? catalog?.regions
        : picker === "commune_id"
          ? catalog?.communes.filter(
              (c) => String(c.region_id) === form.region_id,
            )
          : [
              { id: "CLP", name: "Pesos chilenos" },
              { id: "UF", name: "UF" },
            ];
  return (
    <View style={s.card}>
      <Text style={s.title}>
        {pendingVideoId
          ? propertyMode === "link"
            ? "Vincular video a una propiedad"
            : "Agregar datos de esta propiedad"
          : "Mi espacio de vendedor"}
      </Text>
      {pendingVideoId && !linked && (
        <Text style={s.text}>
          Al vincularlo, el video queda en borrador. Podrás publicarlo cuando la
          propiedad esté publicada.
        </Text>
      )}
      <Text style={s.text}>
        {stats?.likes ?? 0} me gusta · {stats?.inquiries ?? 0} mensajes ·{" "}
        {stats?.views ?? 0} visitas
      </Text>
      {!!error && (
        <Text accessibilityRole="alert" style={s.error}>
          {error}
        </Text>
      )}
      {allowance && <Text style={s.text}>{allowance.message}</Text>}
      {!!success && <Text style={s.text}>{success}</Text>}
      {!editing &&
        !pendingVideoId &&
        button(
          allowance?.can_create
            ? onRecordFirst
              ? "Grabar video para una propiedad"
              : "Crear propiedad gratis"
            : "Límite de propiedades alcanzado",
          () => {
            if (!allowance) return;
            if (!allowance.can_create) {
              Alert.alert("Membresía", allowance.message);
              return;
            }
            if (onRecordFirst) {
              onRecordFirst();
              return;
            }
            setSavedId(null);
            setForm({ type_id: "house", price_unit: "CLP" });
            setPhotos([]);
            setPicker(null);
            setSuccess("");
            setEditing(true);
          },
        )}
      {linkingExisting &&
        button("Elegir propiedad existente", () => void loadProperties(1))}
      {!pendingVideoId &&
        allowance &&
        allowance.used > 0 &&
        !editing &&
        button("Mis propiedades", () => void loadProperties(1))}
      {!editing && list && (
        <>
          {linkingExisting && list.items.length === 0 && (
            <Text style={s.text}>
              Todavía no tienes propiedades para vincular.
            </Text>
          )}
          {list.items.map((p) => (
            <View key={p.id}>
              {button(p.title, () =>
                linkingExisting
                  ? void linkExistingProperty(p.id)
                  : void editProperty(p.id),
              )}
              {p.publication_status && (
                <Text style={s.text}>
                  {publicationLabels[p.publication_status] ||
                    p.publication_status}
                </Text>
              )}
            </View>
          ))}
          {list.page < list.pages &&
            button(
              "Cargar más propiedades",
              () => void loadProperties(list.page + 1),
            )}
        </>
      )}
      {editing && (
        <>
          <Text style={s.text}>
            Completa los datos y fotografías de tu propiedad. Revisaremos la
            publicación antes de mostrarla.
          </Text>
          {field("title", "Título · mínimo 8 caracteres")}
          {field("description", "Descripción · mínimo 40 caracteres")}
          {(["type_id", "region_id", "commune_id", "price_unit"] as const).map(
            (k) => (
              <View key={k}>
                {button(
                  {
                    type_id: "Tipo de propiedad",
                    region_id: "Región",
                    commune_id: "Comuna",
                    price_unit: "Moneda",
                  }[k] +
                    ": " +
                    ((k === "type_id"
                      ? catalog?.types.find((t) => t.id === form[k])?.name
                      : k === "region_id"
                        ? catalog?.regions.find((t) => String(t.id) === form[k])
                            ?.name
                        : k === "commune_id"
                          ? catalog?.communes.find(
                              (t) => String(t.id) === form[k],
                            )?.name
                          : form[k]) ||
                      (k === "commune_id" && !form.region_id
                        ? "Primero selecciona una región"
                        : "Seleccionar")),
                  () => {
                    if (k === "commune_id" && !form.region_id) {
                      Alert.alert(
                        "Selecciona una región",
                        "Las comunas se mostrarán según la región elegida.",
                      );
                      return;
                    }
                    setPicker(k);
                    setSearch("");
                  },
                )}
              </View>
            ),
          )}
          {picker && (
            <View>
              <TextInput
                placeholder="Buscar opción"
                placeholderTextColor={videoColors.muted}
                style={s.input}
                value={search}
                onChangeText={setSearch}
              />
              {options
                ?.filter((o) =>
                  o.name.toLowerCase().includes(search.toLowerCase()),
                )
                .slice(0, 30)
                .map((o) => (
                  <View key={o.id}>
                    {button(o.name, () => {
                      set(picker, String(o.id));
                      setPicker(null);
                    })}
                  </View>
                ))}
              {button("Cerrar opciones", () => setPicker(null))}
            </View>
          )}
          {field("price_amount", "Precio", true)}
          {field("built_area", "Superficie construida (m²)", true)}
          {field("land_area", "Terreno (m²)", true)}
          {field("bedrooms", "Dormitorios", true)}
          {field("bathrooms", "Baños", true)}
          {photos.map((p) => (
            <View key={p.id}>
              <Image
                source={{ uri: mediaUrl(p.url) }}
                style={{ height: 120, borderRadius: 12 }}
              />
              {button("Quitar esta fotografía", () =>
                setPhotos((v) => v.filter((x) => x.id !== p.id)),
              )}
            </View>
          ))}
          {photos.length < 8 &&
            button("Agregar fotografías", () => void images())}
          {button(
            busy ? "Guardando…" : "Guardar borrador",
            () => void save(false),
          )}
          {button(
            busy
              ? "Guardando…"
              : savedId
                ? "Guardar y reenviar a revisión"
                : "Enviar mi propiedad a revisión",
            () => void save(),
          )}
          {button("Cerrar formulario", () => setEditing(false))}
        </>
      )}
      {button(
        showMessages ? "Ocultar mensajes" : "Ver mensajes recibidos",
        () => {
          setShowMessages(!showMessages);
          if (!showMessages && !loadingLeads) {
            setError("");
            setLoadingLeads(true);
            void api<Lead[]>("/manage/inquiries", { token })
              .then(setLeads)
              .catch((e) =>
                Alert.alert("No se pudieron cargar las consultas", e.message),
              )
              .finally(() => setLoadingLeads(false));
          }
        },
      )}
      {showMessages &&
        (loadingLeads ? (
          <Text style={s.text}>Cargando consultas…</Text>
        ) : leads.length ? (
          leads.map((l) => (
            <View key={l.id} style={s.card}>
              <Text style={s.title}>{l.title}</Text>
              <Text style={s.text}>
                {l.name}: {l.message}
              </Text>
              <Text style={s.text}>
                {[l.email, l.phone].filter(Boolean).join(" · ")}
              </Text>
              <Text style={s.text}>Estado: {l.status}</Text>
              {!!l.email &&
                button("Responder por correo", () => {
                  const address = encodeURIComponent(l.email).replace(
                    /%40/g,
                    "@",
                  );
                  const subject = encodeURIComponent(
                    `Consulta Proppix · ${l.title}`,
                  );
                  void Linking.openURL(
                    `mailto:${address}?subject=${subject}`,
                  ).catch(() =>
                    Alert.alert(
                      "Correo no disponible",
                      `Puedes escribir a ${l.email}.`,
                    ),
                  );
                })}
              {button("Marcar como contactado", () => {
                setBusy(true);
                api("/manage/inquiries/" + l.id, {
                  method: "PATCH",
                  token,
                  body: { status: "contacted" },
                })
                  .then(() =>
                    setLeads((v) =>
                      v.map((x) =>
                        x.id === l.id ? { ...x, status: "contacted" } : x,
                      ),
                    ),
                  )
                  .catch((e) => setError(e.message))
                  .finally(() => setBusy(false));
              })}
            </View>
          ))
        ) : (
          <Text style={s.text}>
            Aquí aparecerán las consultas de tus propiedades.
          </Text>
        ))}
    </View>
  );
}
const s = StyleSheet.create({
  card: {
    padding: 14,
    gap: 12,
    backgroundColor: videoColors.surface,
    borderRadius: 18,
    marginVertical: 14,
  },
  title: { fontSize: 20, fontWeight: "700", color: videoColors.text },
  text: { color: videoColors.muted, fontSize: 15, lineHeight: 22 },
  input: {
    borderWidth: 1,
    borderColor: videoColors.muted,
    borderRadius: 12,
    color: "#fff",
    padding: 12,
    marginTop: 6,
  },
  button: {
    padding: 14,
    backgroundColor: videoColors.cyan,
    borderRadius: 12,
    marginVertical: 4,
  },
  buttonText: { color: "#111111", fontWeight: "700" },
  error: { color: "#ffb9a8" },
});
