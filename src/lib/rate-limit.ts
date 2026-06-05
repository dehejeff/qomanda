import { NextResponse } from 'next/server'

/**
 * Rate limiting plugável e degradável.
 * - Com UPSTASH_REDIS_REST_URL + TOKEN → contador distribuído (REST, sem SDK).
 * - Sem isso → janela fixa em memória (por instância; suficiente para piloto e
 *   já barra rajadas de brute force/abuso no mesmo processo).
 */
export type RateLimitResult = { allowed: boolean; remaining: number; limit: number; retryAfter: number }

type Bucket = { count: number; resetAt: number }
const memory = new Map<string, Bucket>()

function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return req.headers.get('x-real-ip')?.trim() || 'unknown'
}

function upstashEnv(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  return url && token ? { url: url.replace(/\/$/, ''), token } : null
}

async function upstashLimit(fullKey: string, limit: number, windowSec: number): Promise<RateLimitResult | null> {
  const env = upstashEnv()
  if (!env) return null
  try {
    const res = await fetch(`${env.url}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.token}`, 'Content-Type': 'application/json' },
      // INCR + EXPIRE NX (só define TTL na primeira vez da janela)
      body: JSON.stringify([['INCR', fullKey], ['EXPIRE', fullKey, String(windowSec), 'NX']]),
    })
    if (!res.ok) return null
    const data = await res.json() as Array<{ result: number }>
    const count = Number(data?.[0]?.result ?? 0)
    if (!count) return null
    const allowed = count <= limit
    return { allowed, remaining: Math.max(0, limit - count), limit, retryAfter: allowed ? 0 : windowSec }
  } catch {
    return null // falha de rede → não bloqueia o usuário
  }
}

function memoryLimit(fullKey: string, limit: number, windowSec: number): RateLimitResult {
  const now = Date.now()
  // limpeza oportunista de buckets expirados
  if (memory.size > 5000) {
    for (const [k, b] of memory) if (b.resetAt <= now) memory.delete(k)
  }
  const bucket = memory.get(fullKey)
  if (!bucket || now >= bucket.resetAt) {
    memory.set(fullKey, { count: 1, resetAt: now + windowSec * 1000 })
    return { allowed: true, remaining: limit - 1, limit, retryAfter: 0 }
  }
  bucket.count++
  const allowed = bucket.count <= limit
  return { allowed, remaining: Math.max(0, limit - bucket.count), limit, retryAfter: allowed ? 0 : Math.ceil((bucket.resetAt - now) / 1000) }
}

/**
 * Aplica rate limit por (rota + IP). `key` identifica a rota/ação.
 */
export async function rateLimit(
  req: Request,
  opts: { key: string; limit: number; windowSec: number },
): Promise<RateLimitResult> {
  const fullKey = `rl:${opts.key}:${clientIp(req)}`
  const viaUpstash = await upstashLimit(fullKey, opts.limit, opts.windowSec)
  return viaUpstash ?? memoryLimit(fullKey, opts.limit, opts.windowSec)
}

/** Resposta padrão 429 com Retry-After. */
export function tooManyRequests(retryAfter: number): NextResponse {
  return NextResponse.json(
    { error: 'Muitas requisições. Tente novamente em instantes.' },
    { status: 429, headers: { 'Retry-After': String(Math.max(1, retryAfter)) } },
  )
}
