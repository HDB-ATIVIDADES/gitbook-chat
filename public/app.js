document.addEventListener('alpine:init', () => {
  Alpine.data('chat', () => ({
    messages: [],
    history: [],
    input: '',
    loading: false,
    initialLoading: true,
    ws: null,
    openCard: null,
    renderedContent: {},
    welcomeQuestion: 'Estudo de caso',
    sidebarCollapsed: false,
    toasts: [],

    init() {
      this.sidebarCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
      this.$watch('sidebarCollapsed', val => localStorage.setItem('sidebarCollapsed', val));
      this.$watch('openCard', () => this.$nextTick(() => this.scrollSidebarToActive()));
      this.loadAllHistory().then(() => {
        this.connectWs();
        this.$nextTick(() => this.$refs.chatinput?.focus());
      });
      window.addEventListener('ask-question', (e) => this.ask(e.detail));
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') this.openCard = null;
      });
    },

    connectWs() {
      const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
      this.ws = new WebSocket(`${protocol}//${location.host}`);

      this.ws.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.type === 'welcome') {
          if (!this.messages.find(m => m.id === 'msg-welcome')) {
            this.messages.unshift({
              id: data.id, role: 'assistant', content: data.content,
              filename: data.filename, question: 'README — Estudo de Caso'
            });
            this.renderedContent[data.id] = this.renderMarkdown(data.content);
            if (this.openCard === null) this.openCard = data.id;
            this.$nextTick(() => this.scrollToBottom());
          }
        } else if (data.type === 'response') {
          this.messages.push({
            id: data.id, role: 'assistant', content: data.content,
            filename: data.filename, question: data.question
          });
          this.renderedContent[data.id] = this.renderMarkdown(data.content);
          this.openCard = data.id;
          this.loading = false;
          this.input = '';
          this.history.push({
            filename: data.filename, question: data.question,
            date: data.timestamp
          });
          this.showToast('Resposta salva', 'success');
          this.$nextTick(() => this.scrollToBottom());
        } else if (data.type === 'error') {
          this.loading = false;
          this.showToast(data.message, 'error');
        }
      };

      this.ws.onclose = () => setTimeout(() => this.connectWs(), 2000);
      this.ws.onerror = () => this.ws.close();
    },

    async loadAllHistory() {
      try {
        let messages = [];
        const renderedContent = {};

        // Fetch welcome.md and add as first card
        try {
          const welcomeRes = await fetch('/download/readme.md');
          const welcomeContent = await welcomeRes.text();
          messages.push({
            id: 'msg-welcome', role: 'assistant', content: welcomeContent,
            filename: 'welcome.md', question: 'README — Estudo de Caso'
          });
          renderedContent['msg-welcome'] = this.renderMarkdown(welcomeContent);
        } catch (e) {
          console.warn('Welcome.md não encontrado');
        }

        if (messages.length > 0) this.welcomeQuestion = 'README — Estudo de Caso';

        // Fetch history files
        let page = 1;
        let allItems = [];
        let hasMore = true;
        while (hasMore) {
          const res = await fetch(`/api/history?page=${page}&limit=30&order=asc`);
          const data = await res.json();
          allItems.push(...data.items);
          hasMore = data.hasMore;
          page++;
        }

        if (allItems.length > 0) {
          this.history = allItems;

          const results = await Promise.all(allItems.map(async (item) => {
            try {
              const res = await fetch(`/api/history/${item.filename}`);
              const fileData = await res.json();
              const lines = fileData.content.split('\n');
              const question = lines[0].replace(/^# /, '').trim();
              const response = lines.slice(1).join('\n').trim() || fileData.content;
              const id = `msg-${item.filename.replace(/\.md$/, '')}`;
              return {
                id,
                userMsg: { id: `${id}-user`, role: 'user', content: question, filename: item.filename },
                assistantMsg: { id, role: 'assistant', content: response, filename: item.filename, question },
                rendered: this.renderMarkdown(response)
              };
            } catch (err) {
              console.error('Erro ao carregar arquivo:', err);
              return null;
            }
          }));

          results.forEach(r => {
            if (!r) return;
            messages.push(r.userMsg, r.assistantMsg);
            renderedContent[r.id] = r.rendered;
          });

          this.openCard = results[results.length - 1].id;
        } else {
          this.openCard = 'msg-welcome';
        }

        this.messages = messages;
        this.renderedContent = renderedContent;
        this.initialLoading = false;
        this.$nextTick(() => {
          this.scrollToBottom();
          this.$refs.chatinput?.focus();
        });
      } catch (err) {
        console.error('Erro ao carregar todo histórico:', err);
        this.initialLoading = false;
      }
    },

    toggleCard(id) {
      if (this.openCard === id) {
        this.openCard = null;
        return;
      }
      this.openCard = id;
      if (!this.renderedContent[id]) {
        const msg = this.messages.find(m => m.id === id);
        if (msg) this.renderedContent[id] = this.renderMarkdown(msg.content);
      }
    },

    ask(question) {
      const q = question || this.input.trim();
      if (!q || this.loading) return;

      this.messages.push({ id: `msg-user-${Date.now()}`, role: 'user', content: q });
      this.loading = true;

      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ask', question: q }));
      } else {
        this.loading = false;
        this.showToast('WebSocket desconectado', 'error');
      }
      this.$nextTick(() => this.scrollToBottom());
    },

    scrollToMsg(filename) {
      const id = `msg-${filename.replace(/\.md$/, '')}`;
      const el = document.getElementById(id);
      if (el) {
        if (this.openCard !== id) this.toggleCard(id);
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    },

    scrollToBottom() {
      const area = this.$refs.chatarea;
      if (area) area.scrollTop = area.scrollHeight;
    },

    scrollSidebarToActive() {
      if (!this.openCard) return;
      const sidebar = document.querySelector('.sidebar-scroll');
      if (!sidebar) return;
      const btn = sidebar.querySelector(`[data-card-id="${this.openCard}"]`);
      if (btn) btn.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    },

    renderMarkdown(content) {
      if (!content) return '';
      content = content.replace(/# Sources?:[\s\S]*$/, '');
      try {
        const sanitize = (html) => {
          html = html.replace(/<a(?=\s)/g, '<a target="_blank" rel="noopener"');
          if (typeof DOMPurify !== 'undefined') html = DOMPurify.sanitize(html);
          return html;
        };

        const splitMatch = content.match(/^(.*?)(# Suggested Follow-up Questions?:[\s\S]*)$/s);
        if (splitMatch) {
          const before = sanitize(marked.parse(splitMatch[1], { breaks: true, gfm: true }));
          const wrapper = document.createElement('div');
          wrapper.innerHTML = marked.parse(splitMatch[2], { breaks: true, gfm: true });
          const buttons = Array.from(wrapper.querySelectorAll('a')).map(a => {
            const btn = document.createElement('button');
            btn.className = 'ask-btn';
            btn.textContent = a.textContent;
            btn.setAttribute('data-question', a.textContent);
            return btn.outerHTML;
          }).join('');
          return before + (buttons ? `<div class="mt-2 flex flex-wrap gap-1">${buttons}</div>` : '');
        }
        return sanitize(marked.parse(content, { breaks: true, gfm: true }));
      } catch (e) {
        console.error('Markdown render error:', e);
        return content;
      }
    },

    showToast(message, type = 'success', duration = 3000) {
      const id = Date.now();
      this.toasts.push({ id, message, type });
      setTimeout(() => {
        this.toasts = this.toasts.filter(t => t.id !== id);
      }, duration);
    },

    formatDate(iso) {
      const d = new Date(iso);
      const pad = (n) => String(n).padStart(2, '0');
      return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
  }));
});

document.addEventListener('click', (e) => {
  const btn = e.target.closest('.ask-btn');
  if (btn) {
    window.dispatchEvent(new CustomEvent('ask-question', { detail: btn.textContent }));
  }
});

