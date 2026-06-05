// Verificação E2E: rate limiting. Dispara N requisições à mesma rota pública
// com um IP fake fixo (x-forwarded-for) e confirma que após o limite vem 429
// com Retry-After. IP único por execução = determinístico mesmo re-rodando.
import { randomUUID } from 'node:crypto'

const BASE = 'http://localhost:3000'
const IP = '203.0.113.' + (1 + Math.floor(Math.random() * 250))
const LIMIT = 20 // limite da rota call-waiter (window 60s)

const results = []
const check = (label, ok, extra = '') => { results.push([label, ok]); console.log(`${ok ? '✅' : '❌'} ${label}${extra ? ' — ' + extra : ''}`) }

async function hit() {
  const res = await fetch(`${BASE}/api/customer/call-waiter`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': IP },
    body: JSON.stringify({ sessionId: randomUUID() }), // uuid inexistente → handler daria 404, mas rate limit vem antes
  })
  return res
}

async function main() {
  console.log('IP de teste:', IP, '| limite:', LIMIT)
  const statuses = []
  let firstRetryAfter = null
  for (let i = 1; i <= LIMIT + 5; i++) {
    const res = await hit()
    statuses.push(res.status)
    if (res.status === 429 && firstRetryAfter === null) firstRetryAfter = res.headers.get('retry-after')
  }
  const n429 = statuses.filter(s => s === 429).length
  const firstBlockedIdx = statuses.findIndex(s => s === 429) + 1
  console.log('   primeiras respostas:', statuses.slice(0, 3).join(','), '… 1º 429 na req #', firstBlockedIdx, '| total 429:', n429)

  check('Primeira requisição NÃO é bloqueada', statuses[0] !== 429)
  check('Após o limite vem 429', n429 >= 1)
  check('Bloqueio começa ~no limite (não antes)', firstBlockedIdx > LIMIT && firstBlockedIdx <= LIMIT + 2, `#${firstBlockedIdx}`)
  check('429 traz header Retry-After', Boolean(firstRetryAfter), `retry-after=${firstRetryAfter}`)

  const passed = results.filter(r => r[1]).length
  console.log(`\n--- RESULTADO: ${passed}/${results.length} ---`)
  if (passed !== results.length) process.exitCode = 1
}

main().catch(e => { console.error('ERRO:', e); process.exitCode = 1 })
