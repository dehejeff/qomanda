declare global {
  interface Window {
    MercadoPago?: new (
      publicKey: string,
      options?: { locale?: string },
    ) => {
      createCardToken: (cardData: {
        cardNumber: string
        cardholderName: string
        cardExpirationMonth: string
        cardExpirationYear: string
        securityCode: string
        identificationType?: string
        identificationNumber?: string
      }) => Promise<{ id: string; payment_method_id?: string }>
    }
  }
}

let sdkPromise: Promise<void> | null = null

export function loadMercadoPagoSdk(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('SDK indisponível no servidor.'))
  if (window.MercadoPago) return Promise.resolve()
  if (sdkPromise) return sdkPromise

  sdkPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-mp-sdk="v2"]')
    if (existing) {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('Falha ao carregar Mercado Pago.')))
      return
    }

    const script = document.createElement('script')
    script.src = 'https://sdk.mercadopago.com/js/v2'
    script.async = true
    script.dataset.mpSdk = 'v2'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Falha ao carregar Mercado Pago.'))
    document.head.appendChild(script)
  })

  return sdkPromise
}

export async function createMercadoPagoCardToken(
  publicKey: string,
  input: {
    cardNumber: string
    cardholderName: string
    expiryMonth: string
    expiryYear: string
    securityCode: string
    identificationNumber?: string
  },
): Promise<{ token: string; paymentMethodId?: string }> {
  await loadMercadoPagoSdk()
  if (!window.MercadoPago) throw new Error('SDK Mercado Pago indisponível.')

  const mp = new window.MercadoPago(publicKey, { locale: 'pt-BR' })
  const result = await mp.createCardToken({
    cardNumber: input.cardNumber.replace(/\D/g, ''),
    cardholderName: input.cardholderName.trim(),
    cardExpirationMonth: input.expiryMonth,
    cardExpirationYear: input.expiryYear,
    securityCode: input.securityCode,
    identificationType: 'CPF',
    identificationNumber: (input.identificationNumber ?? '00000000000').replace(/\D/g, ''),
  })

  if (!result?.id) throw new Error('Não foi possível tokenizar o cartão.')
  return { token: result.id, paymentMethodId: result.payment_method_id }
}
