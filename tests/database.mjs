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
  "202609070001_auth_device_cleanup.sql",
  "202609070002_location_notifications.sql",
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
await check("logout device cleanup is owner-scoped and idempotent", async () => {
  const token = "fictional-device-token-for-logout";
  await asUser(worker, () => rpc("register_device", [token, "android"]));
  await asUser(stranger, () => rpc("unregister_device", [token]));
  assert.equal(
    (await pg.query("select count(*)::int n from public.user_devices where token=$1", [token]))
      .rows[0].n,
    1,
  );
  await asUser(worker, () => rpc("unregister_device", [token]));
  await asUser(worker, () => rpc("unregister_device", [token]));
  assert.equal(
    (await pg.query("select count(*)::int n from public.user_devices where token=$1", [token]))
      .rows[0].n,
    0,
  );
  await pg.exec("set role anon");
  try {
    await assert.rejects(() => rpc("unregister_device", [token]));
  } finally {
    await pg.exec("reset role");
  }
});

const geoOwner = "40000000-0000-0000-0000-000000000001",
  geoWorker = "40000000-0000-0000-0000-000000000002";
await pg.query("insert into auth.users values($1,$3),($2,$4)", [
  geoOwner,
  geoWorker,
  "+919000000004",
  "+919000000005",
]);
await asUser(geoOwner, () =>
  rpc("save_profile", [{ name: "Geo owner", locality: "Fixture", languages: ["ta"] }]),
);
await asUser(geoWorker, () =>
  rpc("save_profile", [{ name: "Geo worker", locality: "Fixture", languages: ["ta"] }]),
);
const geoQuery = (radius = 3000, filter = {}, offset = 0) =>
  asUser(geoWorker, () =>
    pg.query("select * from public.nearby_jobs(18,78,$1,$2,$3)", [radius, filter, offset]),
  );
async function geoJob(distance, status = "active", pay = 500) {
  const row = await pg.query(
    "insert into public.jobs(poster_id,title,kind,category,description,pay,pay_unit,schedule,locality,request_id) values($1,'Geo fixture','residential','electrician','Fictional test work only',$2,'day','Afternoon','Public locality',gen_random_uuid()) returning id",
    [geoOwner, pay],
  );
  const id = row.rows[0].id;
  await pg.query(
    "insert into public.job_locations values($1,extensions.st_project(extensions.st_setsrid(extensions.st_makepoint(78,18),4326)::extensions.geography,$2::double precision,0::double precision),'PRIVATE GEO FIXTURE')",
    [id, distance],
  );
  await pg.query(
    "update public.jobs set status=$2,published_at=now(),expires_at=now()+interval '24 hours' where id=$1",
    [id, status],
  );
  return id;
}
const near = await geoJob(500),
  middle = await geoJob(2000),
  far = await geoJob(6000);
await check("500m / 2km / 6km geographic radius boundaries", async () => {
  assert.deepEqual(
    (await geoQuery(1000)).rows.map((r) => r.job.id),
    [near],
  );
  assert.deepEqual(
    new Set((await geoQuery(3000)).rows.map((r) => r.job.id)),
    new Set([near, middle]),
  );
  assert.ok(!(await geoQuery(5000)).rows.some((r) => r.job.id === far));
});
await check("expired, cancelled, reported and suspended nearby jobs never appear", async () => {
  const expired = await geoJob(400);
  await pg.query(
    "update public.jobs set published_at=now()-interval '25 hours',expires_at=now()-interval '1 hour' where id=$1",
    [expired],
  );
  const hidden = [expired];
  for (const status of ["cancelled", "reported", "suspended"])
    hidden.push(await geoJob(450, status));
  const ids = (await geoQuery()).rows.map((r) => r.job.id);
  for (const id of hidden) assert.ok(!ids.includes(id));
});
await check("nearest and pay sorting plus combined filters are deterministic", async () => {
  assert.deepEqual(
    (await geoQuery(3000, { sort: "nearest" })).rows.map((r) => r.job.id),
    [near, middle],
  );
  await pg.query("update public.jobs set pay=750 where id=$1", [middle]);
  assert.equal((await geoQuery(3000, { sort: "pay" })).rows[0].job.id, middle);
  assert.deepEqual(
    (
      await geoQuery(3000, {
        kind: "residential",
        category: "electrician",
        employment_type: "temporary",
        language: "ta",
        min_pay: 600,
        max_pay: 800,
        pay_unit: "day",
      })
    ).rows.map((r) => r.job.id),
    [middle],
  );
  assert.equal((await geoQuery(3000, { kind: "business" })).rows.length, 0);
});
await check("nearby payload is public-safe; exact coordinates require acceptance", async () => {
  const row = (await geoQuery(1000)).rows[0];
  assert.deepEqual(Object.keys(row).sort(), [
    "approx_lat",
    "approx_lng",
    "distance_m",
    "job",
    "match_score",
  ]);
  for (const field of [
    "latitude",
    "longitude",
    "location",
    "exact_address",
    "instructions",
    "request_id",
  ])
    assert.ok(!(field in row.job));
  const exact = (
    await pg.query(
      "select extensions.st_y(location::extensions.geometry) lat from public.job_locations where job_id=$1",
      [near],
    )
  ).rows[0].lat;
  assert.notEqual(row.approx_lat, exact);
  assert.equal(
    (
      await asUser(geoWorker, () =>
        pg.query("select * from public.job_locations where job_id=$1", [near]),
      )
    ).rows.length,
    0,
  );
  const app = await asUser(geoWorker, () => rpc("apply_job", [near]));
  await assert.rejects(() => asUser(geoWorker, () => rpc("private_contact", [app])));
  await asUser(geoOwner, () => rpc("decide_application", [app, "accepted"]));
  const contact = await asUser(geoWorker, () => rpc("private_contact", [app]));
  assert.equal(contact.exact_address, "PRIVATE GEO FIXTURE");
  assert.equal(contact.latitude, exact);
  await assert.rejects(() => asUser(stranger, () => rpc("private_contact", [app])));
});
await check("pagination returns 20 then remaining rows with no duplicate job IDs", async () => {
  for (let i = 0; i < 23; i++) await geoJob(700 + i * 10);
  const first = (await geoQuery(3000, { sort: "nearest" }, 0)).rows,
    second = (await geoQuery(3000, { sort: "nearest" }, 20)).rows;
  assert.equal(first.length, 20);
  assert.equal(
    new Set([...first, ...second].map((r) => r.job.id)).size,
    first.length + second.length,
  );
  assert.ok(second.length > 0);
});
await check("invalid discovery and job coordinates are rejected", async () => {
  for (const pair of [
    [91, 0],
    [0, 181],
    [null, 0],
    [NaN, 0],
  ])
    await assert.rejects(() =>
      asUser(geoWorker, () => pg.query("select * from public.nearby_jobs($1,$2,3000)", pair)),
    );
  await assert.rejects(() =>
    asUser(geoOwner, () =>
      rpc("create_job", [{ ...input, latitude: 91 }, "50000000-0000-0000-0000-000000000001"]),
    ),
  );
});
await check(
  "nearby notifications target opt-in workers and publication retries dedupe",
  async () => {
    await asUser(geoWorker, () => rpc("set_worker_location", [18, 78, true]));
    const id = await geoJob(800);
    const count = async () =>
      Number(
        (
          await pg.query(
            "select count(*) n from public.notifications where user_id=$1 and job_id=$2 and event='nearby_job'",
            [geoWorker, id],
          )
        ).rows[0].n,
      );
    assert.equal(await count(), 1);
    await asUser(geoOwner, () => rpc("publish_job", [id]));
    assert.equal(await count(), 1);
    await asUser(geoWorker, () => rpc("set_worker_location", [18, 78, false]));
    const other = await geoJob(900);
    assert.equal(
      Number(
        (
          await pg.query(
            "select count(*) n from public.notifications where user_id=$1 and job_id=$2 and event='nearby_job'",
            [geoWorker, other],
          )
        ).rows[0].n,
      ),
      0,
    );
    await assert.rejects(() =>
      asUser(geoWorker, () => pg.query("select * from private.worker_locations")),
    );
  },
);
await check(
  "notification delivery acknowledgements prevent repeated successful token sends",
  async () => {
    const token = "fictional-notification-token";
    await asUser(geoWorker, () => rpc("register_device", [token, "android"]));
    const event = (
      await pg.query(
        "select id from public.notifications where user_id=$1 and event='application_accepted' limit 1",
        [geoWorker],
      )
    ).rows[0].id;
    await pg.exec("set role service_role");
    try {
      await rpc("record_notification_delivery", [event, token]);
      await rpc("record_notification_delivery", [event, token]);
    } finally {
      await pg.exec("reset role");
    }
    assert.equal(
      Number(
        (
          await pg.query(
            "select count(*) n from private.notification_deliveries where notification_id=$1",
            [event],
          )
        ).rows[0].n,
      ),
      1,
    );
    const claimed = await rpc("claim_notifications");
    const item = claimed.find((e) => e.id === event);
    assert.ok(item);
    assert.ok(!item.tokens.includes(token));
    await assert.rejects(() =>
      asUser(geoWorker, () => rpc("record_notification_delivery", [event, token])),
    );
  },
);

await check("matching weights total 100 and geospatial indexes exist", async () => {
  assert.equal(
    (await pg.query("select private.match_score(0,3000,true,true,true,true,5) score")).rows[0]
      .score,
    100,
  );
  assert.equal(
    (await pg.query("select private.match_score(3000,3000,false,false,false,false,0) score"))
      .rows[0].score,
    0,
  );
  const indexes = (
    await pg.query(
      "select indexname from pg_indexes where indexname in ('job_locations_gist','worker_locations_gist','notification_outbox_pending')",
    )
  ).rows;
  assert.equal(indexes.length, 3);
});
await check(
  "nearby notification targeting respects distance, preferences and later opt-out",
  async () => {
    await asUser(geoWorker, () => rpc("set_worker_location", [18, 78, true]));
    const far = await geoJob(6000);
    assert.equal(
      Number(
        (
          await pg.query(
            "select count(*) n from public.notifications where user_id=$1 and job_id=$2",
            [geoWorker, far],
          )
        ).rows[0].n,
      ),
      0,
    );
    await pg.query("update public.profiles set notifications_enabled=false where id=$1", [
      geoWorker,
    ]);
    const muted = await geoJob(500);
    assert.equal(
      Number(
        (
          await pg.query(
            "select count(*) n from public.notifications where user_id=$1 and job_id=$2",
            [geoWorker, muted],
          )
        ).rows[0].n,
      ),
      0,
    );
    await pg.query("update public.profiles set notifications_enabled=true where id=$1", [
      geoWorker,
    ]);
    await pg.query(
      "update public.worker_profiles set categories=array['not-this-category'] where user_id=$1",
      [geoWorker],
    );
    const mismatch = await geoJob(500);
    assert.equal(
      Number(
        (
          await pg.query(
            "select count(*) n from public.notifications where user_id=$1 and job_id=$2",
            [geoWorker, mismatch],
          )
        ).rows[0].n,
      ),
      0,
    );
    await pg.query("update public.worker_profiles set categories='{}' where user_id=$1", [
      geoWorker,
    ]);
    const pending = await geoJob(500);
    await asUser(geoWorker, () => rpc("set_worker_location", [18, 78, false]));
    await rpc("claim_notifications");
    const row = (
      await pg.query(
        "select o.last_error from private.notification_outbox o join public.notifications n on n.id=o.id where n.user_id=$1 and n.job_id=$2 and n.event='nearby_job'",
        [geoWorker, pending],
      )
    ).rows[0];
    assert.equal(row.last_error, "SUPPRESSED");
  },
);
console.log(
  `${checks} database integration scenarios passed. Real PostGIS; mocked Auth identity and cron registration only.`,
);
await pg.close();
