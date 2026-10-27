import assert from "node:assert/strict";

// Disposable PGlite only. Never used against a hosted project or real accounts.
export async function testMarketplaceLifecycle({ pg, check, asUser, rpc, input }) {
  const flags = (await pg.query("select * from public.payment_config")).rows[0];
  await pg.exec("update public.payment_config set payments_enabled_test=false,live_enabled=false");
  try {
    for (const kind of ["residential", "business"]) {
      const owner = crypto.randomUUID(),
        worker = crypto.randomUUID(),
        other = crypto.randomUUID();
      await pg.query(
        "insert into auth.users values ($1,'+919000008001'),($2,'+919000008002'),($3,'+919000008003')",
        [owner, worker, other],
      );
      await asUser(owner, () =>
        rpc("save_profile", [
          { name: "Lifecycle fixture", locality: "Chennai", languages: ["en", "ta"] },
        ]),
      );
      const category = (
        await pg.query("select id from public.job_categories where kind=$1 order by id limit 1", [
          kind,
        ])
      ).rows[0].id;
      const payload = {
        ...input,
        kind,
        category,
        business_name: kind === "business" ? "Fixture shop" : "",
        start_time: "09:30",
        is_urgent: true,
      };
      const balance = async () =>
        Number(
          (await pg.query("select balance from public.job_credits where user_id=$1", [owner]))
            .rows[0].balance,
        );
      const nearby = () =>
        asUser(worker, () =>
          pg.query("select * from public.nearby_jobs($1,$2,3000,$3)", [
            input.latitude,
            input.longitude,
            { kind },
          ]),
        );
      const create = async (extra = {}) => {
        const id = await asUser(owner, () =>
          rpc("create_job", [{ ...payload, ...extra }, crypto.randomUUID()]),
        );
        await asUser(owner, () => rpc("publish_job", [id]));
        return id;
      };
      let job, application, expired;
      await check(
        `lifecycle ${kind}: publish persists location/24h expiry and spends one free credit with payments off`,
        async () => {
          const before = await balance();
          job = await create();
          await asUser(owner, () => rpc("publish_job", [job]));
          assert.equal(await balance(), before - 1);
          const j = (
            await pg.query(
              "select j.*,extract(epoch from expires_at-published_at)::int lifetime,extensions.st_y(l.location::extensions.geometry) lat,extensions.st_x(l.location::extensions.geometry) lng from public.jobs j join public.job_locations l on l.job_id=j.id where j.id=$1",
              [job],
            )
          ).rows[0];
          assert.equal(j.kind, kind);
          assert.equal(j.lifetime, 86400);
          assert.equal(j.lat, input.latitude);
          assert.equal(j.lng, input.longitude);
          assert.equal(j.status, "active");
          assert.ok(
            (await asUser(owner, () => rpc("my_activity", ["posts"]))).some((j) => j.id === job),
          );
          assert.equal(
            (
              await pg.query(
                "select count(*)::int n from public.payments p join public.payment_orders o on o.id=p.order_id where o.user_id=$1",
                [owner],
              )
            ).rows[0].n,
            0,
          );
        },
      );
      await check(
        `lifecycle ${kind}: nearby discovery is private and applications enforce identity/duplicates`,
        async () => {
          const row = (await nearby()).rows.find((r) => r.job.id === job);
          assert.ok(row);
          for (const field of ["exact_address", "latitude", "longitude", "phone"])
            assert.equal(row.job[field], undefined);
          assert.equal(
            (
              await asUser(worker, () =>
                pg.query("select * from public.job_locations where job_id=$1", [job]),
              )
            ).rows.length,
            0,
          );
          await assert.rejects(
            () => asUser(owner, () => rpc("apply_job", [job])),
            /JOB_UNAVAILABLE/,
          );
          application = await asUser(worker, () => rpc("apply_job", [job]));
          await assert.rejects(
            () => asUser(worker, () => rpc("apply_job", [job])),
            /ALREADY_APPLIED/,
          );
          await assert.rejects(
            () => asUser(worker, () => rpc("private_contact", [application])),
            /CONTACT_LOCKED/,
          );
          await assert.rejects(
            () => asUser(other, () => rpc("decide_application", [application, "accepted"])),
            /INVALID_TRANSITION/,
          );
          assert.equal(
            (
              await asUser(other, () =>
                pg.query("select * from public.applications where id=$1", [application]),
              )
            ).rows.length,
            0,
          );
        },
      );
      await check(
        `lifecycle ${kind}: employer accepts; only participants unlock exact contact/location; filled jobs reject applications`,
        async () => {
          await asUser(owner, () => rpc("decide_application", [application, "accepted"]));
          assert.equal(
            (await pg.query("select status from public.jobs where id=$1", [job])).rows[0].status,
            "filled",
          );
          for (const actor of [owner, worker]) {
            const contact = await asUser(actor, () => rpc("private_contact", [application]));
            assert.equal(contact.exact_address, input.exact_address);
            assert.equal(contact.latitude, input.latitude);
            assert.equal(contact.longitude, input.longitude);
            assert.ok(contact.phone);
          }
          await assert.rejects(
            () => asUser(other, () => rpc("private_contact", [application])),
            /CONTACT_LOCKED/,
          );
          await assert.rejects(
            () => asUser(other, () => rpc("apply_job", [job])),
            /JOB_UNAVAILABLE/,
          );
          await assert.rejects(
            () => asUser(owner, () => rpc("decide_application", [application, "accepted"])),
            /INVALID_TRANSITION/,
          );
          assert.ok(!(await nearby()).rows.some((r) => r.job.id === job));
        },
      );
      await check(
        `lifecycle ${kind}: valid start and both completion confirmations are required and idempotent`,
        async () => {
          await assert.rejects(() =>
            asUser(worker, () => rpc("transition_job", [job, "in_progress"])),
          );
          await assert.rejects(
            () => asUser(worker, () => rpc("confirm_completion", [application])),
            /INVALID_TRANSITION/,
          );
          await assert.rejects(
            () => asUser(owner, () => rpc("submit_review", [application, 5, "Too soon"])),
            /REVIEW_UNAVAILABLE/,
          );
          await asUser(owner, () => rpc("transition_job", [job, "in_progress"]));
          await assert.rejects(
            () => asUser(other, () => rpc("confirm_completion", [application])),
            /INVALID_TRANSITION/,
          );
          await asUser(worker, () => rpc("confirm_completion", [application]));
          assert.equal(
            (await pg.query("select status from public.jobs where id=$1", [job])).rows[0].status,
            "in_progress",
          );
          await asUser(owner, () => rpc("confirm_completion", [application]));
          await asUser(owner, () => rpc("confirm_completion", [application]));
          assert.equal(
            (await pg.query("select status from public.jobs where id=$1", [job])).rows[0].status,
            "completed",
          );
          assert.equal(
            (await pg.query("select status from public.applications where id=$1", [application]))
              .rows[0].status,
            "completed",
          );
          assert.equal(
            (
              await pg.query(
                "select count(*)::int n from public.notifications where job_id=$1 and event='work_completed'",
                [job],
              )
            ).rows[0].n,
            2,
          );
          await assert.rejects(
            () => asUser(owner, () => rpc("transition_job", [job, "cancelled"])),
            /INVALID_TRANSITION/,
          );
        },
      );
      await check(
        `lifecycle ${kind}: both reviews are authorized, validated, unique and restricted by RLS`,
        async () => {
          await assert.rejects(
            () => asUser(other, () => rpc("submit_review", [application, 5, "Intruder"])),
            /REVIEW_UNAVAILABLE/,
          );
          for (const stars of [0, 6])
            await assert.rejects(() =>
              asUser(owner, () => rpc("submit_review", [application, stars, "Bad rating"])),
            );
          for (const actor of [owner, worker]) {
            await asUser(actor, () =>
              rpc("submit_review", [application, 5, "Completed fixture work"]),
            );
            await assert.rejects(() =>
              asUser(actor, () => rpc("submit_review", [application, 4, "Duplicate"])),
            );
          }
          const reviews = (
            await pg.query(
              "select author_id,subject_id from public.reviews where application_id=$1",
              [application],
            )
          ).rows;
          assert.equal(reviews.length, 2);
          assert.ok(
            reviews.every(
              (r) => r.author_id !== r.subject_id && [owner, worker].includes(r.subject_id),
            ),
          );
          assert.equal(
            (
              await asUser(other, () =>
                pg.query("select * from public.reviews where application_id=$1", [application]),
              )
            ).rows.length,
            0,
          );
        },
      );
      await check(
        `lifecycle ${kind}: suspended job/poster/worker cannot bypass discovery or application restrictions`,
        async () => {
          const id = await create();
          await pg.query("update public.jobs set status='suspended' where id=$1", [id]);
          await assert.rejects(
            () => asUser(worker, () => rpc("apply_job", [id])),
            /JOB_UNAVAILABLE/,
          );
          assert.ok(!(await nearby()).rows.some((r) => r.job.id === id));
          await pg.query("update public.jobs set status='active' where id=$1", [id]);
          await pg.query("update public.profiles set suspended=true where id=$1", [owner]);
          await assert.rejects(
            () => asUser(worker, () => rpc("apply_job", [id])),
            /JOB_UNAVAILABLE/,
          );
          assert.ok(!(await nearby()).rows.some((r) => r.job.id === id));
          await pg.query("update public.profiles set suspended=false where id=$1", [owner]);
          await pg.query("update public.profiles set suspended=true where id=$1", [worker]);
          await assert.rejects(() => asUser(worker, () => rpc("apply_job", [id])), /AUTH_REQUIRED/);
          await pg.query("update public.profiles set suspended=false where id=$1", [worker]);
        },
      );
      await check(
        `lifecycle ${kind}: expiry boundary hides jobs and rejects application/acceptance before scheduler runs`,
        async () => {
          expired = await create();
          const pending = await asUser(worker, () => rpc("apply_job", [expired]));
          await pg.query(
            "update public.jobs set published_at=now()-interval '24 hours',expires_at=now() where id=$1",
            [expired],
          );
          assert.ok(!(await nearby()).rows.some((r) => r.job.id === expired));
          await assert.rejects(
            () => asUser(other, () => rpc("apply_job", [expired])),
            /JOB_UNAVAILABLE/,
          );
          await assert.rejects(
            () => asUser(owner, () => rpc("decide_application", [pending, "accepted"])),
            /JOB_UNAVAILABLE/,
          );
          await rpc("expire_jobs");
          await rpc("expire_jobs");
          assert.equal(
            (await pg.query("select status from public.jobs where id=$1", [expired])).rows[0]
              .status,
            "expired",
          );
          assert.equal(
            (
              await pg.query(
                "select count(*)::int n from public.notifications where job_id=$1 and event='job_expired'",
                [expired],
              )
            ).rows[0].n,
            1,
          );
        },
      );
      await check(
        `lifecycle ${kind}: repost of timed job preserves fields/location and costs once for a stable request`,
        async () => {
          const before = await balance(),
            request = crypto.randomUUID();
          const id = await asUser(owner, () => rpc("repost_job", [expired, request]));
          assert.equal(await asUser(owner, () => rpc("repost_job", [expired, request])), id);
          assert.equal(await balance(), before - 1);
          const j = (
            await pg.query(
              "select *,start_time::text time,extract(epoch from expires_at-published_at)::int lifetime from public.jobs where id=$1",
              [id],
            )
          ).rows[0];
          assert.notEqual(id, expired);
          assert.equal(j.repost_of, expired);
          assert.equal(j.kind, kind);
          assert.equal(j.is_urgent, true);
          assert.equal(j.time, "09:30:00");
          assert.equal(j.lifetime, 86400);
          const loc = (
            await pg.query(
              "select extensions.st_y(location::extensions.geometry) lat,extensions.st_x(location::extensions.geometry) lng,exact_address from public.job_locations where job_id=$1",
              [id],
            )
          ).rows[0];
          assert.deepEqual(loc, {
            lat: input.latitude,
            lng: input.longitude,
            exact_address: input.exact_address,
          });
          assert.ok((await nearby()).rows.some((r) => r.job.id === id));
          assert.equal(
            (await pg.query("select status from public.jobs where id=$1", [expired])).rows[0]
              .status,
            "expired",
          );
          await assert.rejects(
            () => asUser(other, () => rpc("repost_job", [expired, crypto.randomUUID()])),
            /REPOST_UNAVAILABLE/,
          );
          const unrelated = (
            await pg.query("select request_id from public.jobs where id=$1", [job])
          ).rows[0].request_id;
          await assert.rejects(
            () => asUser(owner, () => rpc("repost_job", [expired, unrelated])),
            /REPOST_REQUEST_CONFLICT/,
          );
          assert.equal(
            (await pg.query("select repost_of from public.jobs where id=$1", [job])).rows[0]
              .repost_of,
            null,
          );
          assert.equal(await balance(), before - 1);
        },
      );
      await check(
        `lifecycle ${kind}: expired partly staffed job can be filled, started and completed`,
        async () => {
          const id = await create({ workers_required: 2 });
          const accepted = await asUser(worker, () => rpc("apply_job", [id]));
          await asUser(owner, () => rpc("decide_application", [accepted, "accepted"]));
          await pg.query(
            "update public.jobs set published_at=now()-interval '24 hours',expires_at=now() where id=$1",
            [id],
          );
          await rpc("expire_jobs");
          await asUser(owner, () => rpc("fill_job", [id]));
          await asUser(owner, () => rpc("transition_job", [id, "in_progress"]));
          await asUser(owner, () => rpc("confirm_completion", [accepted]));
          await asUser(worker, () => rpc("confirm_completion", [accepted]));
          assert.equal(
            (await pg.query("select status from public.jobs where id=$1", [id])).rows[0].status,
            "completed",
          );
        },
      );
    }
  } finally {
    await pg.query("update public.payment_config set payments_enabled_test=$1,live_enabled=$2", [
      flags.payments_enabled_test,
      flags.live_enabled,
    ]);
  }
}
