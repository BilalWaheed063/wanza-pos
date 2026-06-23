import { createFileRoute, redirect } from "@tanstack/react-router";

// Note: do NOT combine `ssr: false` with `throw redirect()` in beforeLoad on
// the index route — that pairing triggers TanStack's "Expected to find a match
// below the root match in SPA mode" invariant. A plain SSR redirect works
// because the unauthenticated layout below will bounce to /auth as needed.
export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard" });
  },
});
