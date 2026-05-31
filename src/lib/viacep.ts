import { digitsOnly } from '@/lib/restaurant-profile'

export type ViaCepAddress = {
  postalCode: string
  street: string
  neighborhood: string
  city: string
  state: string
  complement: string | null
}

type ViaCepResponse = {
  cep?: string
  logradouro?: string
  complemento?: string
  bairro?: string
  localidade?: string
  uf?: string
  erro?: boolean
}

export async function fetchAddressByCep(cep: string): Promise<ViaCepAddress> {
  const digits = digitsOnly(cep)
  if (digits.length !== 8) {
    throw new Error('CEP inválido.')
  }

  const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`, {
    headers: { Accept: 'application/json' },
  })

  if (!res.ok) {
    throw new Error('Não foi possível consultar o CEP.')
  }

  const data = (await res.json()) as ViaCepResponse
  if (data.erro || !data.localidade) {
    throw new Error('CEP não encontrado.')
  }

  return {
    postalCode: digits,
    street: data.logradouro?.trim() ?? '',
    neighborhood: data.bairro?.trim() ?? '',
    city: data.localidade.trim(),
    state: data.uf?.trim().toUpperCase() ?? '',
    complement: data.complemento?.trim() || null,
  }
}
