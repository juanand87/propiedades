import { useState } from "react";
import { View, Text, TextInput, Pressable } from "react-native";
import { api, Property, Session } from "./api";
export function ContactProperty({
  property,
  session,
}: {
  property: Property;
  session: Session | null;
}) {
  const [message, setMessage] = useState(""),
    [consent, setConsent] = useState(false),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  if (property.is_demo) return null;
  if (!session)
    return (
      <Text style={{ color: "#cadbd3" }}>
        Inicia sesión en Cuenta para enviar una consulta.
      </Text>
    );
  return (
    <View style={{ gap: 12, marginVertical: 18 }}>
      <Text style={{ color: "#fff", fontWeight: "700", fontSize: 18 }}>
        Enviar mensaje al vendedor
      </Text>
      <TextInput
        accessibilityLabel="Mensaje al vendedor"
        placeholder="Me interesa esta propiedad…"
        placeholderTextColor="#aabeb7"
        value={message}
        onChangeText={setMessage}
        multiline
        maxLength={5000}
        style={{
          color: "#fff",
          borderColor: "#638578",
          borderWidth: 1,
          padding: 14,
          borderRadius: 12,
          minHeight: 90,
        }}
      />
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: consent }}
        onPress={() => setConsent(!consent)}
      >
        <Text style={{ color: "#cadbd3" }}>
          {consent ? "☑" : "☐"} Autorizo compartir mi nombre y correo con este
          vendedor para responder mi consulta.
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        disabled={busy || !consent || message.trim().length < 10}
        style={{
          padding: 14,
          backgroundColor:
            consent && message.trim().length >= 10 ? "#d0f5a8" : "#718269",
          borderRadius: 12,
        }}
        onPress={() => {
          setBusy(true);
          setNotice("");
          api("/properties/" + property.id + "/inquiries", {
            method: "POST",
            body: {
              name: session.user.firstName,
              email: session.user.email,
              message,
              consent,
            },
          })
            .then(() => {
              setMessage("");
              setNotice(
                "Mensaje enviado. El vendedor podrá responder al correo de tu cuenta.",
              );
            })
            .catch((e) => setNotice(e.message))
            .finally(() => setBusy(false));
        }}
      >
        <Text style={{ color: "#16342e", fontWeight: "700" }}>
          {busy ? "Enviando…" : "Enviar consulta"}
        </Text>
      </Pressable>
      {!!notice && (
        <Text accessibilityRole="alert" style={{ color: "#cadbd3" }}>
          {notice}
        </Text>
      )}
    </View>
  );
}
