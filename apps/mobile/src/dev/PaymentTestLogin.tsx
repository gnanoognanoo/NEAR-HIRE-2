import React, { useRef, useState } from "react";
import { Text, TextInput, View } from "react-native";
import { db } from "../live/client";
import { Button, styles as s } from "../live/ui";

// Manual, genuine Supabase sign-in. Never embed test credentials or forge a session.
export default function PaymentTestLogin() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const gate = useRef(false);
  async function signIn() {
    if (!db || gate.current) return;
    gate.current = true;
    setBusy(true);
    setError(false);
    try {
      const result = await db.auth.signInWithPassword({ email: email.trim(), password });
      if (result.error) setError(true);
    } catch {
      setError(true);
    } finally {
      setPassword("");
      gate.current = false;
      setBusy(false);
    }
  }
  if (!__DEV__ || process.env.EXPO_PUBLIC_PAYMENT_TEST_AUTH !== "true") return null;
  return (
    <View style={s.card}>
      <Button title="DEV · Payment test sign-in" secondary disabled={busy} onPress={() => { setOpen(!open); setPassword(""); setError(false); }} />
      {open && <>
        <Text style={s.body}>DEVELOPMENT ONLY. Use the dedicated test account. This signs in to real Supabase; no OTP bypass or fixture credits.</Text>
        <TextInput accessibilityLabel="Test account email" placeholder="Test account email" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" style={s.input} editable={!busy} />
        <TextInput accessibilityLabel="Test account password" placeholder="Test account password" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoCorrect={false} style={s.input} editable={!busy} />
        {error && <Text accessibilityRole="alert" style={s.body}>Test sign-in failed. Check the account credentials and connection.</Text>}
        <Button title={busy ? "Signing in…" : "Sign in to test account"} disabled={busy || !email.trim() || !password} onPress={() => void signIn()} />
      </>}
    </View>
  );
}
