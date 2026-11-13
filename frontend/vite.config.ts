import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'

const raiz = (arquivo: string) => fileURLToPath(new URL(arquivo, import.meta.url))

// Páginas do app React. Tudo o que começar com estes caminhos abre o app.html;
// o resto (a raiz "/") é a landing estática em index.html.
// Em produção, a hospedagem precisa da mesma regra de reescrita.
export const ROTAS_DO_APP = ['/contratar', '/entrar']

function rotasDoApp(): Plugin {
  return {
    name: 'rotas-do-app',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const caminho = (req.url ?? '').split('?')[0]
        if (ROTAS_DO_APP.some((r) => caminho === r || caminho.startsWith(r + '/'))) req.url = '/app.html'
        next()
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), rotasDoApp()],
  build: {
    rollupOptions: {
      input: {
        landing: raiz('./index.html'),
        app: raiz('./app.html'),
      },
    },
  },
})
