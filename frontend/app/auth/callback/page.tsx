import { Suspense } from "react";
import { CallbackHandler } from "./callback-handler";

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-zinc-50">
          <p className="text-sm text-zinc-500">Signing you in…</p>
        </div>
      }
    >
      <CallbackHandler />
    </Suspense>
  );
}
