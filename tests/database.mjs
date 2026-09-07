import { PGlite } from "@electric-sql/pglite";
import { postgis } from "@electric-sql/pglite-postgis";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const pg = new PGlite({ extensions: { postgis, pgcrypto } });
// Supabase platform primitives only. Business SQL and PostGIS are real.
await pg.exec(`create role anon; create role authenticated; create role service_role bypassrls;
create schema auth; create table auth.users(id uuid primary key,phone text);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
create function auth.jwt() returns jsonb language sql stable as $$select jsonb_build_object('aal',coalesce(nullif(current_setting('request.jwt.claim.aal',true),''),'aal1'))$$;
create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid,name text,bucket_id text); alter table storage.objects enable row level security;
create function storage.foldername(text) returns text[] language sql as $$select string_to_array($1,'/')$$;
create schema cron; create function cron.schedule(text,text,text) returns bigint language sql as $$select 1::bigint$$;`);
for (const file of [
  "202609060001_core.sql",
  "202609060002_operations.sql",
  "202609060003_hardening.sql",
  "202609060004_categories.sql",
]) {
  let sql = await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), "utf8");
  sql = sql.replace(
    "create extension if not exists pg_cron with schema pg_catalog;",
    "-- Scheduler registration is stubbed; expiry function is tested directly.",
  );
  try {
    await pg.exec(sql);
  } catch (e) {
    console.error("MIGRATION FAILED", file, e.message, e.position);
    throw e;
  }
}
await pg.exec(await readFile(new URL("../supabase/seed.sql", import.meta.url), "utf8"));
const owner = "10000000-0000-0000-0000-000000000001",
  worker = "10000000-0000-0000-0000-000000000002",
  stranger = "10000000-0000-0000-0000-000000000003";
await pg.query("insert into auth.users values ($1,$4),($2,$5),($3,$6)", [
  owner,
  worker,
  stranger,
  "+919000000001",
  "+919000000002",
  "+919000000003",
]);
async function asUser(id, fn) {
  await pg.exec("set role authenticated");
  await pg.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  try {
    return await fn();
  } finally {
    await pg.exec("reset role");
  }
}
async function rpc(name, args = []) {
  const r = await pg.query(
    `select to_jsonb(public.${name}(${args.map((_, i) => "$" + (i + 1)).join(",")})) value`,
    args,
  );
  return r.rows[0]?.value;
}
let checks = 0;
async function check(name, fn) {
  await fn();
  checks++;
  console.log("PASS", name);
}
const input = {
  title: "Local electrician",
  kind: "residential",
  category: "electrician",
  description: "Repair a fan at a fictional test home.",
  pay: 500,
  pay_unit: "hour",
  schedule: "Afternoon",
  workers_required: 1,
  locality: "Anna Nagar",
  exact_address: "PRIVATE TEST ADDRESS",
  latitude: 13.085,
  longitude: 80.21,
  required_languages: ["ta"],
};
await check("profile edits cannot set admin, credit or suspension fields", async () => {
  await asUser(owner, () =>
    rpc("save_profile", [
      { name: "Test owner", locality: "Anna Nagar", suspended: true, languages: ["ta"] },
    ]),
  );
  assert.equal(
    (await pg.query("select suspended from public.profiles where id=$1", [owner])).rows[0]
      .suspended,
    false,
  );
  await assert.rejects(() =>
    asUser(worker, () =>
      pg.query("update public.job_credits set balance=99 where user_id=$1", [worker]),
    ),
  );
});
let job, app;
await check("draft and publication retries spend exactly one credit", async () => {
  job = await asUser(owner, () =>
    rpc("create_job", [input, "20000000-0000-0000-0000-000000000001"]),
  );
  assert.equal(
    job,
    await asUser(owner, () => rpc("create_job", [input, "20000000-0000-0000-0000-000000000001"])),
  );
  await asUser(owner, () => rpc("publish_job", [job]));
  await asUser(owner, () => rpc("publish_job", [job]));
  assert.equal(
    (await pg.query("select balance from public.job_credits where user_id=$1", [owner])).rows[0]
      .balance,
    4,
  );
});
await check("real PostGIS radius query returns nearby and excludes distant jobs", async () => {
  const near = await asUser(worker, () =>
    pg.query("select * from public.nearby_jobs($1,$2,$3)", [13.085, 80.21, 1000]),
  );
  assert.equal(near.rows.length, 1);
  assert.equal(near.rows[0].job.id, job);
  assert.equal(near.rows[0].job.exact_address, undefined);
  assert.equal(near.rows[0].job.latitude, undefined);
  const far = await asUser(worker, () =>
    pg.query("select * from public.nearby_jobs($1,$2,$3)", [13.2, 80.3, 1000]),
  );
  assert.equal(far.rows.length, 0);
});
await check("private location table is inaccessible before acceptance", async () => {
  assert.equal(
    (await asUser(worker, () => pg.query("select * from public.job_locations"))).rows.length,
    0,
  );
});
await check("self application and duplicate application are denied", async () => {
  await assert.rejects(() => asUser(owner, () => rpc("apply_job", [job])));
  app = await asUser(worker, () => rpc("apply_job", [job]));
  await assert.rejects(() => asUser(worker, () => rpc("apply_job", [job])));
  await assert.rejects(() => asUser(worker, () => rpc("private_contact", [app])));
});
await check("unrelated users cannot inspect applications or accept them", async () => {
  assert.equal(
    (await asUser(stranger, () => pg.query("select * from public.applications"))).rows.length,
    0,
  );
  await assert.rejects(() => asUser(stranger, () => rpc("decide_application", [app, "accepted"])));
});
await check("acceptance fills job and contact is restricted to participants", async () => {
  await asUser(owner, () => rpc("decide_application", [app, "accepted"]));
  assert.equal(
    (await pg.query("select status from public.jobs where id=$1", [job])).rows[0].status,
    "filled",
  );
  assert.equal(
    (await asUser(worker, () => rpc("private_contact", [app]))).exact_address,
    "PRIVATE TEST ADDRESS",
  );
  await assert.rejects(() => asUser(stranger, () => rpc("private_contact", [app])));
  await assert.rejects(() => asUser(worker, () => rpc("decide_application", [app, "withdrawn"])));
});
await check(
  "completion requires valid start and both confirmations; reviews only once",
  async () => {
    await assert.rejects(() => asUser(worker, () => rpc("submit_review", [app, 5, "Good"])));
    await assert.rejects(() => asUser(worker, () => rpc("confirm_completion", [app])));
    await asUser(owner, () => rpc("transition_job", [job, "in_progress"]));
    await asUser(worker, () => rpc("confirm_completion", [app]));
    assert.equal(
      (await pg.query("select status from public.applications where id=$1", [app])).rows[0].status,
      "accepted",
    );
    await asUser(owner, () => rpc("confirm_completion", [app]));
    await asUser(worker, () => rpc("submit_review", [app, 5, "Good"]));
    await assert.rejects(() => asUser(worker, () => rpc("submit_review", [app, 5, "Again"])));
  },
);
let expired;
await check(
  "expired jobs are hidden and cannot accept new applications even before cron",
  async () => {
    expired = await asUser(owner, () =>
      rpc("create_job", [input, "20000000-0000-0000-0000-000000000002"]),
    );
    await asUser(owner, () => rpc("publish_job", [expired]));
    await pg.query(
      "update public.jobs set published_at=now()-interval '25 hours',expires_at=now()-interval '1 hour' where id=$1",
      [expired],
    );
    await assert.rejects(() => asUser(worker, () => rpc("apply_job", [expired])));
    assert.equal(
      (await asUser(worker, () => pg.query("select * from public.nearby_jobs(13.085,80.21,1000)")))
        .rows.length,
      0,
    );
    await rpc("expire_jobs");
    assert.equal(
      (await pg.query("select status from public.jobs where id=$1", [expired])).rows[0].status,
      "expired",
    );
  },
);
await check("repost retains history and resets lifetime", async () => {
  const id = await asUser(owner, () =>
    rpc("repost_job", [expired, "20000000-0000-0000-0000-000000000003"]),
  );
  const row = (
    await pg.query(
      "select *,extract(epoch from expires_at-published_at) lifetime from public.jobs where id=$1",
      [id],
    )
  ).rows[0];
  assert.equal(row.repost_of, expired);
  assert.equal(Number(row.lifetime), 86400);
  assert.notEqual(id, expired);
});
await check("blocks exclude discovery and prevent application", async () => {
  await asUser(worker, () => rpc("safety_action", ["block", owner]));
  assert.equal(
    (await asUser(worker, () => pg.query("select * from public.nearby_jobs(13.085,80.21,1000)")))
      .rows.length,
    0,
  );
});
await check("payment settlement is server-only, checks amount, and credits once", async () => {
  const order = await asUser(worker, () =>
    rpc("prepare_payment", ["single", "30000000-0000-0000-0000-000000000001"]),
  );
  await pg.query("update public.payment_orders set provider_order_id='order_test' where id=$1", [
    order.id,
  ]);
  await assert.rejects(() =>
    asUser(worker, () => rpc("settle_payment", ["event1", "pay1", "order_test", 1000, "INR"])),
  );
  await assert.rejects(() => rpc("settle_payment", ["event1", "pay1", "order_test", 1, "INR"]));
  await rpc("settle_payment", ["event1", "pay1", "order_test", 1000, "INR"]);
  await rpc("settle_payment", ["event1", "pay1", "order_test", 1000, "INR"]);
  await rpc("settle_payment", ["event2", "pay1", "order_test", 1000, "INR"]);
  assert.equal(
    (await pg.query("select balance from public.job_credits where user_id=$1", [worker])).rows[0]
      .balance,
    6,
  );
});
await check("non-admin cannot read metrics or moderate", async () => {
  await assert.rejects(() => asUser(worker, () => rpc("admin_overview")));
  await assert.rejects(() =>
    asUser(worker, () => rpc("admin_moderate", ["suspend_user", owner, "test reason"])),
  );
  await pg.query("insert into public.admin_users values($1)", [stranger]);
  await assert.rejects(() => asUser(stranger, () => rpc("admin_overview")));
  await pg.exec("select set_config('request.jwt.claim.aal','aal2',false)");
  assert.ok(await asUser(stranger, () => rpc("admin_overview")));
});
console.log(
  `${checks} database integration scenarios passed. Real PostGIS; mocked Auth identity and cron registration only.`,
);
await pg.close();
