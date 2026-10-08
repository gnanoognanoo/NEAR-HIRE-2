import assert from "node:assert/strict";
export async function testJobPosting({ pg, check, asUser, rpc, input }) {
  const poster = crypto.randomUUID(),
    viewer = crypto.randomUUID();
  await pg.query("insert into auth.users values ($1,'+919000000081'),($2,'+919000000082')", [
    poster,
    viewer,
  ]);
  await asUser(poster, () =>
    rpc("save_profile", [{ name: "Posting fixture", locality: "Chennai" }]),
  );
  const request = crypto.randomUUID();
  let draft, urgent;
  const balance = async () =>
    Number(
      (await pg.query("select balance from public.job_credits where user_id=$1", [poster])).rows[0]
        .balance,
    );
  await check("posting: GPS/manual coordinates need no reverse-geocoded address", async () => {
    draft = await asUser(poster, () =>
      rpc("create_job", [{ ...input, exact_address: "" }, request]),
    );
    assert.equal(
      (await pg.query("select exact_address from public.job_locations where job_id=$1", [draft]))
        .rows[0].exact_address,
      "",
    );
  });
  await check(
    "posting: retry saves edited draft fields/time and selected coordinates",
    async () => {
      const same = await asUser(poster, () =>
        rpc("create_job", [
          {
            ...input,
            title: "Edited fixture",
            latitude: 13.086,
            longitude: 80.212,
            start_date: "2026-10-09",
            start_time: "09:30",
          },
          request,
        ]),
      );
      assert.equal(same, draft);
      const row = (
        await pg.query(
          "select j.title,j.start_time::text time,extensions.st_y(l.location::extensions.geometry) lat from public.jobs j join public.job_locations l on l.job_id=j.id where j.id=$1",
          [draft],
        )
      ).rows[0];
      assert.equal(row.title, "Edited fixture");
      assert.equal(row.time, "09:30:00");
      assert.equal(row.lat, 13.086);
    },
  );
  await check(
    "posting: normal publication and repeated tap deduct exactly one credit, expire at 24h",
    async () => {
      const before = await balance();
      const first = await asUser(poster, () => rpc("publish_job", [draft]));
      await asUser(poster, () => rpc("publish_job", [draft]));
      assert.equal(await balance(), before - 1);
      assert.equal(first.is_urgent, false);
      assert.equal(Date.parse(first.expires_at) - Date.parse(first.published_at), 86400000);
      assert.equal(
        (
          await pg.query(
            "select count(*)::int n from public.credit_transactions where reference=$1",
            ["publish:" + draft],
          )
        ).rows[0].n,
        1,
      );
    },
  );
  await check(
    "posting: ambiguous-success retry cannot change active job or deduct again",
    async () => {
      const before = await balance();
      const same = await asUser(poster, () =>
        rpc("create_job", [{ ...input, title: "Do not overwrite published job" }, request]),
      );
      assert.equal(same, draft);
      await asUser(poster, () => rpc("publish_job", [same]));
      assert.equal(await balance(), before);
      assert.equal(
        (await pg.query("select title from public.jobs where id=$1", [draft])).rows[0].title,
        "Edited fixture",
      );
    },
  );
  await check(
    "posting: urgent flag reaches nearby public map without private location leakage",
    async () => {
      urgent = await asUser(poster, () =>
        rpc("create_job", [{ ...input, is_urgent: true }, crypto.randomUUID()]),
      );
      await asUser(poster, () => rpc("publish_job", [urgent]));
      const result = await asUser(viewer, () =>
        pg.query("select * from public.nearby_jobs($1,$2,3000,'{}',0)", [
          input.latitude,
          input.longitude,
        ]),
      );
      const found = result.rows.find((r) => r.job.id === urgent);
      assert.ok(found);
      assert.equal(found.job.isUrgent, true);
      assert.equal(found.job.exact_address, undefined);
      assert.equal(found.job.latitude, undefined);
      assert.equal(result.rows.find((r) => r.job.id === draft).job.isUrgent, false);
    },
  );
  await check(
    "posting: missing fields, bad amount/date/time roll back without credit deduction",
    async () => {
      const before = await balance();
      const count = Number(
        (await pg.query("select count(*) n from public.jobs where poster_id=$1", [poster])).rows[0]
          .n,
      );
      for (const bad of [
        { title: "" },
        { category: "invalid" },
        { pay: -1 },
        { start_date: "2026-02-30" },
        { start_date: "invalid" },
        { start_time: "25:00" },
        { latitude: null },
      ])
        await assert.rejects(() =>
          asUser(poster, () => rpc("create_job", [{ ...input, ...bad }, crypto.randomUUID()])),
        );
      assert.equal(await balance(), before);
      assert.equal(
        Number(
          (await pg.query("select count(*) n from public.jobs where poster_id=$1", [poster]))
            .rows[0].n,
        ),
        count,
      );
    },
  );
  await check(
    "posting: another user cannot publish or directly write jobs/private coordinates",
    async () => {
      const before = await balance();
      await assert.rejects(() => asUser(viewer, () => rpc("publish_job", [draft])));
      await assert.rejects(() =>
        asUser(viewer, () =>
          pg.query("update public.jobs set title='Tampered' where id=$1", [draft]),
        ),
      );
      assert.equal(await balance(), before);
    },
  );
  await check(
    "posting: My Posts returns the same persisted jobs after a new authenticated request",
    async () => {
      const posts = await asUser(poster, () => rpc("my_activity", ["posts", 0]));
      assert.ok(posts.some((j) => j.id === draft));
      assert.ok(posts.some((j) => j.id === urgent && j.is_urgent));
    },
  );
  await check(
    "posting: insufficient entitlements keep draft and never insert publish debit",
    async () => {
      const empty = crypto.randomUUID();
      await pg.query("insert into auth.users values ($1,'+919000000083')", [empty]);
      await asUser(empty, () =>
        rpc("save_profile", [{ name: "Empty wallet", locality: "Chennai" }]),
      );
      await pg.query(
        "insert into public.credit_transactions(user_id,delta,reason,reference) values($1,-12,'admin_adjustment',$2)",
        [empty, "test-empty:" + empty],
      );
      const id = await asUser(empty, () => rpc("create_job", [input, crypto.randomUUID()]));
      await assert.rejects(() => asUser(empty, () => rpc("publish_job", [id])), /CREDITS_REQUIRED/);
      assert.equal(
        (await pg.query("select status from public.jobs where id=$1", [id])).rows[0].status,
        "draft",
      );
      assert.equal(
        (
          await pg.query(
            "select count(*)::int n from public.credit_transactions where reference=$1",
            ["publish:" + id],
          )
        ).rows[0].n,
        0,
      );
    },
  );
}
