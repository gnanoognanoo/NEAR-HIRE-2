import assert from "node:assert/strict";
export async function testCreditsV2({ pg, check, asUser, rpc, input }) {
  const summary = (id) => asUser(id, () => rpc("credit_summary"));
  const signup = async () => {
    const id = crypto.randomUUID();
    await pg.query("insert into auth.users values($1,$2)", [id, "+919000000077"]);
    await asUser(id, () =>
      rpc("save_profile", [{ name: "Credit fixture", locality: "Chennai", languages: ["ta"] }]),
    );
    return id;
  };
  const ledger = (id) =>
    pg.query("select * from public.credit_transactions where user_id=$1 order by created_at,id", [
      id,
    ]);
  const grant = (id, at) => pg.query("select private.ensure_monthly_credit($1,$2)", [id, at]);
  const expires = async (id) => {
    await pg.query(
      "update public.credit_lots set expires_at=now()-interval '1 second' where user_id=$1 and source='monthly_free'",
      [id],
    );
  };
  const u = await signup();
  await check(
    "V2 new/mid-month signup, repeated provisioning and ten competing monthly calls award exactly 10+2",
    async () => {
      await pg.query("select private.provision_credits($1)", [u]);
      await Promise.all(
        Array.from({ length: 10 }, () => pg.query("select private.ensure_monthly_credit($1)", [u])),
      );
      const s = await summary(u);
      assert.equal(s.balance, 12);
      assert.equal(s.welcome, 10);
      assert.equal(s.monthly, 2);
      const rows = (await ledger(u)).rows;
      assert.equal(rows.filter((x) => x.reason === "signup").length, 1);
      assert.equal(rows.filter((x) => x.reason === "monthly_free").length, 1);
      const month = rows.find((x) => x.reason === "monthly_free");
      assert.equal(Date.parse(month.expires_at) - Date.parse(month.created_at), 30 * 86400000);
    },
  );
  await check(
    "V2 migration preserves old +5 ledger, upgrades once, and skips ambiguous admin-adjusted accounts",
    async () => {
      const old = "93000000-0000-0000-0000-000000000001",
        adjusted = "93000000-0000-0000-0000-000000000002";
      await pg.query("select private.upgrade_welcome($1)", [old]);
      const rows = (await ledger(old)).rows;
      assert.equal(rows.find((x) => x.reason === "signup").delta, 5);
      assert.equal(rows.filter((x) => x.reason === "welcome_upgrade").length, 1);
      assert.equal((await summary(old)).balance, 12);
      assert.equal(
        (await ledger(adjusted)).rows.filter((x) => x.reason === "welcome_upgrade").length,
        0,
      );
      assert.equal((await summary(adjusted)).balance, 12);
    },
  );
  await check(
    "V2 UTC next period grants once with no historical catchup or changed historical amount",
    async () => {
      const id = await signup();
      const next = "2027-01-15T00:00:00Z";
      await grant(id, next);
      await grant(id, next);
      let rows = (await ledger(id)).rows.filter((x) => x.reason === "monthly_free");
      assert.equal(rows.length, 2);
      assert.equal(rows[1].delta, 2);
      await pg.exec("update public.pricing_config set monthly_free_credits=3 where id");
      try {
        await grant(id, "2027-02-15T00:00:00Z");
        rows = (await ledger(id)).rows.filter((x) => x.reason === "monthly_free");
        assert.deepEqual(
          rows.map((x) => x.delta),
          [2, 2, 3],
        );
      } finally {
        await pg.exec("update public.pricing_config set monthly_free_credits=2 where id");
      }
    },
  );
  await check(
    "V2 publish spends monthly before welcome/purchase, expiry debits only unused remainder",
    async () => {
      const id = await signup();
      await asUser(id, () =>
        rpc("save_profile", [{ name: "Credits fixture", locality: "Chennai", languages: ["ta"] }]),
      );
      await pg.query(
        "insert into public.credit_transactions(user_id,delta,reason,reference) values($1,5,'purchase',$2)",
        [id, "fixture-purchase:" + id],
      );
      const job = await asUser(id, () => rpc("create_job", [input, crypto.randomUUID()]));
      await asUser(id, () => rpc("publish_job", [job]));
      let s = await summary(id);
      assert.equal(s.monthly, 1);
      assert.equal(s.welcome, 10);
      assert.equal(s.purchased, 5);
      assert.equal(s.balance, 16);
      await expires(id);
      s = await summary(id);
      assert.equal(s.balance, 15);
      assert.equal(s.monthly, 0);
      assert.equal(s.welcome, 10);
      assert.equal(s.purchased, 5);
      await summary(id);
      const rows = (await ledger(id)).rows.filter((x) => x.reason === "monthly_expired");
      assert.equal(rows.length, 1);
      assert.equal(rows[0].delta, -1);
      assert.equal(
        (
          await pg.query(
            "select count(*)::int n from public.credit_lots where user_id=$1 and source<>$2 and expires_at is not null",
            [id, "monthly_free"],
          )
        ).rows[0].n,
        0,
      );
      await pg.query(
        "update public.jobs set published_at=now()-interval '25 hours',expires_at=now()-interval '1 hour' where id=$1",
        [job],
      );
      const repost = await asUser(id, () => rpc("repost_job", [job, crypto.randomUUID()]));
      assert.notEqual(repost, job);
      assert.equal((await summary(id)).balance, 14);
      assert.equal((await ledger(id)).rows.filter((x) => x.reason === "repost").length, 1);
    },
  );
  await check(
    "V2 expired-only funds cannot activate a draft, and no negative balance",
    async () => {
      const id = await signup();
      await pg.query(
        "insert into public.credit_transactions(user_id,delta,reason,reference) values($1,-12,'test_setup',$2)",
        [id, "drain:" + id],
      );
      // Simulate an old unused monthly grant with no grant for the current period left to claim.
      await pg.query(
        "insert into public.credit_transactions(user_id,delta,reason,reference,grant_month,expires_at) values($1,2,'monthly_free',$2,'2020-01-01',now()-interval '1 second')",
        [id, "expired:" + id],
      );
      const job = await asUser(id, () => rpc("create_job", [input, crypto.randomUUID()]));
      await assert.rejects(
        asUser(id, () => rpc("publish_job", [job])),
        /CREDITS_REQUIRED/,
      );
      assert.equal((await summary(id)).balance, 0);
      assert.equal(
        (await pg.query("select status from public.jobs where id=$1", [job])).rows[0].status,
        "draft",
      );
    },
  );
  await check(
    "V2 two competing publishes with one credit allow exactly one; retries do not spend twice",
    async () => {
      const id = await signup();
      await pg.query(
        "insert into public.credit_transactions(user_id,delta,reason,reference) values($1,-11,'test_setup',$2)",
        [id, "drain:" + id],
      );
      const a = await asUser(id, () => rpc("create_job", [input, crypto.randomUUID()])),
        b = await asUser(id, () => rpc("create_job", [input, crypto.randomUUID()]));
      const results = await asUser(id, () =>
        Promise.allSettled([rpc("publish_job", [a]), rpc("publish_job", [b])]),
      );
      assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
      assert.equal((await summary(id)).balance, 0);
      const active = results[0].status === "fulfilled" ? a : b;
      await asUser(id, () => rpc("publish_job", [active]));
      assert.equal((await summary(id)).balance, 0);
    },
  );
  await check(
    "V2 suspended, admin-only, deleted accounts and disabled monthly config cannot receive future grants",
    async () => {
      const id = await signup();
      await pg.query("update public.profiles set suspended=true where id=$1", [id]);
      await grant(id, "2027-03-01T00:00:00Z");
      assert.equal((await ledger(id)).rows.filter((x) => x.reason === "monthly_free").length, 1);
      await pg.query("update public.profiles set suspended=false where id=$1", [id]);
      await pg.query("insert into public.admin_users values($1)", [id]);
      await grant(id, "2027-03-01T00:00:00Z");
      assert.equal((await ledger(id)).rows.filter((x) => x.reason === "monthly_free").length, 1);
      await pg.query("delete from auth.users where id=$1", [id]);
      await grant(id, "2027-03-01T00:00:00Z");
      assert.equal(
        (await pg.query("select count(*)::int n from public.credit_lots where user_id=$1", [id]))
          .rows[0].n,
        0,
      );
      await pg.exec("update public.pricing_config set monthly_enabled=false where id");
      try {
        const off = await signup();
        assert.equal((await summary(off)).balance, 10);
      } finally {
        await pg.exec("update public.pricing_config set monthly_enabled=true where id");
      }
    },
  );
  await check(
    "V2 lot RLS and private functions prevent forged expiry, amounts, months and cross-user access",
    async () => {
      const other = await signup();
      assert.equal(
        (
          await asUser(other, () =>
            pg.query("select * from public.credit_lots where user_id=$1", [u]),
          )
        ).rows.length,
        0,
      );
      await assert.rejects(
        asUser(other, () =>
          pg.query("select private.ensure_monthly_credit($1,$2)", [u, "2027-01-01"]),
        ),
      );
      await assert.rejects(
        asUser(other, () =>
          pg.query("update public.credit_lots set remaining=99 where user_id=$1", [other]),
        ),
      );
      await assert.rejects(
        asUser(other, () =>
          pg.query(
            "insert into public.credit_transactions(user_id,delta,reason,reference,grant_month,expires_at) values($1,2,'monthly_free','forged','2027-01-01',now())",
            [other],
          ),
        ),
      );
      await assert.rejects(
        asUser(other, () => pg.exec("update public.pricing_config set monthly_free_credits=99")),
      );
      await assert.rejects(asUser(other, () => rpc("admin_list", ["credit_transactions"])));
      await pg.query("insert into public.admin_users values($1)", [other]);
      await pg.exec("select set_config('request.jwt.claim.aal','aal2',false)");
      try {
        const rows = await asUser(other, () => rpc("admin_list", ["credit_transactions"]));
        assert(rows.length > 0);
        assert("expires_at" in rows[0]);
      } finally {
        await pg.exec("select set_config('request.jwt.claim.aal','aal1',false)");
      }
    },
  );
  await check(
    "V2 all account caches reconcile with remaining lots and immutable ledger after payment regressions",
    async () => {
      assert.equal(
        (
          await pg.query(
            "select count(*)::int n from public.job_credits c where c.balance<>(select coalesce(sum(delta),0) from public.credit_transactions t where t.user_id=c.user_id) or c.balance<>(select coalesce(sum(remaining),0) from public.credit_lots l where l.user_id=c.user_id)",
          )
        ).rows[0].n,
        0,
      );
      assert.equal(
        (
          await pg.query(
            "select count(*)::int n from public.credit_lots where source='purchase' and expires_at is not null",
          )
        ).rows[0].n,
        0,
      );
    },
  );
}
