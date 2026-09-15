import assert from "node:assert/strict";
export async function testDualAuth({ pg, check, asUser, rpc }) {
  for (const [provider, phone] of [
    ["google", null],
    ["phone", "+919876543210"],
  ]) {
    await check(
      `${provider} identity UUID provisioning and simulated repeat/link updates retain one profile and 10+2 credits`,
      async () => {
        const id = crypto.randomUUID();
        // Auth is a fixture boundary; this exercises the real INSERT trigger and RLS, not provider login.
        await pg.query("insert into auth.users values($1,$2)", [id, phone]);
        await pg.query("select private.provision_credits($1)", [id]);
        await pg.query("update auth.users set phone=$2 where id=$1", [id, "+919876543210"]);
        await pg.query("select private.provision_credits($1)", [id]);
        const summary = await asUser(id, () => rpc("credit_summary"));
        assert.equal(summary.balance, 12);
        assert.equal(summary.welcome, 10);
        assert.equal(summary.monthly, 2);
        for (const [table, column] of [
          ["profiles", "id"],
          ["worker_profiles", "user_id"],
          ["job_credits", "user_id"],
        ]) {
          const rows = await asUser(id, () =>
            pg.query(`select * from public.${table} where ${column}=$1`, [id]),
          );
          assert.equal(rows.rows.length, 1);
        }
        const ledger = await asUser(id, () =>
          pg.query("select reason from public.credit_transactions where user_id=$1", [id]),
        );
        assert.equal(ledger.rows.filter((x) => x.reason === "signup").length, 1);
        assert.equal(ledger.rows.filter((x) => x.reason === "monthly_free").length, 1);
      },
    );
  }
  await check(
    "SMS reservation replay, per-recipient limits and server-only permissions",
    async () => {
      const hash = "a".repeat(64),
        other = "b".repeat(64);
      const reserve = async (id, h = hash) =>
        (await pg.query("select public.reserve_sms_delivery($1,$2) result", [id, h])).rows[0]
          .result;
      assert.equal(await reserve("signed-1"), "reserved");
      assert.equal(await reserve("signed-1"), "pending");
      await pg.query("select public.complete_sms_delivery($1)", ["signed-1"]);
      assert.equal(await reserve("signed-1"), "sent");
      assert.equal(await reserve("signed-1", other), "denied");
      assert.equal(await reserve("signed-2"), "limited");
      await pg.exec(
        "update private.sms_hook_deliveries set created_at=now()-interval '61 seconds'",
      );
      assert.equal(await reserve("signed-2"), "reserved");
      for (let i = 3; i <= 5; i++) {
        await pg.exec(
          "update private.sms_hook_deliveries set created_at=now()-interval '61 seconds'",
        );
        assert.equal(await reserve("signed-" + i), "reserved");
      }
      await pg.exec(
        "update private.sms_hook_deliveries set created_at=now()-interval '61 seconds'",
      );
      assert.equal(await reserve("signed-6"), "limited");
      for (const role of ["anon", "authenticated"]) {
        await pg.exec(`set role ${role}`);
        try {
          await assert.rejects(reserve("forged", other), /permission denied/);
          await assert.rejects(
            pg.query("select * from private.sms_hook_deliveries"),
            /permission denied/,
          );
        } finally {
          await pg.exec("reset role");
        }
      }
      await pg.exec("set role service_role");
      try {
        assert.equal(await reserve("service-only", other), "reserved");
      } finally {
        await pg.exec("reset role");
      }
    },
  );
  await check("SMS global development budget is enforced across recipients", async () => {
    await pg.exec("delete from private.sms_hook_deliveries");
    for (let i = 0; i < 60; i++)
      assert.equal(
        (
          await pg.query("select public.reserve_sms_delivery($1,$2) result", [
            "budget-" + i,
            i.toString(16).padStart(64, "0"),
          ])
        ).rows[0].result,
        "reserved",
      );
    assert.equal(
      (
        await pg.query("select public.reserve_sms_delivery($1,$2) result", [
          "over-budget",
          "f".repeat(64),
        ])
      ).rows[0].result,
      "limited",
    );
  });
}
