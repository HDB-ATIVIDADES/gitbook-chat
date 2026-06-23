# Session Context

## Project
GitBook Chat — chat interface que consulta GitBook e salva respostas como `.md`.

## Architecture
- **server.js**: Express + WebSocket (`ws`). Rotas: `/api/history` (paginação), `/api/history/:file`, `/download/readme.md`. WS responde perguntas consultando `GITBOOK_URL`.
- **public/index.html**: UI Tailwind/Alpine. Sidebar colapsável, toasts, loading spinner, welcome fixo.
- **public/app.js**: Componente Alpine `chat()` com `loadAllHistory()`, `toggleCard()`, `renderMarkdown()`.
- **asks/**: respostas salvas como `YYYY-MM-DD-HH-mm-ss.md`.

## Key Behaviors
- **Stateless**: cada interação (WS message, tool call) é independente — não há contexto entre elas
- `GITBOOK_URL` obrigatória em `.env` — é a fonte RAG fixa; todo `query_gitbook` faz `?ask=` contra essa única URL
- `welcome.md` é cópia local commitada do README.md do `GITBOOK_URL`, nunca refetchada
- Welcome.md carregado via `/download/readme.md` antes do WS conectar
- Respostas: se GitBook já prefixa `# `, salva raw; senão prefixa `# pergunta\n\n`
- Links viram `.ask-btn` apenas na seção `# Suggested Follow-up Questions:`; header+parágrafo omitidos
- `# Sources:` removido antes do parse
- Sidebar colapsável, estado em `localStorage`
- `#BBDDE5` = cor de destaque
- Timestamp server-side (ISO) no WS response
- Container roda como `node` (UID 1000)

## Running
```bash
docker compose run --rm gitbook-chat npm install   # uma vez
docker compose up -d --build                        # http://localhost:8000
docker exec gitbook-chat npm test
```

## Setup
Sem Dockerfile — `docker-compose.yml` usa `image: node:20-alpine`, código montado como volume, `node_modules` em named volume persistente.

## Tests
`tests/api.test.js` usando `node:test`. Testa `/api/history`, `/download/readme.md`, página principal.

## MCP Server
- Integrado no mesmo `server.js` (rota `POST /mcp` via SSE em `http://localhost:8000/mcp`)
- Transporte SSE padrão: `GET /sse` (endpoint), `POST /mcp?sessionId=xxx` (mensagens)
- 5 tools: `query_gitbook`, `list_asks`, `get_ask`, `search_asks`, `get_welcome`
- **Stateless**: cada tool call é independente, sem sessão/conversa entre chamadas
- A fonte RAG fixa é o `GITBOOK_URL` — `query_gitbook` sempre consulta essa única URL
- Config opencode: `.opencode/mcp.json` com `type: "sse"` para `http://localhost:8000/sse`
