# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A TypeScript CLI for the **Determ** (Mediatoolkit) media monitoring API. The API base URL is `https://api.mediatoolkit.com`. Authentication is via `access_token` passed as a URL query parameter on every request.

## API Reference (from `Determ APIv2 - Guide.pdf`)

Two endpoints are currently documented:

### Get Keyword Mentions
- **Method:** POST
- **Endpoint:** `/v2/organization/{ORGANIZATION_ID}/group/{GROUP_ID}/keyword/{KEYWORD_ID}/mentions/scroll`
- **Pagination:** Scroll-based — pass `scrollToken` from the previous response to fetch the next page
- **Time fields** must be Unix timestamps in **milliseconds**
- **Filter operators:** `any` (match any value), `all` (match all values), `not` (exclude values)
- `feedTime` = when Determ ingested the mention; `publishedTime` = when the source originally published it. Use `feedTime` for real-time monitoring and `publishedTime` for historical queries.
- Omit `mentionType` filter entirely to get all source types; include it to scope to specific types (e.g., `TWITTER`, `INSTAGRAM`)

### Get Tags
- **Method:** GET
- **Endpoint:** `/v2/organization/{organizationId}/tags`
- Returns `{ tags: [{ id, name, categoryId }] }`

## Intended Architecture

```
src/
  cli.ts          # Entry point — registers all commands via commander/yargs
  config.ts       # Loads/saves credentials (DETERM_ACCESS_TOKEN, DETERM_ORG_ID) from env or ~/.determ-cli.json
  client.ts       # Axios/fetch wrapper — attaches access_token to every request, handles HTTP errors
  commands/
    mentions.ts   # `determ mentions` — builds POST body, handles scroll pagination
    tags.ts       # `determ tags` — GET tags for an org
  types.ts        # TypeScript interfaces for all API request/response shapes
  formatters.ts   # Output formatting: table (default), JSON (--json flag), CSV (--csv flag)
```

## Commands to Implement

```
determ mentions --keyword <id> --group <id> [--org <id>] [--from <date>] [--to <date>]
               [--sentiment POSITIVE|NEGATIVE|NEUTRAL] [--type TWITTER|INSTAGRAM|...]
               [--tag <id>] [--count <n>] [--all] [--json] [--csv]

determ tags [--org <id>] [--json]
```

`--all` should auto-paginate using `scrollToken` until exhausted.

## Development Commands

```bash
npm install          # Install dependencies
npm run build        # tsc → dist/
npm run dev          # ts-node src/cli.ts (no compile step)
npm test             # vitest (or jest)
npm test -- mentions # Run a single test file
npm run lint         # eslint src/
```

## Recommended Stack

- **CLI framework:** `commander` (lightweight, well-typed)
- **HTTP:** `axios` (interceptors make auth token injection clean)
- **Config:** `dotenv` + optional `~/.determ-cli.json` for persisted credentials
- **Output tables:** `cli-table3`
- **Build:** `tsc` targeting `node18`, `"module": "commonjs"`, `outDir: dist`
- **Tests:** `vitest` with `vi.mock` for the HTTP client

## Key Behaviours

- `DETERM_ACCESS_TOKEN` and `DETERM_ORG_ID` should be readable from environment variables or a local config file; CLI flags override both.
- Scroll pagination: the API returns a `scrollToken` string; keep POSTing with it until the `mentions` array is empty.
- Date inputs from the user should be parsed as ISO 8601 and converted to milliseconds before sending to the API.
