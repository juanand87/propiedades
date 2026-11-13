import { useRouter } from "expo-router";
import {
  emptySearchFilters,
  SavedSearch,
  searchDescription,
} from "./saved-search-types";
import { ComponentRef, useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { api, mediaUrl, Page, Property, Session } from "./api";
import { ProppixBrand } from "./ProppixBrand";
import { ProppixIcon, ProppixIconName } from "./ProppixIcon";
import { ActivityBell } from "./ActivityBell";
import { formatClpInput, parseClpInput } from "./clp";

const emptyFilters = emptySearchFilters;
const categories: {
  label: string;
  icon: ProppixIconName;
  type?: string;
  operation?: string;
}[] = [
  { label: "Casas", icon: "house", type: "house" },
  { label: "Departamentos", icon: "building", type: "apartment" },
  { label: "Terrenos", icon: "land", type: "land" },
  { label: "Arriendos", icon: "handshake", operation: "rent" },
];

export function PropertyCatalog({
  favorites,
  onFavorite,
  onOpen,
  activityUnread = 0,
  session,
  savedSearchId,
}: {
  favorites: string[];
  session: Session | null;
  savedSearchId?: string;
  activityUnread?: number;
  onFavorite: (id: string) => void;
  onOpen: (property: Property) => void;
}) {
  const router = useRouter();
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [filters, setFilters] = useState(emptyFilters),
    [draft, setDraft] = useState(emptyFilters),
    [search, setSearch] = useState(""),
    [filterOpen, setFilterOpen] = useState(false);
  const [items, setItems] = useState<Property[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [hasMore, setHasMore] = useState(false),
    [loaded, setLoaded] = useState(false);
  const searchInput = useRef<ComponentRef<typeof TextInput>>(null),
    request = useRef<AbortController | null>(null),
    page = useRef(0),
    pages = useRef(1),
    loading = useRef(false);
  const load = useCallback(
    async (reset: boolean) => {
      if (!reset && (loading.current || page.current >= pages.current)) return;
      if (reset) request.current?.abort();
      const controller = new AbortController();
      request.current = controller;
      loading.current = true;
      setBusy(true);
      setError("");
      const query = new URLSearchParams({
        limit: "12",
        page: String(reset ? 1 : page.current + 1),
        sort: "recent",
      });
      Object.entries(filters).forEach(([key, value]) => {
        if (key === "price_unit" && !filters.min_price && !filters.max_price)
          return;
        if (value) query.set(key, value);
      });
      try {
        const data = await api<Page<Property>>(`/properties?${query}`, {
          signal: controller.signal,
        });
        if (request.current !== controller || controller.signal.aborted) return;
        setItems((previous) =>
          reset
            ? data.items
            : [
                ...previous,
                ...data.items.filter(
                  (item) => !previous.some((p) => p.id === item.id),
                ),
              ],
        );
        page.current = data.page;
        pages.current = data.pages;
        setHasMore(data.page < data.pages);
        setLoaded(true);
      } catch (e) {
        if (!controller.signal.aborted && request.current === controller)
          setError(
            e instanceof Error
              ? e.message
              : "No se pudieron cargar las propiedades.",
          );
      } finally {
        if (request.current === controller) {
          loading.current = false;
          setBusy(false);
        }
      }
    },
    [filters],
  );
  useEffect(() => {
    const timer = setTimeout(() => void load(true), 0);
    return () => {
      clearTimeout(timer);
      request.current?.abort();
    };
  }, [load]);
  useEffect(() => {
    if (!savedSearchId || !session) return;
    const controller = new AbortController();
    void api<SavedSearch>(
      "/me/saved-searches/" + encodeURIComponent(savedSearchId),
      { token: session.access_token, signal: controller.signal },
    )
      .then((item) => {
        if (!controller.signal.aborted) {
          setFilters({ ...emptyFilters, ...item.filters });
          setSearch(item.filters.search || "");
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [savedSearchId, session]);
  function beginSave() {
    if (!session) {
      Alert.alert(
        "Inicia sesión",
        "Entra a tu cuenta para guardar búsquedas.",
        [
          { text: "Cancelar" },
          { text: "Iniciar sesión", onPress: () => router.push("/cuenta") },
        ],
      );
      return;
    }
    if (
      ![
        search.trim(),
        filters.type_id,
        filters.operation_type,
        filters.bedrooms,
        filters.min_price,
        filters.max_price,
      ].some(Boolean)
    ) {
      Alert.alert(
        "Elige filtros",
        "Busca una ubicación o selecciona al menos un filtro.",
      );
      return;
    }
    const current = { ...filters, search: search.trim() };
    setFilters(current);
    setSaveName(searchDescription(current).slice(0, 80));
    setSaveError("");
    setSaveOpen(true);
  }
  async function saveSearch() {
    if (saving || !session || !saveName.trim()) return;
    setSaving(true);
    setSaveError("");
    try {
      const saved = await api<SavedSearch>("/me/saved-searches", {
        method: "POST",
        token: session.access_token,
        body: { name: saveName.trim(), filters, enabled: true },
      });
      setSaveOpen(false);
      Alert.alert(
        "Búsqueda guardada",
        saved.enabled
          ? "Te avisaremos cuando se publique una nueva coincidencia."
          : "Esta búsqueda ya existe y sus alertas están pausadas. Puedes activarlas en Mis búsquedas.",
        [
          { text: "Aceptar" },
          { text: "Mis búsquedas", onPress: () => router.push("/busquedas") },
        ],
      );
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  }
  const submitSearch = () =>
    setFilters((previous) => ({ ...previous, search: search.trim() }));
  const activeFilterCount = [
    filters.type_id,
    filters.operation_type,
    filters.bedrooms,
    filters.min_price,
    filters.max_price,
  ].filter(Boolean).length;
  const priceField = (key: "min_price" | "max_price", label: string) => (
    <View style={{ flex: 1 }}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput
        style={s.field}
        accessibilityLabel={label}
        placeholder="Sin límite"
        placeholderTextColor="#677b96"
        keyboardType="decimal-pad"
        maxLength={20}
        value={
          draft.price_unit === "CLP" ? formatClpInput(draft[key]) : draft[key]
        }
        onChangeText={(value) =>
          setDraft((previous) => ({
            ...previous,
            [key]:
              previous.price_unit === "CLP"
                ? parseClpInput(value)
                : value.replace(",", ".").replace(/[^0-9.]/g, ""),
          }))
        }
      />
    </View>
  );
  return (
    <View style={s.root}>
      <Image
        source={require("../assets/los-lagos.jpg")}
        style={[
          StyleSheet.absoluteFill,
          { width: "100%", height: "100%", top: -70 },
        ]}
        resizeMode="cover"
      />
      <LinearGradient
        colors={[
          "rgba(0,35,100,.35)",
          "rgba(0,39,105,.15)",
          "rgba(0,29,72,.8)",
        ]}
        style={StyleSheet.absoluteFill}
      />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.content}
        refreshControl={
          <RefreshControl
            refreshing={busy}
            onRefresh={() => void load(true)}
            tintColor="#fff"
            colors={["#0866f5"]}
          />
        }
      >
        <View style={s.hero}>
          <View style={s.heading}>
            <ProppixBrand />
            <View style={s.topActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Ir a buscar propiedades"
                hitSlop={8}
                style={s.iconButton}
                onPress={() => searchInput.current?.focus()}
              >
                <ProppixIcon name="search" size={27} />
              </Pressable>
              <ActivityBell unread={activityUnread} />
            </View>
          </View>
          <Text style={s.headline}>
            Encuentra el{"\n"}
            <Text style={s.highlight}>hogar</Text> que buscas
          </Text>
          <View style={s.swoosh} />
        </View>
        <View style={s.searchRow}>
          <View style={s.search}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Buscar propiedades"
              onPress={submitSearch}
            >
              <ProppixIcon name="search" color="#08275f" size={24} />
            </Pressable>
            <TextInput
              ref={searchInput}
              style={s.searchInput}
              accessibilityLabel="Buscar por comuna, nombre o código"
              placeholder="Buscar propiedades en Los Lagos…"
              placeholderTextColor="#17335f"
              returnKeyType="search"
              maxLength={100}
              value={search}
              onChangeText={setSearch}
              onSubmitEditing={submitSearch}
            />
            {!!search && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Limpiar búsqueda"
                onPress={() => {
                  setSearch("");
                  setFilters((previous) => ({ ...previous, search: "" }));
                }}
              >
                <ProppixIcon name="close" size={17} color="#17335f" />
              </Pressable>
            )}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Filtros${activeFilterCount ? `, ${activeFilterCount} activos` : ""}`}
            onPress={() => {
              setDraft(filters);
              setFilterOpen(true);
            }}
            style={s.filterButton}
          >
            <ProppixIcon name="filters" color="#08275f" size={27} />
            {activeFilterCount > 0 && (
              <View style={s.badge}>
                <Text style={s.badgeText}>{activeFilterCount}</Text>
              </View>
            )}
          </Pressable>
        </View>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            paddingHorizontal: 12,
            paddingTop: 14,
            gap: 10,
          }}
        >
          <Pressable
            accessibilityRole="button"
            onPress={beginSave}
            style={s.more}
          >
            <ProppixIcon name="bell" color="#0866f5" size={18} />
            <Text style={s.moreText}>Guardar búsqueda</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/busquedas")}
            style={s.more}
          >
            <Text style={s.moreText}>Mis búsquedas</Text>
          </Pressable>
        </View>
        <View style={s.categories}>
          {categories.map((category) => {
            const selected = category.type
              ? filters.type_id === category.type
              : filters.operation_type === category.operation;
            return (
              <Pressable
                key={category.label}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={[s.category, selected && s.categorySelected]}
                onPress={() =>
                  setFilters((previous) =>
                    category.type
                      ? { ...previous, type_id: selected ? "" : category.type! }
                      : {
                          ...previous,
                          operation_type: selected ? "" : category.operation!,
                        },
                  )
                }
              >
                <ProppixIcon name={category.icon} size={30} />
                <Text
                  style={s.categoryLabel}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {category.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {!!error && (
          <View accessibilityRole="alert" style={s.notice}>
            <Text style={s.white}>{error}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => void load(true)}
              style={s.more}
            >
              <Text style={s.moreText}>Reintentar</Text>
            </Pressable>
          </View>
        )}
        {busy && !loaded && (
          <ActivityIndicator style={{ padding: 24 }} color="#fff" />
        )}
        {!busy && !error && loaded && items.length === 0 && (
          <View style={s.notice}>
            <Text style={s.emptyTitle}>Tu próximo hogar está por llegar</Text>
            <Text style={s.white}>
              No encontramos propiedades con estos filtros.
            </Text>
            <Pressable
              accessibilityRole="button"
              style={s.more}
              onPress={() => {
                setSearch("");
                setFilters({ ...emptyFilters });
              }}
            >
              <Text style={s.moreText}>Ver todas las propiedades</Text>
            </Pressable>
          </View>
        )}
        {items.map((property) => (
          <View key={property.id} style={s.card}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Ver ${property.title}`}
              onPress={() => onOpen(property)}
              style={StyleSheet.absoluteFill}
            >
              {property.media[0] ? (
                <Image
                  source={{ uri: mediaUrl(property.media[0].url) }}
                  resizeMode="cover"
                  style={StyleSheet.absoluteFill}
                />
              ) : (
                <View style={s.missingPhoto}>
                  <ProppixIcon name="house" size={56} />
                  <Text style={s.white}>Fotografías próximamente</Text>
                </View>
              )}
              <LinearGradient
                colors={["transparent", "rgba(0,9,19,.1)", "rgba(0,12,18,.94)"]}
                locations={[0, 0.35, 1]}
                style={StyleSheet.absoluteFill}
              />
              <View style={s.operation}>
                <Text style={s.operationText}>
                  {property.operation_type === "rent"
                    ? "En Arriendo"
                    : "En Venta"}
                </Text>
              </View>
              <View style={s.cardCopy}>
                <View style={s.location}>
                  <ProppixIcon name="pin" size={15} />
                  <Text style={s.locationText} numberOfLines={1}>
                    {property.commune_name || property.region_name}
                  </Text>
                  {property.is_demo && <Text style={s.demo}>EJEMPLO</Text>}
                </View>
                <Text style={s.cardTitle} numberOfLines={2}>
                  {property.title}
                </Text>
                <View style={s.cardBottom}>
                  <View style={s.specs}>
                    {property.bedrooms != null && (
                      <View style={s.spec}>
                        <ProppixIcon name="bed" size={19} />
                        <Text style={s.specText}>{property.bedrooms}</Text>
                      </View>
                    )}
                    {property.bathrooms != null && (
                      <View style={s.spec}>
                        <ProppixIcon name="bath" size={19} />
                        <Text style={s.specText}>{property.bathrooms}</Text>
                      </View>
                    )}
                    {(property.built_area || property.land_area) && (
                      <View style={s.spec}>
                        <ProppixIcon name="area" size={18} />
                        <Text style={s.specText}>
                          {Number(
                            property.built_area || property.land_area,
                          ).toLocaleString("es-CL")}{" "}
                          m²
                        </Text>
                      </View>
                    )}
                  </View>
                  <View style={s.more}>
                    <Text style={s.moreText}>Ver más</Text>
                    <ProppixIcon name="arrow" color="#08275f" size={18} />
                  </View>
                </View>
              </View>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                favorites.includes(property.id)
                  ? "Quitar propiedad de favoritos"
                  : "Guardar propiedad en favoritos"
              }
              accessibilityState={{ selected: favorites.includes(property.id) }}
              hitSlop={8}
              style={s.favorite}
              onPress={() => onFavorite(property.id)}
            >
              <ProppixIcon
                name="heart"
                size={28}
                filled={favorites.includes(property.id)}
                color={favorites.includes(property.id) ? "#2bc8f1" : "#fff"}
              />
            </Pressable>
          </View>
        ))}
        {hasMore && (
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            style={[s.more, { alignSelf: "center", marginVertical: 14 }]}
            onPress={() => void load(false)}
          >
            {busy ? (
              <ActivityIndicator color="#0866f5" />
            ) : (
              <Text style={s.moreText}>Ver más propiedades</Text>
            )}
          </Pressable>
        )}
      </ScrollView>
      <Modal
        visible={saveOpen}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!saving) setSaveOpen(false);
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{
            flex: 1,
            justifyContent: "center",
            backgroundColor: "#0008",
            padding: 24,
          }}
        >
          <View
            style={{
              backgroundColor: "#fff",
              padding: 24,
              borderRadius: 22,
              gap: 18,
            }}
          >
            <View style={s.filterHeading}>
              <Text style={s.filterTitle}>Guardar búsqueda</Text>
              <Pressable
                accessibilityLabel="Cerrar"
                disabled={saving}
                onPress={() => setSaveOpen(false)}
              >
                <ProppixIcon name="close" color="#08275f" />
              </Pressable>
            </View>
            <Text style={s.chipText}>{searchDescription(filters)}</Text>
            <TextInput
              autoFocus
              accessibilityLabel="Nombre de la búsqueda"
              style={s.field}
              value={saveName}
              onChangeText={setSaveName}
              maxLength={80}
              placeholder="Ej. Casa en Los Lagos"
              placeholderTextColor="#677b96"
            />
            <Text style={s.chipText}>
              Recibirás avisos de nuevas propiedades que coincidan. Puedes
              pausarlos en Mis búsquedas.
            </Text>
            {!!saveError && (
              <Text accessibilityRole="alert" style={{ color: "#a42c3a" }}>
                {saveError}
              </Text>
            )}
            <Pressable
              disabled={saving || !saveName.trim()}
              onPress={() => void saveSearch()}
              style={s.apply}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={s.applyText}>Guardar y activar alertas</Text>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      <Modal
        visible={filterOpen}
        animationType="slide"
        onRequestClose={() => setFilterOpen(false)}
      >
        <SafeAreaView style={s.filterScreen}>
          <View style={s.filterHeading}>
            <Text style={s.filterTitle}>Encuentra tu propiedad</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cerrar filtros"
              style={s.iconButton}
              onPress={() => setFilterOpen(false)}
            >
              <ProppixIcon name="close" color="#08275f" />
            </Pressable>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: 22, gap: 22 }}
          >
            <Text style={s.fieldLabel}>Operación</Text>
            <View style={s.chips}>
              {[
                ["", "Todas"],
                ["sale", "Venta"],
                ["rent", "Arriendo"],
              ].map(([value, label]) => (
                <Pressable
                  key={label}
                  accessibilityRole="button"
                  accessibilityState={{
                    selected: draft.operation_type === value,
                  }}
                  style={[
                    s.chip,
                    draft.operation_type === value && s.chipSelected,
                  ]}
                  onPress={() =>
                    setDraft((previous) => ({
                      ...previous,
                      operation_type: value,
                    }))
                  }
                >
                  <Text
                    style={[
                      s.chipText,
                      draft.operation_type === value && s.white,
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={s.fieldLabel}>Tipo de propiedad</Text>
            <View style={s.chips}>
              {[
                ["", "Todos"],
                ["house", "Casa"],
                ["apartment", "Departamento"],
                ["land", "Terreno"],
              ].map(([value, label]) => (
                <Pressable
                  key={label}
                  accessibilityRole="button"
                  accessibilityState={{ selected: draft.type_id === value }}
                  style={[s.chip, draft.type_id === value && s.chipSelected]}
                  onPress={() =>
                    setDraft((previous) => ({ ...previous, type_id: value }))
                  }
                >
                  <Text
                    style={[s.chipText, draft.type_id === value && s.white]}
                  >
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <View>
              <Text style={s.fieldLabel}>Dormitorios mínimos</Text>
              <TextInput
                accessibilityLabel="Dormitorios mínimos"
                style={s.field}
                keyboardType="number-pad"
                maxLength={2}
                placeholder="Cualquiera"
                placeholderTextColor="#677b96"
                value={draft.bedrooms}
                onChangeText={(value) =>
                  setDraft((previous) => ({
                    ...previous,
                    bedrooms: value.replace(/\D/g, ""),
                  }))
                }
              />
            </View>
            <View style={s.chips}>
              {["CLP", "UF"].map((unit) => (
                <Pressable
                  key={unit}
                  accessibilityRole="button"
                  accessibilityState={{ selected: draft.price_unit === unit }}
                  style={[s.chip, draft.price_unit === unit && s.chipSelected]}
                  onPress={() =>
                    setDraft((previous) => ({
                      ...previous,
                      price_unit: unit,
                      min_price: "",
                      max_price: "",
                    }))
                  }
                >
                  <Text
                    style={[s.chipText, draft.price_unit === unit && s.white]}
                  >
                    {unit === "CLP" ? "Pesos chilenos" : "UF"}
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={{ flexDirection: "row", gap: 12 }}>
              {priceField("min_price", "Precio mínimo")}
              {priceField("max_price", "Precio máximo")}
            </View>
            <Pressable
              accessibilityRole="button"
              style={s.apply}
              onPress={() => {
                if (
                  [draft.min_price, draft.max_price].some(
                    (value) => value && !/^\d+(\.\d{1,4})?$/.test(value),
                  )
                ) {
                  Alert.alert(
                    "Revisa los precios",
                    "Ingresa un precio válido con hasta cuatro decimales para UF.",
                  );
                  return;
                }
                if (
                  draft.min_price &&
                  draft.max_price &&
                  Number(draft.min_price) > Number(draft.max_price)
                ) {
                  Alert.alert(
                    "Revisa los precios",
                    "El precio máximo debe ser mayor o igual al mínimo.",
                  );
                  return;
                }
                setFilters({ ...draft, search: search.trim() });
                setFilterOpen(false);
              }}
            >
              <Text style={s.applyText}>Ver propiedades</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              style={{ alignItems: "center", padding: 12 }}
              onPress={() =>
                setDraft({ ...emptyFilters, search: filters.search })
              }
            >
              <Text style={s.chipText}>Restablecer filtros</Text>
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#063782" },
  content: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 20 },
  hero: { paddingHorizontal: 12, paddingBottom: 7 },
  heading: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  topActions: { flexDirection: "row", paddingTop: 10, gap: 2 },
  iconButton: {
    padding: 8,
    minWidth: 42,
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  headline: {
    color: "#fff",
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -0.6,
    marginTop: 15,
  },
  highlight: { color: "#30c8ee", fontWeight: "800" },
  swoosh: {
    width: "75%",
    height: 16,
    borderTopWidth: 2,
    borderColor: "#31c8ee",
    borderTopLeftRadius: 160,
    borderTopRightRadius: 160,
    transform: [{ rotate: "1deg" }],
    marginTop: 6,
    marginLeft: 10,
  },
  searchRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    marginHorizontal: 10,
    marginTop: 2,
  },
  search: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f9f9ff",
    borderRadius: 30,
    paddingHorizontal: 15,
    height: 48,
    gap: 8,
  },
  searchInput: { flex: 1, color: "#102b59", fontSize: 12, paddingVertical: 10 },
  filterButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: -3,
    right: -2,
    borderRadius: 9,
    width: 18,
    height: 18,
    backgroundColor: "#0066ff",
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  categories: {
    flexDirection: "row",
    gap: 9,
    marginHorizontal: 10,
    marginVertical: 15,
  },
  category: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ffffff55",
    backgroundColor: "#05387588",
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: "center",
    gap: 5,
  },
  categorySelected: { backgroundColor: "#0866f5", borderColor: "#79d8ff" },
  categoryLabel: { color: "#fff", fontSize: 10, letterSpacing: -0.25 },
  card: {
    width: "100%",
    aspectRatio: 2.12,
    minHeight: 172,
    borderRadius: 21,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#ffffff60",
    marginBottom: 10,
    backgroundColor: "#0a3560",
  },
  missingPhoto: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  operation: {
    position: "absolute",
    top: 12,
    left: 13,
    backgroundColor: "#0566f5",
    paddingHorizontal: 15,
    paddingVertical: 7,
    borderRadius: 20,
  },
  operationText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  favorite: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  cardCopy: { position: "absolute", left: 17, right: 12, bottom: 10 },
  location: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 4,
  },
  locationText: { color: "#fff", fontSize: 11, flexShrink: 1 },
  demo: { color: "#bceaff", fontSize: 8, letterSpacing: 1, marginLeft: 5 },
  cardTitle: {
    color: "#fff",
    fontSize: 19,
    fontWeight: "700",
    letterSpacing: -0.5,
    marginBottom: 6,
    textShadowColor: "#0009",
    textShadowRadius: 4,
  },
  cardBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
  },
  specs: { flexDirection: "row", flexWrap: "wrap", gap: 11, flex: 1 },
  spec: { flexDirection: "row", alignItems: "center", gap: 4 },
  specText: { color: "#fff", fontSize: 11 },
  more: {
    backgroundColor: "#fff",
    borderRadius: 25,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 13,
    paddingVertical: 9,
    gap: 5,
  },
  moreText: { color: "#072455", fontSize: 11, fontWeight: "700" },
  white: { color: "#fff" },
  notice: {
    padding: 20,
    gap: 14,
    backgroundColor: "#002759cc",
    borderRadius: 18,
    marginVertical: 10,
  },
  emptyTitle: { color: "#fff", fontSize: 20, fontWeight: "700" },
  filterScreen: { flex: 1, backgroundColor: "#f4f7fc" },
  filterHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: "#dce5f2",
  },
  filterTitle: {
    color: "#08275f",
    fontSize: 20,
    fontWeight: "700",
    flexShrink: 1,
  },
  fieldLabel: {
    color: "#17335f",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  field: {
    color: "#17335f",
    padding: 13,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#d3deed",
    borderRadius: 12,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#d3deed",
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 22,
  },
  chipSelected: { backgroundColor: "#0866f5", borderColor: "#0866f5" },
  chipText: { color: "#17335f", fontWeight: "600" },
  apply: {
    alignItems: "center",
    padding: 16,
    backgroundColor: "#0866f5",
    borderRadius: 25,
  },
  applyText: { color: "#fff", fontWeight: "700" },
});
