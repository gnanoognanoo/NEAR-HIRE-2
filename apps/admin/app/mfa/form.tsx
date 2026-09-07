"use client";
import { useActionState } from "react";
import { enroll, verify, MfaState } from "./actions";
export default function MfaForm() {
  const [setup, setupAction, settingUp] = useActionState(enroll, {} as MfaState);
  const [result, verifyAction, verifying] = useActionState(verify, {} as MfaState);
  return (
    <>
      <form action={setupAction}>
        <button disabled={settingUp}>Set up or verify authenticator</button>
      </form>
      {setup.error && <p role="alert">{setup.error}</p>}
      {setup.qr && (
        <>
          <p>Scan this code in your authenticator app. Keep it private.</p>
          <img alt="Authenticator setup QR code" src={setup.qr} width={220} height={220} />
        </>
      )}
      {setup.factorId && (
        <form action={verifyAction}>
          <input type="hidden" name="factorId" value={setup.factorId} />
          <label>
            Authenticator code
            <input
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              required
            />
          </label>
          {result.error && <p role="alert">{result.error}</p>}
          <button disabled={verifying}>Verify</button>
        </form>
      )}
    </>
  );
}
