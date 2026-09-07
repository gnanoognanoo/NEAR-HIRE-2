import { redirect } from "next/navigation";
import { client, configured } from "../lib/server";
import MfaForm from "./form";
export const dynamic = "force-dynamic";
export default async function Mfa() {
  if (!configured()) redirect("/login");
  const db = await client();
  const { data } = await db.auth.getUser();
  if (!data.user) redirect("/login");
  const { data: admin } = await db
    .from("admin_users")
    .select("user_id")
    .eq("user_id", data.user.id)
    .maybeSingle();
  if (!admin) redirect("/login?error=access");
  return (
    <section className="login">
      <h1>Secure your admin account.</h1>
      <p>A second factor is required for NearHire operations.</p>
      <MfaForm />
    </section>
  );
}
