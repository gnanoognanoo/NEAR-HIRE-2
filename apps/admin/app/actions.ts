"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { client, requireAdmin } from "./lib/server";
export async function login(form: FormData) {
  const email = String(form.get("email") || "").trim();
  const password = String(form.get("password") || "");
  if (email.length > 254 || password.length > 256) redirect("/login?error=credentials");
  const db = await client();
  const { error } = await db.auth.signInWithPassword({ email, password });
  if (error) redirect("/login?error=credentials");
  redirect("/");
}
export async function logout() {
  const db = await client();
  await db.auth.signOut();
  redirect("/login");
}
export async function moderate(form: FormData) {
  const db = await requireAdmin();
  const action = String(form.get("action") || "");
  const target = String(form.get("target") || "");
  const reason = String(form.get("reason") || "");
  const { error } = await db.rpc("admin_moderate", {
    p_action: action,
    p_target: target,
    p_reason: reason,
  });
  if (error) redirect("/?error=moderation");
  revalidatePath("/");
}
