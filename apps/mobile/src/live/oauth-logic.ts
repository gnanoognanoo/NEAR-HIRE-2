export type PendingOAuth = { redirect: string; userId: string | null; started: number };
type GoogleRequest = {
  provider: "google";
  options: { redirectTo: string; skipBrowserRedirect: boolean; queryParams: { prompt: string } };
};
type GoogleTransport = {
  getUser(): Promise<{ data: { user: { id: string } | null }; error: unknown }>;
  getSession(): Promise<{ data: { session: unknown }; error: unknown }>;
  linkIdentity(input: GoogleRequest): Promise<{ data: { url: string | null } | null; error: unknown }>;
  signInWithOAuth(input: GoogleRequest): Promise<{ data: { url: string | null }; error: unknown }>;
};
export async function beginGoogle(
  auth: GoogleTransport,
  link: boolean,
  redirect: string,
  remember: (p: PendingOAuth) => Promise<void>,
) {
  let userId: string | null = null;
  if (link) {
    const { data, error } = await auth.getUser();
    if (error || !data.user) throw error || new Error("AUTH_REQUIRED");
    userId = data.user.id;
  } else {
    const { data, error } = await auth.getSession();
    if (error) throw error;
    if (data.session) throw new Error("IDENTITY_MISMATCH");
  }
  await remember({ redirect, userId, started: Date.now() });
  const input: GoogleRequest = {
    provider: "google",
    options: {
      redirectTo: redirect,
      skipBrowserRedirect: true,
      queryParams: { prompt: "select_account" },
    },
  };
  const result = link ? await auth.linkIdentity(input) : await auth.signInWithOAuth(input);
  if (result.error) throw result.error;
  if (!result.data?.url) throw new Error("OAUTH_FAILED");
  return result.data.url;
}
export function callbackCode(url: string, pending: PendingOAuth | null, now = Date.now()) {
  if (!pending || now - pending.started > 600_000 || now < pending.started)
    throw new Error("OAUTH_CALLBACK_INVALID");
  const actual = new URL(url),
    expected = new URL(pending.redirect);
  if (
    actual.protocol !== expected.protocol ||
    actual.host !== expected.host ||
    actual.pathname !== expected.pathname
  )
    throw new Error("OAUTH_CALLBACK_INVALID");
  if (actual.searchParams.has("error"))
    throw new Error(
      actual.searchParams.get("error") === "access_denied" ? "OAUTH_CANCELLED" : "OAUTH_FAILED",
    );
  const code = actual.searchParams.get("code");
  if (!code || code.length > 2048 || actual.hash) throw new Error("OAUTH_CALLBACK_INVALID");
  return code;
}
export function assertLinkedUser(expected: string | null, actual: string | undefined) {
  if (!actual || (expected && expected !== actual)) throw new Error("IDENTITY_MISMATCH");
}
