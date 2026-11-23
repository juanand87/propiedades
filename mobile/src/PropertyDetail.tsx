import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Share,
  Linking,
  useColorScheme,
} from "react-native";
import { useRouter } from "expo-router";
import { Property, Session, price } from "./api";
import { PropertySlideshow } from "./PropertySlideshow";
import { ProppixBrand } from "./ProppixBrand";
import { ProppixIcon, ProppixIconName } from "./ProppixIcon";
import { ContactProperty } from "./ContactProperty";

export function PropertyDetail({
  property: p,
  session,
  saved,
  onFavorite,
  onClose,
  initialContact = false,
}: {
  property: Property;
  session: Session | null;
  saved: boolean;
  onFavorite: () => void;
  onClose: () => void;
  initialContact?: boolean;
}) {
  const dark = useColorScheme() === "dark",
    router = useRouter();
  const [expanded, setExpanded] = useState(false),
    [contact, setContact] = useState(initialContact);
  const text = dark ? "#f4f8ff" : "#071c55",
    muted = dark ? "#b4c7e3" : "#465e80",
    bg = dark ? "#040f2b" : "#fbfcff",
    surface = dark ? "#132544" : "#e8f1ff",
    accent = dark ? "#05c4ed" : "#0866f5";
  const specs: [ProppixIconName, string, string][] = [
    [
      "house",
      "Tipo",
      p.type_id === "apartment"
        ? "Departamento"
        : p.type_id === "land"
          ? "Terreno"
          : p.type_id === "house"
            ? "Casa"
            : "Propiedad",
    ],
    ["bed", "Dormitorios", String(p.bedrooms ?? "—")],
    ["bath", "Baños", String(p.bathrooms ?? "—")],
    ["area", "Sup. construida", p.built_area ? `${p.built_area} m²` : "—"],
    ["land", "Terreno", p.land_area ? `${p.land_area} m²` : "—"],
  ];
  const iconButton = (
    name: ProppixIconName,
    label: string,
    action: () => void,
  ) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={action}
      style={{
        width: 42,
        height: 42,
        borderRadius: 22,
        backgroundColor: bg,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <View
        style={
          name === "arrow" ? { transform: [{ rotate: "180deg" }] } : undefined
        }
      >
        <ProppixIcon name={name} color={text} size={23} />
      </View>
    </Pressable>
  );
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: bg }}
      contentContainerStyle={{ paddingBottom: 30 }}
      keyboardShouldPersistTaps="handled"
    >
      <View
        style={{
          padding: 14,
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
        }}
      >
        {iconButton("arrow", "Volver al recorrido", onClose)}
        <View style={{ flex: 1 }}>
          <ProppixBrand compact light={dark} />
        </View>
        {iconButton("share", "Compartir propiedad", () => {
          void Share.share({
            message: `${p.title} https://propiedades-eta.vercel.app/propiedades/${p.slug}`,
          });
        })}
        {iconButton(
          "heart",
          saved ? "Quitar de favoritos" : "Guardar propiedad",
          onFavorite,
        )}
      </View>
      <PropertySlideshow media={p.media} />
      <View style={{ paddingHorizontal: 20, gap: 12 }}>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <Text
            style={{
              color: text,
              backgroundColor: surface,
              padding: 7,
              borderRadius: 18,
            }}
          >
            ⌖ {p.commune_name || p.region_name}
          </Text>
          <Text
            style={{
              color: accent,
              backgroundColor: surface,
              padding: 7,
              borderRadius: 18,
              fontWeight: "700",
            }}
          >
            {p.operation_type === "rent" ? "En arriendo" : "En venta"}
          </Text>
        </View>
        <View>
          <Text style={{ color: text, fontSize: 27, fontWeight: "800" }}>
            {p.title}
          </Text>
          <Text style={{ color: accent, fontSize: 30, fontWeight: "800" }}>
            {price(p)}
          </Text>
        </View>
        <View
          style={{
            flexDirection: "row",
            borderBottomWidth: 1,
            borderColor: surface,
            paddingVertical: 12,
          }}
        >
          {specs.map(([icon, label, value]) => (
            <View
              key={label}
              style={{
                flex: 1,
                alignItems: "center",
                gap: 5,
                paddingHorizontal: 2,
              }}
            >
              <ProppixIcon name={icon} color={text} size={24} />
              <Text style={{ color: muted, fontSize: 10, textAlign: "center" }}>
                {label}
              </Text>
              <Text
                style={{
                  color: text,
                  fontWeight: "700",
                  fontSize: 12,
                  textAlign: "center",
                }}
              >
                {value}
              </Text>
            </View>
          ))}
        </View>
        <Text
          style={{ color: muted, fontSize: 15, lineHeight: 22 }}
          numberOfLines={expanded ? undefined : 3}
        >
          {p.description}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => setExpanded(!expanded)}
        >
          <Text
            style={{ color: accent, fontWeight: "700", paddingVertical: 5 }}
          >
            {expanded ? "Ver menos ⌃" : "Ver más ⌄"}
          </Text>
        </Pressable>
        {!!p.amenities?.length && expanded && (
          <Text style={{ color: muted }}>
            {p.amenities.map((a) => a.name).join(" · ")}
          </Text>
        )}
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pressable
            disabled={p.is_demo}
            accessibilityRole="button"
            onPress={() =>
              router.push({
                pathname: "/mensajes",
                params: { propertyId: p.id },
              })
            }
            style={{
              flex: 1,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: accent,
              padding: 14,
              alignItems: "center",
              flexDirection: "row",
              justifyContent: "center",
              gap: 8,
              opacity: p.is_demo ? 0.5 : 1,
            }}
          >
            <ProppixIcon name="messages" color={accent} />
            <Text style={{ color: text, fontWeight: "700" }}>Mensaje</Text>
          </Pressable>
          <Pressable
            disabled={p.is_demo}
            accessibilityRole="button"
            onPress={() => setContact(!contact)}
            style={{
              flex: 1,
              borderRadius: 20,
              backgroundColor: accent,
              padding: 14,
              alignItems: "center",
              opacity: p.is_demo ? 0.5 : 1,
            }}
          >
            <Text
              style={{ color: dark ? "#04112f" : "#fff", fontWeight: "800" }}
            >
              Contactar
            </Text>
          </Pressable>
        </View>
        <Text style={{ color: muted, fontWeight: "600" }}>
          {p.advertiser.name}
        </Text>
        {p.is_demo && (
          <Text style={{ color: muted }}>
            Propiedad de ejemplo. No recibe consultas ni visitas.
          </Text>
        )}
        {contact && !p.is_demo && (
          <View
            style={{ padding: 14, backgroundColor: "#fff", borderRadius: 18 }}
          >
            <ContactProperty property={p} session={session} />
            {p.advertiser.phone && (
              <Pressable
                onPress={() =>
                  void Linking.openURL(
                    `tel:${p.advertiser.phone!.replace(/[^\d+]/g, "")}`,
                  )
                }
              >
                <Text style={{ color: "#0866f5", padding: 12 }}>
                  Llamar al anunciante
                </Text>
              </Pressable>
            )}
          </View>
        )}
      </View>
    </ScrollView>
  );
}
