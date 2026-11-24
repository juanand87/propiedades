import { brandColors } from "./brand-colors";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
export type ProfileIdentityDraft = {
  profile_kind: "person" | "agent" | "company" | null;
  username: string;
  display_name: string;
};
export const emptyProfileIdentity: ProfileIdentityDraft = {
  profile_kind: null,
  username: "",
  display_name: "",
};
export function identityComplete(value: ProfileIdentityDraft) {
  return (
    !!value.profile_kind &&
    value.display_name.trim().length >= 2 &&
    value.display_name.trim().length <= 100 &&
    /^[a-z0-9][a-z0-9._]{2,29}$/.test(
      value.username.trim().replace(/^@/, "").toLowerCase(),
    )
  );
}
export function ProfileIdentityFields({
  value,
  onChange,
  disabled = false,
}: {
  value: ProfileIdentityDraft;
  onChange: (v: ProfileIdentityDraft) => void;
  disabled?: boolean;
}) {
  return (
    <View style={s.group}>
      <Text style={s.label}>¿Cómo usarás Proppix?</Text>
      <View style={s.row}>
        {(["person", "agent", "company"] as const).map((kind) => (
          <Pressable
            key={kind}
            accessibilityRole="radio"
            accessibilityState={{ checked: value.profile_kind === kind }}
            disabled={disabled}
            onPress={() => onChange({ ...value, profile_kind: kind })}
            style={[s.kind, value.profile_kind === kind && s.selected]}
          >
            <Text
              style={[
                s.kindText,
                value.profile_kind === kind && { color: "#fff" },
              ]}
            >
              {kind === "person"
                ? "Particular"
                : kind === "agent"
                  ? "Agente"
                  : "Empresa"}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text style={s.label}>
        {value.profile_kind === "company"
          ? "Nombre de la empresa"
          : "Nombre visible"}
      </Text>
      <TextInput
        accessibilityLabel={
          value.profile_kind === "company"
            ? "Nombre de la empresa"
            : "Nombre visible del perfil"
        }
        value={value.display_name}
        onChangeText={(display_name) => onChange({ ...value, display_name })}
        maxLength={100}
        editable={!disabled}
        style={s.input}
      />
      <Text style={s.label}>@usuario</Text>
      <TextInput
        accessibilityLabel="Usuario público del perfil"
        placeholder="ejemplo.proppix"
        placeholderTextColor={brandColors.secondary}
        value={value.username}
        onChangeText={(username) => onChange({ ...value, username })}
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={31}
        editable={!disabled}
        style={s.input}
      />
      <Text style={s.help}>
        El nombre y @usuario serán públicos. Usa de 3 a 30 letras sin tildes,
        números, puntos o guiones bajos. Puedes comprar o vender con cualquiera
        de los tres tipos de perfil.
      </Text>
    </View>
  );
}
const s = StyleSheet.create({
  group: { gap: 10, marginVertical: 12 },
  label: { fontWeight: "700", color: brandColors.secondary },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  kind: {
    flexGrow: 1,
    flexBasis: 90,
    minWidth: 90,
    padding: 13,
    borderWidth: 1,
    borderColor: brandColors.secondaryBorder,
    borderRadius: 14,
    alignItems: "center",
    backgroundColor: brandColors.secondarySurface,
  },
  selected: {
    backgroundColor: brandColors.secondary,
    borderColor: brandColors.secondary,
  },
  kindText: {
    color: brandColors.secondary,
    fontWeight: "700",
    textAlign: "center",
  },
  input: {
    borderWidth: 1,
    borderColor: brandColors.secondaryBorder,
    borderRadius: 12,
    padding: 13,
    color: brandColors.secondary,
    backgroundColor: "#fff",
  },
  help: { color: brandColors.secondary, fontSize: 12, lineHeight: 18 },
});
