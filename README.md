# Pubwiki Chat (wikihelper-chat)

An agentic MediaWiki editor and conversation UI. The assistant (“Wiki Designer”) helps you discuss worldbuilding, proposes exact MediaWiki edits, then applies them only after an in-UI confirmation. It also supports image attachment with live preview, persistent chat history, and optional MCP tools for extended actions.

## Minimal setup

Prerequisites:
- Node.js 18+ and pnpm
- PostgreSQL database
- DigitalOcean Space (or any S3-compatible bucket)

Environment variables (edit ``.app.env.example`` and then rename to ``.app.env``):
- DATABASE_URL=                     # Postgres connection
- DO_SPACE_ENDPOINT=                # e.g. https://nyc3.digitaloceanspaces.com
- DO_SPACE_KEY=
- DO_SPACE_SECRET=
- DO_SPACE_BUCKET=

Model providers (choose any you’ll use):
- OPENAI_API_KEY=
- DASHSCOPE_API_KEY=                # Qwen
- DEEPSEEK_API_KEY=

## Install and run

```powershell
pnpm install

# Dev with local HTTPS certs in ./cert
pnpm dev

# Build & serve
pnpm build
pnpm start
```

Default dev URL: https://localhost:3000

## Run in docker
put environment file (.app.env) in work dir
```shell
docker compose build
docker compose up
```


### Built-in wiki tools referenced by the prompt
Common wiki operations the agent may call (through MCP/tool layer):
- set-target-wiki, load-world, get-page, list-all-page-titles
- edit-page: create/update with section targeting and wikitext source

## UI callbacks:

We maintain a UI callback layer so the model must ask the user to confirm page changes:
- ui-show-options: render actionable choices at the end of a reply, helping the user pick the next step.
- edit-page (UI request): opens a confirmation dialog and waits for the user’s decision via `useUIResult.getResult(chatId, timeout)`.
  - If rejected: the tool returns without changing the wiki.
  - If confirmed: we dispatch the actual wiki tool — `create-page` or `update-page` — using headers propagated from the chat request, then return the tool’s result.

Additionally, there’s `create-new-wiki-site`, which submits a provisioning task to the wiki farm and returns a `task_id` the assistant can track.

Data flow (high level):
1) `/api/chat` constructs the toolset (including UI tools), injects `SYSTEM_PROMPT`, and streams the model’s response.
2) When the model calls `edit-page` (UI), the frontend shows confirmation and returns the decision to the tool.
3) On confirm, the tool calls the real wiki helper tools (`create-page`/`update-page`) and surfaces the outcome back into the chat.

## License

MIT — see `LICENSE`.
