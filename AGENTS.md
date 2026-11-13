# Project Architecture Rules

- Keep primary navigation, including admin panel sections, in one shared grouped configuration so desktop, mobile, command search, and the admin sidebar use identical labels, groups, and destinations.
- Open global command search through its exported event helper rather than synthetic keyboard events, so buttons and shortcuts share one contract.
- Give administrative workflows a protected, directly addressable route so tabs remain bookmarkable through their query state.
- Centralize production period, trend, and location rules in shared utilities so every dashboard and report uses identical definitions.- Call new Lovable Cloud edge functions with `fetch` on `VITE_SUPABASE_URL/functions/v1/...` and verify the bearer token against the external auth project inside the function, because the app's `supabase` client (and `functions.invoke`) is aliased to the external project.
- Keep Lovable AI prompts and model calls in edge functions; the browser only receives validated, structured results it converts itself (e.g. AI filter plans → PostgREST conditions in `src/lib/aiFilters.ts`).
