import { ProppixIcon } from "./ProppixIcon";
import {
  missingPropertyData,
  previousPropertyContext,
} from "./property-guidance";
import { PropertyDictation } from "./PropertyDictation";
import {
  mergeDictatedFields,
  mergeDictatedAmenities,
  dictationEnumLabel,
  dictationLabelsFor,
} from "./property-dictation";
import { formatClpInput, parseClpInput } from "./clp";
import { lightColors as videoColors } from "./video-colors";
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
  amenities: { id: string; name: string }[];
  regions: { id: number; name: string; cut_code?: string }[];
  communes: {
    id: number;
    region_id: number;
    name: string;
    cut_code?: string;
  }[];
};
type Allowance = {
  can_create: boolean;
  used: number;
  message: string;
  plan?: string;
};
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
  sourceTitle,
  onReturn,
  owner,
}: {
  session: Session;
  onChanged: () => void;
  pendingVideoId?: string;
  propertyMode?: "new" | "link";
  onRecordFirst?: () => void;
  sourceTitle?: string;
  onReturn?: () => void;
  owner?: {
    display_name: string;
    avatar_url?: string | null;
    avatar_thumbnail_url?: string | null;
  };
}) {
  const [allowance, setAllowance] = useState<Allowance | null>(null),
    [catalog, setCatalog] = useState<Catalog | null>(null),
    [stats, setStats] = useState<{
      likes: number;
      inquiries: number;
      views: number;
      total: number;
      published: number;
      pending: number;
      drafts: number;
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
      title: sourceTitle || "",
      type_id: "house",
      price_unit: "CLP",
    }),
    [photos, setPhotos] = useState<{ id: string; url: string }[]>([]),
    [picker, setPicker] = useState<string | null>(null),
    [search, setSearch] = useState(""),
    [showMessages, setShowMessages] = useState(false);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [list, setList] = useState<Page<Property> | null>(null);
  const [amenityIds, setAmenityIds] = useState<string[]>([]);
  const [dictationOpen, setDictationOpen] = useState(false);
  const [videoDictation, setVideoDictation] = useState(false);
  const [propertyFilter, setPropertyFilter] = useState("all");
  const [sourceHeading, setSourceHeading] = useState(sourceTitle || "");
  const token = session.access_token;
  const focused = !!pendingVideoId;
  const missing = missingPropertyData(form);
  const [linked, setLinked] = useState(false);
  const linkingExisting =
    !!pendingVideoId && propertyMode === "link" && !linked;
  useEffect(() => {
    let live = true;
    Promise.all([
      api<Allowance>("/me/publication-allowance", { token }),
      api<Catalog>("/catalog"),
      focused
        ? Promise.resolve(null)
        : api<typeof stats>("/manage/stats", { token }),
      session.user.advertiser_id
        ? api<Page<Property>>("/manage/properties?limit=24&page=1", { token })
        : Promise.resolve(null),
    ])
      .then(([a, c, s, properties]) => {
        if (live) {
          setAllowance(a);
          setCatalog(c);
          setStats(s);
          setList(properties);
        }
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [token, session.user.advertiser_id, focused]);
  useEffect(() => {
    if (!pendingVideoId || sourceTitle) return;
    const request = new AbortController();
    void api<{ title: string; property_title?: string }>(
      `/videos/${pendingVideoId}/social`,
      { token, signal: request.signal },
    )
      .then((video) => {
        if (!request.signal.aborted) {
          const title = video.property_title || video.title;
          setSourceHeading(title);
          setForm((old) => (old.title ? old : { ...old, title }));
        }
      })
      .catch(() => {});
    return () => request.abort();
  }, [pendingVideoId, sourceTitle, token]);
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
    (key === "price_amount" && form.price_unit === "CLP") ||
    (["common_expenses", "contributions"].includes(key) &&
      (form.expense_unit || "CLP") === "CLP");
  const field = (key: string, label: string, numeric = false) => (
    <View key={key}>
      <Text style={s.text}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        style={s.input}
        value={clpPrice(key) ? formatClpInput(form[key]) : form[key] || ""}
        onChangeText={(v) => set(key, clpPrice(key) ? parseClpInput(v) : v)}
        keyboardType={
          ["latitude", "longitude", "floor_number"].includes(key)
            ? "default"
            : clpPrice(key)
              ? "number-pad"
              : numeric
                ? "decimal-pad"
                : "default"
        }
        multiline={key === "description"}
        maxLength={
          key === "description" ? 30000 : key === "summary" ? 400 : 180
        }
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
          body: {
            ...form,
            show_exact_address:
              form.show_exact_address === "true" ||
              form.show_exact_address === "1",
            amenity_ids: amenityIds,
            media_ids: photos.map((p) => p.id),
          },
        });
        id = p.id;
        setSavedId(id);
      } else {
        await api("/manage/properties/" + id, {
          method: "PATCH",
          token,
          body: {
            ...form,
            show_exact_address: ["true", "1"].includes(
              form.show_exact_address || "",
            ),
            amenity_ids: amenityIds,
            media_ids: photos.map((p) => p.id),
          },
        });
      }
      const current = await api<{ publication_status: string }>(
        "/manage/properties/" + id,
        { token },
      );
      if (
        !sendForReview &&
        ["pending_review", "rejected", "archived"].includes(
          current.publication_status,
        )
      )
        await api("/manage/properties/" + id + "/status", {
          method: "PATCH",
          token,
          body: { status: "draft" },
        });
      // Register the source video before submission, so approval cannot race the link.
      if (pendingVideoId && (sendForReview || !linked))
        await linkVideo(id, sendForReview);
      if (sendForReview && current.publication_status !== "pending_review")
        await api("/manage/properties/" + id + "/status", {
          method: "PATCH",
          token,
          body: { status: "pending_review" },
        });
      setSuccess(
        pendingVideoId
          ? sendForReview
            ? "La propiedad fue enviada a revisión. Al aprobarla, la propiedad y este video se publicarán juntos."
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
  async function linkVideo(id: string, publishWithProperty = false) {
    if (!pendingVideoId) return;
    await api(`/manage/videos/${pendingVideoId}/property`, {
      method: "POST",
      token,
      body: { property_id: id, publish_with_property: publishWithProperty },
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
  async function loadProperties(page: number, status = propertyFilter) {
    setBusy(true);
    setError("");
    try {
      const result = await api<Page<Property>>(
        `/manage/properties?limit=24&page=${page}${status !== "all" ? "&status=" + status : ""}`,
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
      setForm((old) => ({
        ...old,
        address: property.location?.address || "",
        latitude: String(property.location?.latitude ?? ""),
        longitude: String(property.location?.longitude ?? ""),
      }));
      setAmenityIds(property.amenities?.map((a) => a.id) || []);
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
  const enumOptions: Record<string, { id: string; name: string }[]> = {
    condition_type: [
      { id: "unknown", name: "Sin especificar" },
      { id: "new", name: "Nueva" },
      { id: "used", name: "Usada" },
      { id: "renovated", name: "Remodelada" },
      { id: "project", name: "En proyecto" },
    ],
    contributions_period: [
      { id: "monthly", name: "Mensual" },
      { id: "quarterly", name: "Trimestral" },
      { id: "yearly", name: "Anual" },
    ],
    expense_unit: [
      { id: "CLP", name: "Pesos chilenos" },
      { id: "UF", name: "UF" },
    ],
  };
  const options =
    picker && enumOptions[picker]
      ? enumOptions[picker]
      : picker === "operation_type"
        ? [
            { id: "sale", name: "Venta" },
            { id: "rent", name: "Arriendo" },
          ]
        : picker === "type_id"
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
      {focused ? (
        <>
          {onReturn && (
            <Pressable onPress={onReturn} accessibilityRole="button">
              <Text style={s.back}>‹ Volver al video</Text>
            </Pressable>
          )}
          <Text style={s.kicker}>
            {propertyMode === "link"
              ? "ENLAZAR PROPIEDAD"
              : "AGREGAR DATOS DE ESTA PROPIEDAD"}
          </Text>
          <Text style={s.pageTitle}>
            {form.title || sourceHeading || "Tu propiedad"}
          </Text>
          {!success && (
            <Text style={s.text}>
              Completa los datos hablando o usa el audio de este video. Al
              finalizar eliges publicar o guardar como borrador.
            </Text>
          )}
        </>
      ) : !editing ? (
        <>
          <View style={s.ownerRow}>
            {owner?.avatar_thumbnail_url || owner?.avatar_url ? (
              <Image
                fadeDuration={0}
                source={{
                  uri: mediaUrl(
                    owner.avatar_thumbnail_url || owner.avatar_url!,
                  ),
                }}
                style={s.ownerAvatar}
              />
            ) : (
              <View style={s.ownerAvatar}>
                <ProppixIcon name="profile" color="#123b70" size={28} />
              </View>
            )}
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={s.title}>
                ¡Hola, {owner?.display_name || session.user.firstName}!
              </Text>
              <Text style={s.text}>
                Gestiona tus propiedades y publicaciones
              </Text>
            </View>
            {allowance?.plan && (
              <Text style={s.plan}>
                Plan{" "}
                {allowance.plan === "pro"
                  ? "Pro"
                  : allowance.plan === "basic"
                    ? "Básico"
                    : "Gratis"}
              </Text>
            )}
          </View>
          <View style={s.statsRow}>
            {[
              [allowance?.used ?? stats?.total ?? 0, "Propiedades", "house"],
              [stats?.views ?? 0, "Visitas", "eye"],
              [stats?.likes ?? 0, "Me gusta", "heart"],
              [stats?.inquiries ?? 0, "Mensajes", "messages"],
            ].map(([n, label, icon]) => (
              <View key={String(label)} style={s.stat}>
                <ProppixIcon name={icon as "house"} color="#10376b" />
                <Text style={s.statNumber}>{n}</Text>
                <Text style={s.statLabel}>{label}</Text>
              </View>
            ))}
          </View>
          <View style={s.ownerRow}>
            <Text style={[s.pageTitle, { flex: 1 }]}>Mis propiedades</Text>
            <Pressable
              style={s.newButton}
              onPress={() => {
                if (!allowance?.can_create) {
                  Alert.alert(
                    "Límite de propiedades",
                    allowance?.message || "Espera que cargue tu cuenta.",
                  );
                  return;
                }
                setSavedId(null);
                setForm({ type_id: "house", price_unit: "CLP" });
                setPhotos([]);
                setAmenityIds([]);
                setEditing(true);
                setSuccess("");
              }}
            >
              <ProppixIcon name="plus" size={19} />
              <Text style={s.buttonText}>Nueva propiedad</Text>
            </Pressable>
          </View>
          <View style={s.filters}>
            {[
              ["all", "Todas", allowance?.used ?? 0],
              ["published", "Publicadas", stats?.published ?? 0],
              ["draft", "Borradores", stats?.drafts ?? 0],
              ["pending_review", "En revisión", stats?.pending ?? 0],
            ].map(([key, label, n]) => (
              <Pressable
                key={String(key)}
                style={[s.filter, propertyFilter === key && s.activeFilter]}
                onPress={() => {
                  setPropertyFilter(String(key));
                  void loadProperties(1, String(key));
                }}
              >
                <Text
                  style={[
                    s.filterText,
                    propertyFilter === key && { color: "#fff" },
                  ]}
                >
                  {label} ({n})
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : (
        <Text style={s.pageTitle}>{form.title || "Nueva propiedad"}</Text>
      )}
      {!!error && (
        <Text accessibilityRole="alert" style={s.error}>
          {error}
        </Text>
      )}

      {!!success && (
        <View style={s.voiceHero}>
          <ProppixIcon name="check" color="#137338" size={32} />
          <Text style={s.title}>{success}</Text>
          {onReturn && button("Volver al video", onReturn)}
        </View>
      )}
      {linkingExisting &&
        button("Elegir propiedad existente", () => void loadProperties(1))}
      {!editing && !success && list && (
        <>
          {linkingExisting && list.items.length === 0 && (
            <Text style={s.text}>
              Todavía no tienes propiedades para vincular.
            </Text>
          )}
          {list.items.map((p) => (
            <Pressable
              key={p.id}
              style={s.propertyCard}
              onPress={() =>
                linkingExisting
                  ? void linkExistingProperty(p.id)
                  : void editProperty(p.id)
              }
            >
              <View style={s.propertyImage}>
                {p.media[0]?.url ? (
                  <Image
                    fadeDuration={0}
                    source={{ uri: mediaUrl(p.media[0].url) }}
                    style={StyleSheet.absoluteFill}
                  />
                ) : (
                  <ProppixIcon name="house" color="#90acd0" size={38} />
                )}
                {p.media.length > 0 && (
                  <Text style={s.photoCount}>▧ {p.media.length}</Text>
                )}
              </View>
              <View style={{ flex: 1, gap: 7 }}>
                <Text style={s.propertyTitle} numberOfLines={2}>
                  {p.title || "Borrador sin título"}
                </Text>
                <Text style={s.text}>
                  ⌖ {p.commune_name || "Ubicación pendiente"}
                </Text>
                <Text style={s.price}>
                  {p.price_amount
                    ? (p.price_unit === "UF" ? "UF " : "$ ") +
                      Number(p.price_amount).toLocaleString("es-CL", {
                        maximumFractionDigits: p.price_unit === "UF" ? 4 : 0,
                      })
                    : "Precio pendiente"}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end", gap: 12 }}>
                <Text
                  style={[
                    s.status,
                    {
                      backgroundColor:
                        p.publication_status === "published"
                          ? "#e1f7e7"
                          : p.publication_status === "pending_review"
                            ? "#fff0d3"
                            : "#e6f3ff",
                      color:
                        p.publication_status === "published"
                          ? "#137338"
                          : p.publication_status === "pending_review"
                            ? "#b66a08"
                            : "#0755ad",
                    },
                  ]}
                >
                  {publicationLabels[p.publication_status || "draft"]}
                </Text>
                <View style={s.ownerRow}>
                  <ProppixIcon name="eye" size={17} color="#315a87" />
                  <Text style={s.statLabel}>{p.view_count ?? 0}</Text>
                  <ProppixIcon name="heart" size={17} color="#315a87" />
                  <Text style={s.statLabel}>{p.favorite_count ?? 0}</Text>
                  <Pressable
                    accessibilityLabel={"Opciones de " + p.title}
                    hitSlop={8}
                    onPress={(e) => {
                      e.stopPropagation();
                      Alert.alert(p.title, undefined, [
                        {
                          text: linkingExisting
                            ? "Enlazar propiedad"
                            : "Editar datos",
                          onPress: () =>
                            linkingExisting
                              ? void linkExistingProperty(p.id)
                              : void editProperty(p.id),
                        },
                        { text: "Cancelar", style: "cancel" },
                      ]);
                    }}
                  >
                    <ProppixIcon name="more" color="#123b70" size={21} />
                  </Pressable>
                </View>
              </View>
            </Pressable>
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
          <View style={s.voiceHero}>
            <View style={s.ownerRow}>
              <View style={s.micBadge}>
                <ProppixIcon name="microphone" size={28} />
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={s.heroTitle}>Tu propiedad, con tu voz</Text>
                <Text style={s.text}>
                  Cuéntanos sus características. Proppix completa el formulario
                  para que lo revises.
                </Text>
              </View>
            </View>
            <Pressable
              style={s.voicePrimary}
              onPress={() => {
                if (!catalog) return;
                setVideoDictation(false);
                setDictationOpen(true);
              }}
            >
              <ProppixIcon name="microphone" />
              <Text style={s.buttonText}>
                {form.description ? "Completar por voz" : "Dictar mi propiedad"}
              </Text>
            </Pressable>
            <Pressable
              style={s.voiceSecondary}
              onPress={() => {
                if (!catalog) return;
                setVideoDictation(true);
                setDictationOpen(true);
              }}
            >
              <ProppixIcon name="video" color="#0755ad" />
              <Text style={s.voiceSecondaryText}>Usar audio del video</Text>
            </Pressable>
            <Text style={s.voiceHint}>
              {missing.length
                ? "Puedes completar: " + missing.join(", ") + "."
                : "Los datos principales están completos. Revisa todo antes de guardar."}
            </Text>
          </View>
          {field("title", "Título · mínimo 8 caracteres")}
          {field("summary", "Resumen")}
          {field("description", "Descripción · mínimo 40 caracteres")}
          {(
            [
              "type_id",
              "operation_type",
              "region_id",
              "commune_id",
              "price_unit",
              "condition_type",
              "expense_unit",
              "contributions_period",
            ] as const
          ).map((k) => (
            <View key={k}>
              {button(
                {
                  type_id: "Tipo de propiedad",
                  operation_type: "Operación",
                  region_id: "Región",
                  commune_id: "Comuna",
                  price_unit: "Moneda",
                  condition_type: "Estado",
                  expense_unit: "Moneda de gastos",
                  contributions_period: "Periodicidad de contribuciones",
                }[k] +
                  ": " +
                  ((k === "operation_type"
                    ? form.operation_type === "rent"
                      ? "Arriendo"
                      : "Venta"
                    : k === "type_id"
                      ? catalog?.types.find((t) => t.id === form[k])?.name
                      : k === "region_id"
                        ? catalog?.regions.find((t) => String(t.id) === form[k])
                            ?.name
                        : k === "commune_id"
                          ? catalog?.communes.find(
                              (t) => String(t.id) === form[k],
                            )?.name
                          : dictationEnumLabel(k, form[k] || "")) ||
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
          ))}
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
          {field("usable_area", "Superficie útil (m²)", true)}
          {field("land_area", "Terreno (m²)", true)}
          {field("neighborhood", "Sector o barrio")}
          {field(
            "address",
            "Dirección · no se muestra públicamente por defecto",
          )}
          {field("bedrooms", "Dormitorios", true)}
          {field("bathrooms", "Baños", true)}
          {field("parking", "Estacionamientos", true)}
          {field("storage_rooms", "Bodegas", true)}
          {field("construction_year", "Año de construcción", true)}
          {field("floors", "Pisos de la propiedad", true)}
          {form.type_id === "apartment" &&
            field("floor_number", "Piso de la unidad", true)}
          {field("common_expenses", "Gastos comunes mensuales", true)}
          {field("contributions", "Contribuciones", true)}
          {field("latitude", "Latitud privada", true)}
          {field("longitude", "Longitud privada", true)}
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{
              checked: ["true", "1"].includes(form.show_exact_address || ""),
            }}
            onPress={() =>
              set(
                "show_exact_address",
                ["true", "1"].includes(form.show_exact_address || "")
                  ? "false"
                  : "true",
              )
            }
            style={s.input}
          >
            <Text style={s.text}>
              {["true", "1"].includes(form.show_exact_address || "")
                ? "☑"
                : "☐"}{" "}
              Mostrar dirección y coordenadas exactas públicamente
            </Text>
          </Pressable>
          <Text style={s.text}>Características</Text>
          {catalog?.amenities.map((a) => (
            <Pressable
              key={a.id}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: amenityIds.includes(a.id) }}
              onPress={() =>
                setAmenityIds((old) =>
                  old.includes(a.id)
                    ? old.filter((id) => id !== a.id)
                    : [...old, a.id],
                )
              }
              style={s.input}
            >
              <Text style={s.text}>
                {amenityIds.includes(a.id) ? "☑" : "☐"} {a.name}
              </Text>
            </Pressable>
          ))}
          {photos.length === 0 && (
            <Text style={s.text}>
              Para publicar, agrega al menos una fotografía de la propiedad.
            </Text>
          )}
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
            busy ? "Guardando…" : "Publicar propiedad",
            () => void save(),
          )}
          <Text style={s.text}>
            Publicar envía los datos a revisión antes de mostrarlos. Guardar
            borrador te permite completarlos después.
          </Text>
          {button(focused ? "Volver al video" : "Cerrar formulario", () =>
            focused && onReturn ? onReturn() : setEditing(false),
          )}
        </>
      )}
      {dictationOpen && (
        <PropertyDictation
          initialVideoId={pendingVideoId}
          sourceVideoTitle={sourceHeading || form.title}
          initialContext={previousPropertyContext(
            form,
            dictationLabelsFor(catalog?.amenities || []),
            (key, value) =>
              key === "region_id"
                ? catalog?.regions.find((r) => String(r.id) === value)?.name ||
                  value
                : key === "commune_id"
                  ? catalog?.communes.find((c) => String(c.id) === value)
                      ?.name || value
                  : key === "type_id"
                    ? catalog?.types.find((t) => t.id === value)?.name || value
                    : value,
          )}
          videoMode={videoDictation}
          token={token}
          current={{
            ...form,
            ...Object.fromEntries(
              (catalog?.amenities || []).map((a) => [
                "amenity:" + a.id,
                String(amenityIds.includes(a.id)),
              ]),
            ),
          }}
          amenities={catalog?.amenities || []}
          display={(key, value) =>
            key === "type_id"
              ? catalog?.types.find((t) => t.id === value)?.name || value
              : key === "region_id"
                ? catalog?.regions.find((r) => String(r.id) === value)?.name ||
                  value
                : key === "commune_id"
                  ? catalog?.communes.find((c) => String(c.id) === value)
                      ?.name || value
                  : key === "operation_type"
                    ? value === "rent"
                      ? "Arriendo"
                      : "Venta"
                    : value
          }
          onApply={(fields, selected) => {
            setForm((old) => mergeDictatedFields(old, fields, selected));
            setAmenityIds((old) =>
              mergeDictatedAmenities(
                old,
                fields,
                selected,
                catalog?.amenities || [],
              ),
            );
            setSuccess(
              "Datos aplicados. Revísalos en el formulario antes de guardar.",
            );
          }}
          onClose={() => setDictationOpen(false)}
        />
      )}
      {!focused &&
        !editing &&
        button(
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
      {!focused &&
        !editing &&
        showMessages &&
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
  ownerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  ownerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#e6f3ff",
    alignItems: "center",
    justifyContent: "center",
  },
  plan: {
    backgroundColor: "#e2f1ff",
    color: "#0755ad",
    padding: 6,
    borderRadius: 15,
    fontSize: 11,
    fontWeight: "700",
  },
  statsRow: {
    flexDirection: "row",
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#c9def4",
    backgroundColor: "#f4f9ff",
  },
  stat: { flex: 1, alignItems: "center", gap: 5 },
  statNumber: { fontSize: 24, fontWeight: "800", color: "#10376b" },
  statLabel: { fontSize: 11, color: "#315a87" },
  pageTitle: { fontSize: 26, fontWeight: "800", color: "#10376b" },
  kicker: {
    fontSize: 11,
    letterSpacing: 1.5,
    color: "#0866f5",
    fontWeight: "800",
  },
  back: {
    color: "#0755ad",
    fontWeight: "700",
    fontSize: 15,
    paddingVertical: 8,
  },
  newButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#0866f5",
    borderRadius: 14,
    padding: 12,
  },
  filters: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  filter: {
    backgroundColor: "#edf6ff",
    borderWidth: 1,
    borderColor: "#d5e6fa",
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 14,
  },
  activeFilter: { backgroundColor: "#0755ad" },
  filterText: { fontSize: 11, fontWeight: "600", color: "#123b70" },
  propertyCard: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    padding: 8,
    borderWidth: 1,
    borderColor: "#d5e6fa",
    borderRadius: 16,
    backgroundColor: "#fff",
    marginBottom: 9,
  },
  propertyImage: {
    width: 86,
    height: 90,
    borderRadius: 11,
    overflow: "hidden",
    backgroundColor: "#edf6ff",
    alignItems: "center",
    justifyContent: "center",
  },
  photoCount: {
    position: "absolute",
    bottom: 5,
    right: 5,
    color: "#fff",
    backgroundColor: "#062951bb",
    padding: 3,
    borderRadius: 5,
    fontSize: 10,
  },
  propertyTitle: { color: "#10376b", fontWeight: "800", fontSize: 15 },
  price: { color: "#0866f5", fontWeight: "800", fontSize: 17 },
  status: { fontSize: 10, fontWeight: "700", padding: 6, borderRadius: 7 },
  voiceHero: {
    padding: 18,
    gap: 14,
    backgroundColor: "#eff7ff",
    borderWidth: 1,
    borderColor: "#bddaff",
    borderRadius: 20,
  },
  micBadge: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0866f5",
  },
  heroTitle: { color: "#10376b", fontSize: 20, fontWeight: "800" },
  voicePrimary: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0866f5",
    padding: 16,
    borderRadius: 14,
  },
  voiceSecondary: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#a5c5eb",
    padding: 14,
    borderRadius: 14,
  },
  voiceSecondaryText: { fontWeight: "800", color: "#0755ad" },
  voiceHint: { color: "#315a87", fontSize: 12, lineHeight: 19 },
  card: {
    padding: 14,
    gap: 12,
    backgroundColor: videoColors.background,
    borderWidth: 1,
    borderColor: videoColors.border,
    borderRadius: 18,
    marginVertical: 14,
  },
  title: { fontSize: 20, fontWeight: "700", color: videoColors.text },
  text: { color: videoColors.muted, fontSize: 15, lineHeight: 22 },
  input: {
    borderWidth: 1,
    borderColor: videoColors.muted,
    borderRadius: 12,
    color: videoColors.text,
    padding: 12,
    marginTop: 6,
  },
  button: {
    padding: 14,
    backgroundColor: videoColors.cyan,
    borderRadius: 12,
    marginVertical: 4,
  },
  buttonText: { color: "#fff", fontWeight: "700" },
  error: { color: "#a12b36" },
});
