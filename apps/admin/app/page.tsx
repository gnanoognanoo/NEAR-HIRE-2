import Link from "next/link";
import { configured, requireAdmin } from "./lib/server";
import { logout, moderate } from "./actions";
export const dynamic = "force-dynamic";
const sections: Record<string, string> = {
  overview: "Overview",
  profiles: "Users",
  jobs: "Jobs",
  reports: "Reports",
  payment_orders: "Payments",
  credit_transactions: "Credits",
  admin_actions: "Audit log",
};
const fields: Record<string, string[]> = {
  profiles: ["name", "locality", "city", "suspended", "verified"],
  jobs: ["title", "kind", "locality", "pay", "status"],
  reports: ["reason", "detail", "status", "created_at"],
  payment_orders: ["amount_paise", "credits", "status", "created_at"],
  credit_transactions: ["delta", "reason", "created_at"],
  admin_actions: ["action", "reason", "created_at"],
};
export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  if (!configured())
    return (
      <section>
        <h1>Connect NearHire Admin</h1>
        <p>
          Set the public Supabase URL and key in the server environment. No data is shown until
          authentication and database permissions are verified.
        </p>
        <Link href="/login">Admin sign-in</Link>
      </section>
    );
  const db = await requireAdmin();
  const p = await searchParams;
  const section = p.section && sections[p.section] ? p.section : "overview";
  const offset = Math.max(0, Math.min(100000, Number(p.offset) || 0));
  const { data, error } =
    section === "overview"
      ? await db.rpc("admin_overview")
      : await db.rpc("admin_list", { p_table: section, p_query: p.q || "", p_offset: offset });
  return (
    <>
      <div className="top">
        <h1>{sections[section]}</h1>
        <form action={logout}>
          <button className="secondary">Sign out</button>
        </form>
      </div>
      <nav>
        {Object.entries(sections).map(([k, label]) => (
          <Link aria-current={section === k ? "page" : undefined} key={k} href={`/?section=${k}`}>
            {label}
          </Link>
        ))}
      </nav>
      {p.error && (
        <p role="alert">
          The moderation action failed. Check the selected record and your permissions.
        </p>
      )}
      {error ? (
        <section role="alert">
          <p>We couldn't load this data. Check your connection and database migrations.</p>
          <Link href={`/?section=${section}`}>Try again</Link>
        </section>
      ) : section === "overview" ? (
        <div className="metrics">
          {Object.entries(data || {}).map(([k, v]) => (
            <article key={k}>
              <p>{k.replaceAll("_", " ")}</p>
              <h2>
                {typeof v === "number"
                  ? v.toLocaleString(undefined, { maximumFractionDigits: 2 })
                  : String(v ?? "—")}
              </h2>
            </article>
          ))}
        </div>
      ) : (
        <>
          <form className="search">
            <input type="hidden" name="section" value={section} />
            <label>
              Search
              <input name="q" defaultValue={p.q || ""} maxLength={100} />
            </label>
            <button>Search</button>
          </form>
          <div className="table">
            <table>
              <thead>
                <tr>
                  {fields[section]?.map((f) => (
                    <th key={f}>{f.replaceAll("_", " ")}</th>
                  ))}
                  {["profiles", "jobs", "reports"].includes(section) && <th>Moderation</th>}
                </tr>
              </thead>
              <tbody>
                {(data || []).map((row: any) => (
                  <tr key={row.id || row.user_id}>
                    {fields[section].map((f) => (
                      <td key={f}>
                        {typeof row[f] === "boolean"
                          ? row[f]
                            ? "Yes"
                            : "No"
                          : String(row[f] ?? "—")}
                      </td>
                    ))}
                    {["profiles", "jobs", "reports"].includes(section) && (
                      <td>
                        <form action={moderate}>
                          <input type="hidden" name="target" value={row.id} />
                          <label>
                            Action
                            <select name="action">
                              {(section === "profiles"
                                ? ["suspend_user", "unsuspend_user", "verify_user"]
                                : section === "jobs"
                                  ? ["suspend_job"]
                                  : ["resolve_report", "dismiss_report"]
                              ).map((a) => (
                                <option key={a} value={a}>
                                  {a.replaceAll("_", " ")}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            Reason
                            <input name="reason" required minLength={5} maxLength={1000} />
                          </label>
                          <button>Apply action</button>
                        </form>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {!data?.length && <p>No matching records.</p>}
          </div>
          <div className="top">
            {offset > 0 && (
              <Link
                href={`/?section=${section}&q=${encodeURIComponent(p.q || "")}&offset=${Math.max(0, offset - 30)}`}
              >
                Previous
              </Link>
            )}
            {data?.length === 30 && (
              <Link
                href={`/?section=${section}&q=${encodeURIComponent(p.q || "")}&offset=${offset + 30}`}
              >
                Next
              </Link>
            )}
          </div>
        </>
      )}
    </>
  );
}
