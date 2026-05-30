import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'

function getKey(): Buffer {
  const key = process.env.CPF_ENCRYPTION_KEY
  if (!key || key.length !== 64) {
    throw new Error('CPF_ENCRYPTION_KEY deve ser uma string hex de 64 caracteres (32 bytes).')
  }
  return Buffer.from(key, 'hex')
}

function getSalt(): string {
  const salt = process.env.CPF_HASH_SALT
  if (!salt) throw new Error('CPF_HASH_SALT não configurada.')
  return salt
}

/**
 * Hash HMAC-SHA256 do CPF — irreversível.
 * Usado como chave de unicidade e lookup no banco.
 * Mesmo CPF sempre gera o mesmo hash (dado o mesmo salt).
 */
export function hashCPF(cpf: string): string {
  const digits = cpf.replace(/\D/g, '')
  return createHmac('sha256', getSalt()).update(digits).digest('hex')
}

/**
 * Criptografa o CPF com AES-256-GCM — reversível via service role.
 * Usado para emissão de NF-e futura.
 * Formato armazenado: iv_hex:ciphertext_hex:tag_hex
 */
export function encryptCPF(cpf: string): string {
  const digits = cpf.replace(/\D/g, '')
  const key    = getKey()
  const iv     = randomBytes(12) // 96 bits — recomendado para GCM
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const enc    = Buffer.concat([cipher.update(digits, 'utf8'), cipher.final()])
  const tag    = cipher.getAuthTag()
  return [iv.toString('hex'), enc.toString('hex'), tag.toString('hex')].join(':')
}

/**
 * Descriptografa o CPF.
 * NUNCA chamar client-side. Usar apenas em API routes com service role.
 */
export function decryptCPF(data: string): string {
  const [ivHex, encHex, tagHex] = data.split(':')
  if (!ivHex || !encHex || !tagHex) throw new Error('Formato de CPF criptografado inválido.')
  const key     = getKey()
  const iv      = Buffer.from(ivHex, 'hex')
  const enc     = Buffer.from(encHex, 'hex')
  const tag     = Buffer.from(tagHex, 'hex')
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  return decipher.update(enc).toString('utf8') + decipher.final('utf8')
}

/**
 * Formata CPF para exibição mascarada: ***.456.789-**
 * Usado no perfil do cliente — não requer descriptografia.
 */
export function maskCPFDisplay(cpf: string): string {
  const d = cpf.replace(/\D/g, '')
  if (d.length !== 11) return '***.***.***-**'
  return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`
}
