// Porteiro do endereço público temporário (simulação com pacientes reais, 19/11/2026).
// Serve o app já construído (dist/) e deixa passar SÓ o que o paciente usa:
//   /medico/<página>      página do médico (marcar consulta)
//   /formulario/<token>   formulário da consulta
//   /api/publico/...      horários ocupados, pedido, formulário
// A agenda e a consulta do médico (/modulo, /consulta, /api/agenda...) ficam de fora: 404.
//
// Uso: npx vite build && node scripts/portao-publico.mjs   (escuta em 127.0.0.1:5190)
// Depois: cloudflared tunnel --url http://127.0.0.1:5190
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs'
import { createServer, request } from 'node:http'
import { extname, join, normalize, resolve } from 'node:path'

const DIST = resolve(import.meta.dirname, '..', 'dist')
const PORTA = Number(process.env.PORTA ?? 5190)
const API = { host: '127.0.0.1', port: 8000 }

const TIPOS = {
  '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.woff2': 'font/woff2', '.ico': 'image/x-icon',
}

const app = readFileSync(join(DIST, 'app.html'), 'utf8')
// cartão do link no WhatsApp (título e descrição)
const cartao = (titulo, descricao) => app.replace('</head>',
  `<meta property="og:title" content="${titulo}"><meta property="og:description" content="${descricao}"><meta property="og:type" content="website"></head>`)
const PAGINA_FORMULARIO = cartao('Formulário da consulta', 'Toque para abrir e preencher. Leva poucos minutos.')
const PAGINA_MEDICO = cartao('Agendar consulta', 'Escolha o dia e o horário.')

function html(res, corpo) {
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
  res.end(corpo)
}

function arquivo(res, caminho) {
  // só arquivos de dentro de dist/assets e dist/img (nada de .html solto)
  const alvo = normalize(join(DIST, caminho))
  if (!alvo.startsWith(DIST) || !existsSync(alvo) || !statSync(alvo).isFile() || extname(alvo) === '.html') return nada(res)
  res.writeHead(200, { 'content-type': TIPOS[extname(alvo)] ?? 'application/octet-stream', 'cache-control': 'public, max-age=3600' })
  createReadStream(alvo).pipe(res)
}

function nada(res) {
  res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
  res.end('Não encontrado.')
}

function paraApi(req, res) {
  const ida = request({ ...API, method: req.method, path: req.url.replace(/^\/api/, ''), headers: { ...req.headers, host: `${API.host}:${API.port}` } }, (volta) => {
    res.writeHead(volta.statusCode ?? 502, volta.headers)
    volta.pipe(res)
  })
  ida.on('error', () => { res.writeHead(502); res.end() })
  req.pipe(ida)
}

createServer((req, res) => {
  const caminho = decodeURIComponent((req.url ?? '/').split('?')[0])
  if (caminho.startsWith('/api/publico/') && (req.method === 'GET' || req.method === 'POST')) return paraApi(req, res)
  if (req.method !== 'GET' && req.method !== 'HEAD') return nada(res)
  if (/^\/formulario\/[^/]+\/?$/.test(caminho)) return html(res, PAGINA_FORMULARIO)
  if (/^\/medico\/[^/]+\/?$/.test(caminho)) return html(res, PAGINA_MEDICO)
  if (caminho.startsWith('/assets/') || caminho.startsWith('/img/') || caminho === '/papel.png') return arquivo(res, caminho)
  return nada(res)
}).listen(PORTA, '127.0.0.1', () => console.log(`porteiro em http://127.0.0.1:${PORTA}`))
