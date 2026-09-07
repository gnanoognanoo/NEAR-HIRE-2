import { configured } from "../lib/server";
import { login } from "../actions";
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const p = await searchParams;
  return (
    <section className="login">
      <h1>Welcome back.</h1>
      <p>Sign in with your approved administrator account.</p>
      {!configured() ? (
        <p role="alert">Supabase configuration is required before admin sign-in is available.</p>
      ) : (
        <form action={login}>
          {p.error && (
            <p role="alert">
              {p.error === "access"
                ? "This account does not have administrator access."
                : "Sign-in failed. Check your details and try again."}
            </p>
          )}
          <label>
            Email
            <input type="email" name="email" autoComplete="username" required maxLength={254} />
          </label>
          <label>
            Password
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              required
              maxLength={256}
            />
          </label>
          <button>Sign in</button>
        </form>
      )}
    </section>
  );
}
