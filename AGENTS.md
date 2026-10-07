# Project Architecture Rules

- Keep primary navigation in one shared configuration so desktop, mobile, and command search use identical labels and destinations.
- Open global command search through its exported event helper rather than synthetic keyboard events, so buttons and shortcuts share one contract.
- Give administrative workflows a protected, directly addressable route so tabs remain bookmarkable through their query state.
- Centralize production period, trend, and location rules in shared utilities so every dashboard and report uses identical definitions.