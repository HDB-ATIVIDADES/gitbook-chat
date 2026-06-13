# Session Context

## Project
GitBook Chat — chat interface que consulta GitBook e salva respostas como `.md`.

## Architecture
- **server.js**: Express + WebSocket (`ws`). Rotas: `/api/history` (paginação), `/api/history/:file`, `/download/readme.md`. WS responde perguntas consultando `GITBOOK_URL`.
- **public/index.html**: UI Tailwind/Alpine. Sidebar colapsável, toasts, loading spinner, welcome fixo.
- **public/app.js**: Componente Alpine `chat()` com `loadAllHistory()`, `toggleCard()`, `renderMarkdown()`.
- **asks/**: respostas salvas como `YYYY-MM-DD-HH-mm-ss.md`.

## Key Behaviors
- `GITBOOK_URL` obrigatória em `.env`
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
