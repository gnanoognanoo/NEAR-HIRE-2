/** A restart must never interrupt checkout, auth, publication or another mutation. */
export function createActivityGate() {
  let active = 0;
  let restarting = false;
  return {
    begin() {
      if (restarting) throw new Error("APP_RESTARTING");
      active++;
      let released = false;
      return () => {
        if (!released) active--;
        released = true;
      };
    },
    reserveRestart() {
      if (active || restarting) return null;
      restarting = true;
      return () => {
        restarting = false;
      };
    },
  };
}
export const criticalActivity = createActivityGate();

/** Release apps download quietly; restart stays deliberate during an active session. */
export function shouldAutoCheck(input: {
  development: boolean; web: boolean; enabled: boolean; channel: string | null;
  active: boolean; busy: boolean; now: number; lastCheck: number;
}) {
  return !input.development && !input.web && input.enabled &&
    (input.channel === "preview" || input.channel === "production") &&
    input.active && !input.busy && (input.lastCheck === 0 || input.now - input.lastCheck >= 15 * 60 * 1000);
}

export type UpdateResult =
  | "otaNotChecked"
  | "otaChecking"
  | "otaDownloading"
  | "otaReady"
  | "otaCurrent"
  | "otaFailed"
  | "otaBusy"
  | "otaUnavailable";

export function createUpdateController(deps: {
  enabled: () => boolean;
  check: () => Promise<{ isAvailable: boolean; isRollBackToEmbedded?: boolean }>;
  fetch: () => Promise<{ isNew: boolean; isRollBackToEmbedded?: boolean }>;
  reload: () => Promise<void>;
  pending: () => boolean;
  gate: ReturnType<typeof createActivityGate>;
  result: (result: UpdateResult) => void;
}) {
  let busy = false;
  let downloaded = false;
  return {
    async check() {
      if (busy) return;
      if (!deps.enabled()) {
        deps.result("otaUnavailable");
        return;
      }
      busy = true;
      deps.result("otaChecking");
      try {
        // A downloaded update can survive navigation or an offline check.
        if (downloaded || deps.pending()) {
          deps.result("otaReady");
          return;
        }
        const check = await deps.check();
        if (!check.isAvailable && !check.isRollBackToEmbedded) {
          deps.result("otaCurrent");
          return;
        }
        deps.result("otaDownloading");
        const fetched = await deps.fetch();
        downloaded = fetched.isNew || fetched.isRollBackToEmbedded === true || deps.pending();
        deps.result(downloaded ? "otaReady" : "otaCurrent");
      } catch {
        // Never display native errors that could contain request headers or URLs.
        deps.result("otaFailed");
      } finally {
        busy = false;
      }
    },
    async restart() {
      if (busy || !deps.enabled() || !(downloaded || deps.pending())) return;
      const release = deps.gate.reserveRestart();
      if (!release) {
        deps.result("otaBusy");
        return;
      }
      busy = true;
      try {
        await deps.reload();
        // Keep the gate reserved: reloadAsync resolves just before native reload.
      } catch {
        release();
        busy = false;
        deps.result("otaFailed");
      }
    },
  };
}
