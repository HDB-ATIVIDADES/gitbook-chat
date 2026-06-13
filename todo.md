# TODO — Correções e Melhorias

## Pendências / Bugs

- [ ] **Ícone info no welcome da sidebar não match card header** — welcome entry usa info circle, mas o card header do welcome usa ícone de documento (mesmo dos demais cards). Unificar ou padronizar.
- [ ] **Sidebar welcome label hardcoded** — "Estudo de caso" está fixo no HTML. Se o question do welcome mudar no server, fica inconsistente com o card header.
- [ ] **sidebarCollapsed não persiste** — ao recarregar a página, a sidebar sempre abre expandida. Salvar estado em `localStorage`.
- [ ] **Duplicata welcome em race condition** — se `loadAllHistory()` falhar ao fetch `/download/readme.md` e o WebSocket chegar depois, o welcome é adicionado duas vezes (o check `m.id === 'msg-welcome'` só previne se o primeiro já tiver sido adicionado no array messages).
- [ ] **Toast substitui rapidamente** — se várias respostas chegarem em sequência, só o último toast aparece (o timer do anterior é cancelado). Fila de toasts resolveria.

## Melhorias

- [ ] **Loading state inicial** — enquanto `loadAllHistory()` faz os fetches, a tela fica em branco. Mostrar um skeleton/spinner.
- [ ] **Responsividade mobile** — layout com sidebar `w-72` fixa não funciona em telas < 768px. Sidebar poderia ser um overlay/drawer em mobile.
- [ ] **Links externos abrirem em nova aba** — adicionar `target="_blank" rel="noopener"` nos `<a>` do markdown renderizado.
- [ ] **Truncar sidebar items muito longos** — perguntas com mais de ~60 chars quebram o layout. Já tem `truncate`, mas `py-2.5` fixo pode ficar estranho.
- [ ] **Sanitizar HTML do markdown** — `marked.parse()` não escapa XSS. Usar DOMPurify ou similar antes de injetar com `x-html`.
- [ ] **Timestamp nos arquivos salvos** — `YYYY-MM-DD-HH-mm-ss.md` usa hora do servidor, mas o toast e a sidebar mostram `new Date().toISOString()` do cliente. Podem divergir.
- [ ] **Histórico sem scroll infinito não tem "carregar mais"** — removemos o lazy-load, mas para muitos arquivos (>100) o `loadAllHistory` faz N requisições sequenciais. Poderia paginar com fetch paralelo.
- [ ] **Indicador visual do card ativo na sidebar** — o item clicado na sidebar não fica destacado. Adicionar classe `bg-gray-800` ou similar no item correspondente ao `openCard`.
- [ ] **Keyboard shortcuts** — `Ctrl+Enter` para enviar, `Escape` para fechar card etc.
- [ ] **Testes** — sem testes automatizados. Adicionar ao mínimo testes de integração para os endpoints da API.
