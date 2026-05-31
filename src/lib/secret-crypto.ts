import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'

function getKey(): Buffer {
  const key = process.env.CPF_ENCRYPTION_KEY
  if (!key || key.length !== 64) {
    throw new Error('CPF_ENCRYPTION_KEY deve ser uma string hex de 64 caracteres (32 bytes).')
  }
  return Buffer.from(key, 'hex')
}

/** Criptografa segredos da plataforma (API keys, tokens). Formato: iv:ciphertext:tag */
export function encryptSecret(value: string): string {
  const key = getKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const enc = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [iv.toString('hex'), enc.toString('hex'), tag.toString('hex')].join(':')
}

export function decryptSecret(data: string): string {
  const [ivHex, encHex, tagHex] = data.split(':')
  if (!ivHex || !encHex || !tagHex) throw new Error('Formato de segredo criptografado inválido.')
  const key = getKey()
  const iv = Buffer.from(ivHex, 'hex')
  const enc = Buffer.from(encHex, 'hex')
  const tag = Buffer.from(tagHex, 'hex')
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  return decipher.update(enc).toString('utf8') + decipher.final('utf8')
}

export function maskSecret(value: string | null | undefined, visibleTail = 4): string | null {
  if (!value) return null
  if (value.length <= visibleTail) return '••••'
  return `${'•'.repeat(Math.min(12, value.length - visibleTail))}${value.slice(-visibleTail)}`
}
