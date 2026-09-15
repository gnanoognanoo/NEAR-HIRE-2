import React, { useMemo, useState } from "react";
import { Text, View } from "react-native";
import type { User } from "@supabase/supabase-js";
import { backend } from "./client";
import { createPhoneVerification } from "./auth-operations";
import PhoneAuth from "./PhoneAuth";
import GoogleButton from "./GoogleButton";
import { styles as s } from "./ui";
export default function LoginSecurity({ user, t }: { user: User; t: (key: string) => string }) {
  const phone = useMemo(() => createPhoneVerification(() => backend().auth, user.id), [user.id]);
  const [verified, setVerified] = useState(false);
  const google = user.identities?.some((identity) => identity.provider === "google");
  return (
    <View style={{ gap: 16 }}>
      <Text style={s.heading}>{t("loginSecurity")}</Text>
      <Text style={s.body}>{t("identityAdvice")}</Text>
      <Text style={s.body}>{t(google ? "googleConnected" : "googleNotConnected")}</Text>
      {!google && <GoogleButton t={t} link />}
      <Text style={s.body}>
        {t(user.phone_confirmed_at || verified ? "phoneVerified" : "phoneNotVerified")}
      </Text>
      {!user.phone_confirmed_at && !verified && (
        <PhoneAuth t={t} service={phone} verification onVerified={() => setVerified(true)} />
      )}
    </View>
  );
}
