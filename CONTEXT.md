# LamDock Project Context

LamDock manages local agent accounts, sessions, providers, account proxies and Handoff. Official quota information remains available in account cards and the menu bar popover, with its source and refresh state.

## Usage accuracy policy

The local JSONL-to-SQLite Usage module has been retired at the user's request. It could not establish complete, accurate account-level consumption. Do not restore its token totals, estimated costs, activity heatmaps, cache aggregates or pricing tables as current product features.

Historical Usage databases and PAT attribution timelines are retained on disk but are no longer read, updated or required for account switching and session deletion.

The Monitor page shows saved Gateway requests independently of account quotas. It includes observed request activity, upstream cache samples and the gateway's first content delta timing. Official Codex/native Responses direct traffic, Claude and Pi are not connected. Missing usage or timing remains unknown; response-header latency is stored separately and must not be displayed as first-token latency. See `docs/request-monitoring-design.md` for scope and verification.

## Quota and Reset Credit

Quota percentages and reset times come from the existing Codex/Antigravity quota sources. Local token counts must not substitute for official remaining quota or actual billing.

A Reset Credit is a Codex account credit that can reset a rate-limit window. Available count and expiry are distinct facts; unknown expiry stays unknown.

## Multi Agent work

The Claude and future agent integration plan remains in `docs/CLD-001-claude-agent-support-plan.md`. Its historical code baseline must be calibrated before implementation; removed Usage files are no longer part of the active product.
