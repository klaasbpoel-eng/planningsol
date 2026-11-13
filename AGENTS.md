# Project Architecture Rules

- Keep primary navigation, including admin panel sections, in one shared grouped configuration so desktop, mobile, command search, and the admin sidebar use identical labels, groups, and destinations.
- Open global command search through its exported event helper rather than synthetic keyboard events, so buttons and shortcuts share one contract.
- Give administrative workflows a protected, directly addressable route so tabs remain bookmarkable through their query state.
- Centralize production period, trend, and location rules in shared utilities so every dashboard and report uses identical definitions.