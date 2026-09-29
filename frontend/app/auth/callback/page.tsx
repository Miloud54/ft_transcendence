import { Suspense } from "react";
import { CallbackHandler } from "./callback-handler";
import { Footer } from "@/components/footer";

export default function AuthCallbackPage() {
  return (
    <div className="flex min-h-screen flex-1 flex-col">
      <Suspense
        fallback={
          <div className="flex flex-1 items-center justify-center bg-zinc-50">
            <p className="text-sm text-zinc-500">Signing you in…</p>
          </div>
        }
      >
        <CallbackHandler />
      </Suspense>

      <Footer />
    </div>
  );
}
