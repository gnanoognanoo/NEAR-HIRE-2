// Real Auth + PostgREST/RLS integration. Never targets production or invents a payment.
const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto");
const { createClient } = require("../apps/mobile/node_modules/@supabase/supabase-js");
const { STAGING_REF } = require("./staging-policy.cjs");
const assert = require("node:assert/strict");
async function main() {
  if (!process.argv.includes("--run")) throw Error("Explicit staging run required");
  const file = process.argv[process.argv.indexOf("--env-file") + 1];
  if (!file || !process.argv.includes("--env-file"))
    throw Error("External staging environment required");
  const resolved = fs.realpathSync(file),
    root = path.resolve(__dirname, "..");
  if (!path.relative(root, resolved).startsWith(".." + path.sep))
    throw Error("Credentials must stay outside Git");
  const env = Object.fromEntries(
    fs
      .readFileSync(resolved, "utf8")
      .split(/\r?\n/)
      .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
      .map((l) => {
        const i = l.indexOf("=");
        return [
          l.slice(0, i).trim(),
          l
            .slice(i + 1)
            .trim()
            .replace(/^['"]|['"]$/g, ""),
        ];
      }),
  );
  assert.equal(env.SUPABASE_PROJECT_REF, STAGING_REF);
  assert.equal(env.SUPABASE_URL, `https://${STAGING_REF}.supabase.co`);
  const adminClaim = JSON.parse(
    Buffer.from(env.SUPABASE_SERVICE_ROLE_KEY.split(".")[1], "base64url"),
  );
  assert.equal(adminClaim.ref, STAGING_REF);
  assert.equal(adminClaim.role, "service_role");
  const options = {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(20000) }),
    },
  };
  const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, options);
  const anon = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, options);
  const sessions = [],
    checks = [],
    accounts = {},
    runId = crypto.randomUUID();
  const accountFile = path.join(path.dirname(resolved), `staging-marketplace-${runId}.json`);
  const credentials = { project: STAGING_REF, runId, accounts: {} };
  const check = async (name, fn) => {
    await fn();
    checks.push({ name, result: "PASS" });
    console.log("PASS " + name);
  };
  const call = async (client, name, args = {}) => {
    const r = await client.rpc(name, args);
    if (r.error) throw r.error;
    return r.data;
  };
  const denied = async (fn, expected) => {
    try {
      await fn();
    } catch (e) {
      if (expected) assert.match(e.message, expected);
      return;
    }
    throw Error("Expected authorization/state rejection");
  };
  let phase = "preflight";
  try {
    await check("staging identity and disabled purchases", async () => {
      const r = await admin
        .from("payment_config")
        .select("live_enabled,payments_enabled_test")
        .single();
      if (r.error) throw r.error;
      assert.equal(r.data.live_enabled, false);
      assert.equal(r.data.payments_enabled_test, false);
    });
    for (const role of ["employer", "worker", "observer"]) {
      phase = "provision " + role;
      const email = `nearhire-stage-${role}-${runId}@example.invalid`,
        password = crypto.randomBytes(32).toString("base64url");
      credentials.accounts[role] = { email, password };
      fs.writeFileSync(accountFile, JSON.stringify(credentials, null, 2), { mode: 0o600 });
      const r = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        app_metadata: { purpose: "nearhire_staging_marketplace", run_id: runId },
        user_metadata: { name: `Staging ${role}` },
      });
      if (r.error) throw r.error;
      const client = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, options);
      const login = await client.auth.signInWithPassword({ email, password });
      if (login.error) throw login.error;
      assert.ok(login.data.session);
      assert.equal(login.data.user.id, r.data.user.id);
      accounts[role] = { id: r.data.user.id, client };
      sessions.push(client);
      credentials.accounts[role].id = r.data.user.id;
      fs.writeFileSync(accountFile, JSON.stringify(credentials, null, 2), { mode: 0o600 });
      await call(client, "save_profile", {
        p: {
          name: `Staging ${role}`,
          locality: "Synthetic Chennai test area",
          languages: ["en", "ta"],
        },
      });
    }
    const { employer, worker, observer } = accounts;
    await check("normal Auth sessions provision one profile/wallet and 10+2 credits", async () => {
      for (const actor of Object.values(accounts)) {
        const user = await actor.client.auth.getUser();
        if (user.error) throw user.error;
        assert.equal(user.data.user.id, actor.id);
        const p = await actor.client.from("profiles").select("id");
        if (p.error) throw p.error;
        assert.deepEqual(p.data, [{ id: actor.id }]);
        assert.equal((await call(actor.client, "credit_summary")).balance, 12);
        const tx = await actor.client.from("credit_transactions").select("reason,delta");
        if (tx.error) throw tx.error;
        assert.equal(tx.data.filter((t) => t.reason === "signup").length, 1);
        assert.equal(tx.data.find((t) => t.reason === "signup").delta, 10);
        assert.equal(tx.data.filter((t) => t.reason === "monthly_free").length, 1);
      }
    });
    const categories = await employer.client.from("job_categories").select("id,kind");
    if (categories.error) throw categories.error;
    const balance = async () => Number((await call(employer.client, "credit_summary")).balance);
    const location = { latitude: 13.085, longitude: 80.21 };
    const nearby = async (kind) =>
      call(worker.client, "nearby_jobs", {
        p_lat: location.latitude,
        p_lng: location.longitude,
        p_radius: 3000,
        p_filter: { kind },
        p_offset: 0,
      });
    async function create(payload) {
      const request = crypto.randomUUID(),
        id = await call(employer.client, "create_job", { p: payload, p_request_id: request });
      await call(employer.client, "publish_job", { p_job_id: id });
      return id;
    }
    for (const kind of ["residential", "business"]) {
      phase = kind;
      const payload = {
        ...location,
        title: `STAGING ${kind} ${runId.slice(0, 8)}`,
        kind,
        category: categories.data.find((c) => c.kind === kind).id,
        description: "Synthetic staging work only. Not a real job offer.",
        pay: 500,
        pay_unit: "job",
        schedule: "Staging validation only",
        workers_required: 1,
        locality: "Synthetic Chennai test area",
        exact_address: "SYNTHETIC PRIVATE TEST ADDRESS",
        business_name: kind === "business" ? "Synthetic staging shop" : "",
        required_languages: ["ta", "en"],
        start_time: "09:30",
        is_urgent: true,
      };
      let job, app, expired, expiredApplication;
      await check(`${kind}: create/publish/My Posts and exactly one debit`, async () => {
        const before = await balance();
        job = await create(payload);
        await call(employer.client, "publish_job", { p_job_id: job });
        assert.equal(await balance(), before - 1);
        const j = (await call(employer.client, "my_activity", { p_mode: "posts" })).find(
          (j) => j.id === job,
        );
        assert.ok(j);
        assert.equal(j.kind, kind);
        assert.equal(j.status, "active");
        assert.equal(Date.parse(j.expires_at) - Date.parse(j.published_at), 86400000);
      });
      await check(`${kind}: PostGIS discovery and private-row RLS`, async () => {
        const j = (await nearby(kind)).find((r) => r.job.id === job);
        assert.ok(j);
        for (const field of ["latitude", "longitude", "exact_address", "phone"])
          assert.equal(j.job[field], undefined);
        const hidden = await worker.client.from("job_locations").select("job_id").eq("job_id", job);
        if (hidden.error) throw hidden.error;
        assert.equal(hidden.data.length, 0);
        const hiddenProfile = await worker.client
          .from("profiles")
          .select("id")
          .eq("id", employer.id);
        if (hiddenProfile.error) throw hiddenProfile.error;
        assert.equal(hiddenProfile.data.length, 0);
      });
      await check(`${kind}: self/duplicate applications and locked contacts`, async () => {
        await denied(
          () => call(employer.client, "apply_job", { p_job_id: job }),
          /JOB_UNAVAILABLE/,
        );
        app = await call(worker.client, "apply_job", { p_job_id: job });
        await denied(() => call(worker.client, "apply_job", { p_job_id: job }), /ALREADY_APPLIED/);
        expiredApplication = await call(observer.client, "apply_job", { p_job_id: job });
        await denied(
          () => call(worker.client, "private_contact", { p_application_id: app }),
          /CONTACT_LOCKED/,
        );
        await denied(
          () =>
            call(observer.client, "decide_application", {
              p_application_id: app,
              p_status: "accepted",
            }),
          /INVALID_TRANSITION/,
        );
      });
      await check(`${kind}: acceptance/capacity and authorized exact location`, async () => {
        await call(employer.client, "decide_application", {
          p_application_id: app,
          p_status: "accepted",
        });
        await denied(
          () =>
            call(employer.client, "decide_application", {
              p_application_id: expiredApplication,
              p_status: "accepted",
            }),
          /JOB_UNAVAILABLE/,
        );
        await denied(
          () => call(observer.client, "private_contact", { p_application_id: app }),
          /CONTACT_LOCKED/,
        );
        await denied(() => call(anon, "private_contact", { p_application_id: app }));
        const contact = await call(worker.client, "private_contact", { p_application_id: app });
        assert.equal(contact.latitude, location.latitude);
        assert.equal(contact.longitude, location.longitude);
        assert.equal(contact.exact_address, payload.exact_address);
        assert.ok(!(await nearby(kind)).some((r) => r.job.id === job));
      });
      await check(`${kind}: valid start and mutual completion`, async () => {
        await denied(() =>
          call(worker.client, "transition_job", { p_job_id: job, p_status: "in_progress" }),
        );
        await denied(
          () => call(worker.client, "confirm_completion", { p_application_id: app }),
          /INVALID_TRANSITION/,
        );
        await call(employer.client, "transition_job", { p_job_id: job, p_status: "in_progress" });
        await call(worker.client, "confirm_completion", { p_application_id: app });
        assert.equal(
          (await call(worker.client, "my_activity", { p_mode: "applications" })).find(
            (a) => a.id === app,
          ).status,
          "accepted",
        );
        await call(employer.client, "confirm_completion", { p_application_id: app });
        await call(employer.client, "confirm_completion", { p_application_id: app });
        assert.equal(
          (await call(employer.client, "my_activity", { p_mode: "posts" })).find(
            (j) => j.id === job,
          ).status,
          "completed",
        );
      });
      await check(`${kind}: two participant reviews and outsider/duplicate rejection`, async () => {
        await denied(
          () =>
            call(observer.client, "submit_review", {
              p_application_id: app,
              p_stars: 5,
              p_body: "Not a participant",
            }),
          /REVIEW_UNAVAILABLE/,
        );
        for (const actor of [employer, worker]) {
          await call(actor.client, "submit_review", {
            p_application_id: app,
            p_stars: 5,
            p_body: "Synthetic staging review",
          });
          await denied(() =>
            call(actor.client, "submit_review", {
              p_application_id: app,
              p_stars: 4,
              p_body: "Duplicate",
            }),
          );
        }
        const r = await employer.client.from("reviews").select("id").eq("application_id", app);
        if (r.error) throw r.error;
        assert.equal(r.data.length, 2);
      });
      await check(`${kind}: real hosted expiry function and rejection before cron`, async () => {
        expired = await create(payload);
        expiredApplication = await call(worker.client, "apply_job", { p_job_id: expired });
        // Only this run's synthetic job is aged, in this hard-allowlisted staging project.
        const until = new Date(Date.now() - 1000),
          published = new Date(until.getTime() - 86400000);
        const edit = await admin
          .from("jobs")
          .update({ published_at: published.toISOString(), expires_at: until.toISOString() })
          .eq("id", expired)
          .eq("poster_id", employer.id)
          .eq("title", payload.title);
        if (edit.error) throw edit.error;
        await denied(
          () => call(observer.client, "apply_job", { p_job_id: expired }),
          /JOB_UNAVAILABLE/,
        );
        await denied(
          () =>
            call(employer.client, "decide_application", {
              p_application_id: expiredApplication,
              p_status: "accepted",
            }),
          /JOB_UNAVAILABLE/,
        );
        assert.ok(!(await nearby(kind)).some((r) => r.job.id === expired));
        await call(admin, "expire_jobs");
        assert.equal(
          (await call(employer.client, "my_activity", { p_mode: "posts" })).find(
            (j) => j.id === expired,
          ).status,
          "expired",
        );
      });
      await check(`${kind}: timed repost preserves location and costs once`, async () => {
        const before = await balance(),
          request = crypto.randomUUID(),
          id = await call(employer.client, "repost_job", {
            p_job_id: expired,
            p_request_id: request,
          });
        assert.equal(
          await call(employer.client, "repost_job", { p_job_id: expired, p_request_id: request }),
          id,
        );
        assert.equal(await balance(), before - 1);
        const j = (await call(employer.client, "my_activity", { p_mode: "posts" })).find(
          (j) => j.id === id,
        );
        assert.equal(j.repost_of, expired);
        assert.equal(j.start_time, "09:30:00");
        assert.equal(j.is_urgent, true);
        assert.equal(Date.parse(j.expires_at) - Date.parse(j.published_at), 86400000);
        const selected = await admin
          .from("job_locations")
          .select("location")
          .in("job_id", [expired, id]);
        if (selected.error) throw selected.error;
        assert.equal(selected.data.length, 2);
        assert.equal(selected.data[0].location, selected.data[1].location);
        assert.ok((await nearby(kind)).some((r) => r.job.id === id));
      });
    }
    phase = "accounting";
    await check("purchases disabled, no payment awards and foreign ledgers denied", async () => {
      await denied(
        () =>
          call(employer.client, "prepare_payment", {
            p_package: "single",
            p_request_id: crypto.randomUUID(),
          }),
        /PAYMENTS_DISABLED/,
      );
      const tx = await employer.client.from("credit_transactions").select("reason,delta");
      if (tx.error) throw tx.error;
      assert.ok(tx.data.every((t) => t.reason !== "purchase"));
      assert.equal(await balance(), 6);
      const hidden = await observer.client
        .from("credit_transactions")
        .select("id")
        .eq("user_id", employer.id);
      if (hidden.error) throw hidden.error;
      assert.equal(hidden.data.length, 0);
    });
    phase = "returning authentication";
    await check("returning normal login preserves UUID, wallet and grants", async () => {
      const before = await balance(),
        identity = employer.id;
      await employer.client.auth.signOut({ scope: "local" });
      const c = credentials.accounts.employer,
        r = await employer.client.auth.signInWithPassword({ email: c.email, password: c.password });
      if (r.error) throw r.error;
      assert.equal(r.data.user.id, identity);
      assert.equal(await balance(), before);
      const tx = await employer.client.from("credit_transactions").select("reason,delta");
      if (tx.error) throw tx.error;
      assert.equal(tx.data.filter((t) => t.reason === "signup").length, 1);
      assert.equal(tx.data.filter((t) => t.reason === "monthly_free").length, 1);
    });
    const result = {
      project: STAGING_REF,
      runId,
      accounts:
        "2 normal Auth participants + 1 normal Auth observer; admin-provisioned synthetic email fixtures",
      phoneOtpTest: "SEPARATE; NOT CLAIMED",
      passed: checks.length,
      checks,
      syntheticOnly: true,
      productionTouched: false,
    };
    fs.writeFileSync(
      path.join(path.dirname(resolved), "staging-marketplace-results.json"),
      JSON.stringify(result, null, 2),
      { mode: 0o600 },
    );
    console.log(
      JSON.stringify({
        staging: STAGING_REF,
        passed: checks.length,
        result: "PASS",
        realSmsDelivery: "NOT VERIFIED BY THIS TEST",
      }),
    );
  } catch (e) {
    console.error(
      JSON.stringify({
        staging: STAGING_REF,
        phase,
        result: "FAIL",
        safeCode: /^[A-Z0-9_]{2,80}$/.test(e.code || "") ? e.code : "VALIDATION_FAILED",
        passed: checks.length,
      }),
    );
    process.exitCode = 1;
  } finally {
    await Promise.allSettled(sessions.map((c) => c.auth.signOut({ scope: "local" })));
  }
}
main().catch(() => {
  console.error("Staging test preflight failed; credentials withheld.");
  process.exitCode = 1;
});
