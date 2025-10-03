# Pubwiki Chat (wikihelper-chat)

An agentic MediaWiki editor and conversation UI. The assistant (“Wiki Designer”) helps you discuss worldbuilding, proposes exact MediaWiki edits, then applies them only after an in-UI confirmation. It also supports image attachment with live preview, persistent chat history, and optional MCP tools for extended actions.

## Why this project

The core value is a MediaWiki-focused agent that:
- Thinks collaboratively with you about structure and content.
- Produces strictly valid wikitext (no Markdown) following style rules.
- Uses section-scoped edits and asks for explicit approval before writing.
- Encodes best practices for TemplateStyles and Scribunto to keep wikis clean and maintainable.

## Agent behavior and rules (lib/prompt.ts)

The system prompt defines a “Wiki Designer” with clear constraints:
- MediaWiki-only wikitext: headings use =/==/===, never Markdown.
- Edit flow: always get-page first, prefer minimal section edits; use section index or "new"; use "all" only when necessary.
- Infoboxes: prefer PortableInfobox via Templates; load CSS via TemplateStyles subpage, not global CSS.
- Scribunto: keep logic in Lua modules under Module:, presentation in Templates; invoke via {{#invoke:...}}.
- Research tools can be used when knowledge is uncertain, but writing remains in valid wikitext.

### Built-in wiki tools referenced by the prompt
Common wiki operations the agent may call (through MCP/tool layer):
- set-target-wiki, load-world, get-page, list-all-page-titles
- edit-page: create/update with section targeting and wikitext source

## UI callbacks: confirm-before-edit (lib/built-in-ui-client.ts)

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

## Composer and preview (components + chat.tsx)

- Image upload: the composer supports attaching one image with a live square thumbnail preview and filename (ellipsized). Files > 4 MB are rejected with a toast.
- Upload pipeline: `chat.tsx` generates a SHA-256 filename, requests a signed URL from `/api/upload/image`, uploads to DigitalOcean Spaces, and (optionally) calls `/api/upload/make-public` to set ACL.
- Streaming preview: user messages send immediately; model output streams into the chat with smooth chunking for better readability.

## Minimal setup

Prerequisites:
- Node.js 18+ and pnpm
- PostgreSQL database
- DigitalOcean Space (or any S3-compatible bucket)

Environment variables (.env):
- DATABASE_URL=                     # Postgres connection
- DO_SPACE_ENDPOINT=                # e.g. https://nyc3.digitaloceanspaces.com
- DO_SPACE_KEY=
- DO_SPACE_SECRET=
- DO_SPACE_BUCKET=
- USERKEY_SALT=                     # Optional salt to derive user key from username

Model providers (choose any you’ll use):
- OPENAI_API_KEY=
- DASHSCOPE_API_KEY=                # Qwen
- DEEPSEEK_API_KEY=

Optional provider base:
- OPENAI_API_BASE=                  # Defaults to https://api.yesapikey.com/v1 in code

Note: Never commit real secrets. The repository’s `.env` example is for local development only.

## Install and run

```powershell
pnpm install

# Drizzle (if needed):
pnpm db:generate
pnpm db:migrate

# Dev with local HTTPS certs in ./cert
pnpm dev

# Build & serve
pnpm build
pnpm start
```

Default dev URL: https://localhost:3000

## Daily use

1) Log in with your Pubwiki account (Dialog in the sidebar footer). A deterministic user ID is derived for your session.
2) Start chatting. The model proposes edits, but actual writes require your explicit confirmation.
3) Attach an image if needed; you’ll see an immediate preview and filename. Oversize files are rejected.
4) When options appear at the end of a reply, pick the one you want (ui-show-options).
5) When an edit is proposed, confirm or reject in the dialog. On confirm, we perform the change and report the result back.

## Selected endpoints

- POST `/api/chat` — streams the AI response; body includes messages, selected model, `userId`, optional `mcpServers`, `appendHeaders`, and `appendParts`. Uses `SYSTEM_PROMPT` from `lib/prompt.ts` and passes headers down to tools.
- POST `/api/login` — Pubwiki login via MediaWiki clientlogin; returns cookies and a derived `userkey`.
- POST `/api/upload/image` — returns signed upload URL + public URL for your Space.
- POST `/api/upload/make-public` — sets object ACL to public-read.

## Light notes on stack

- Next.js (App Router) + TypeScript
- ai-sdk for providers/streaming; models configured in `ai/providers.ts` (ids: `deepseek`, `qwen-plus`, `gpt-5`).
- Drizzle ORM + PostgreSQL for chats and messages (see `lib/db/schema.ts`).
- shadcn/ui, Radix UI, Tailwind, lucide-react, sonner for the front-end.

## Security & correctness

- All wiki writes go through a confirm-before-edit UI callback. The model never writes silently.
- Filenames are validated/signed server-side; object ACL changes are explicit.
- Follow TemplateStyles and Scribunto guidance to avoid global CSS changes and keep logic out of templates.

## Extending

- Add UI callbacks: register a new tool in `lib/built-in-ui-client.ts` that defers to `useUIResult` for user confirmation.
- Add wiki tools: integrate with `lib/built-in-wikihelper-client.ts` and pipe headers from `/api/chat` via `appendHeaders` for auth.
- Add models: extend `ai/providers.ts` with a new provider client and ID.

## License

MIT — see `LICENSE`.
