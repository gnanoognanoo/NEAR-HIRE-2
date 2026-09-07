"use server";
import { redirect } from "next/navigation";
import { client } from "../lib/server";
export type MfaState = { error?: string; factorId?: string; qr?: string };
async function member() {
  const db = await client();
  const { data } = await db.auth.getUser();
  if (!data.user) redirect("/login");
  const { data: admin } = await db
    .from("admin_users")
    .select("user_id")
    .eq("user_id", data.user.id)
    .maybeSingle();
  if (!admin) redirect("/login?error=access");
  return db;
}
export async function enroll(_previous: MfaState, _form: FormData): Promise<MfaState> {
  const db = await member();
  const { data: factors } = await db.auth.mfa.listFactors();
  const verified = factors?.totp.find((f) => f.status === "verified");
  if (verified) return { factorId: verified.id };
  for (const factor of factors?.all || []) {
    if (factor.status === "unverified") await db.auth.mfa.unenroll({ factorId: factor.id });
  }
  const { data, error } = await db.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: "NearHire Admin",
  });
  if (error) return { error: "Could not start authenticator setup. Try again." };
  return {
    factorId: data.id,
    qr: `data:image/svg+xml;base64,${Buffer.from(data.totp.qr_code).toString("base64")}`,
  };
}
export async function verify(_previous: MfaState, form: FormData): Promise<MfaState> {
  const db = await member();
  const factorId = String(form.get("factorId") || "");
  const code = String(form.get("code") || "");
  if (!/^\d{6}$/.test(code)) return { factorId, error: "Enter the six-digit authenticator code." };
  const { error } = await db.auth.mfa.challengeAndVerify({ factorId, code });
  if (error) return { factorId, error: "Verification failed. Try a fresh code." };
  redirect("/");
}
