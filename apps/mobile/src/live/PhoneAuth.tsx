import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Text, TextInput } from "react-native";
import { authService } from "./services";
import { authErrorKey } from "./auth-logic";
import { Button, styles as s, colors } from "./ui";
export default function PhoneAuth({
  t,
  onVerified,
  service = authService,
  verification = false,
}: {
  t: (key: string) => string;
  onVerified: () => void;
  service?: Pick<typeof authService, "send" | "verify" | "remaining">;
  verification?: boolean;
}) {
  const [phone, setPhone] = useState("");
  const [sent, setSent] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [remaining, setRemaining] = useState(service.remaining());
  const pending = useRef(false);
  useEffect(() => {
    const id = setInterval(() => setRemaining(service.remaining()), 500);
    return () => clearInterval(id);
  }, [service]);
  async function perform(verify: boolean) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (verify) {
        await service.verify(sent, otp);
        setOtp("");
        onVerified();
      } else {
        const number = await service.send(sent || phone);
        setSent(number);
        setOtp("");
        setNotice("otpSent");
      }
    } catch (e) {
      setError(authErrorKey(e));
      if (verify) setOtp("");
    } finally {
      pending.current = false;
      setBusy(false);
      setRemaining(service.remaining());
    }
  }
  return (
    <>
      <Text style={s.heading}>{t(verification ? "phoneVerification" : "continuePhone")}</Text>
      <Text style={s.label}>{t("phone")}</Text>
      <TextInput
        accessibilityLabel={t("phone")}
        style={s.input}
        value={sent || phone}
        editable={!sent && !busy}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        autoComplete="tel"
        maxLength={40}
        placeholder="+91"
      />
      <Text style={s.body}>{t("phoneHint")}</Text>
      {!!sent && (
        <>
          <Text style={s.label}>{t("otp")}</Text>
          <TextInput
            accessibilityLabel={t("otp")}
            style={s.input}
            value={otp}
            editable={!busy}
            onChangeText={(v) => setOtp(v.replace(/\D/g, "").slice(0, 6))}
            keyboardType="number-pad"
            autoComplete="sms-otp"
            textContentType="oneTimeCode"
            maxLength={6}
          />
          <Button
            title={t("verify")}
            disabled={busy || otp.length !== 6}
            onPress={() => void perform(true)}
          />
          <Button
            title={t("changePhone")}
            secondary
            disabled={busy}
            onPress={() => {
              setSent("");
              setOtp("");
              setError("");
              setNotice("");
            }}
          />
        </>
      )}
      <Button
        title={remaining ? `${t("resend")} · ${remaining}s` : t(sent ? "resend" : "sendOtp")}
        secondary={!verification}
        disabled={busy || remaining > 0}
        onPress={() => void perform(false)}
      />
      {busy && <ActivityIndicator accessibilityLabel={t("wait")} color={colors.accent} />}
      {!!error && (
        <Text accessibilityRole="alert" style={s.body}>
          {t(error)}
        </Text>
      )}
      {!!notice && (
        <Text accessibilityLiveRegion="polite" style={s.body}>
          {t(notice)}
        </Text>
      )}
    </>
  );
}
