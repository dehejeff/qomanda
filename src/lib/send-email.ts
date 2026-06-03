export type SendEmailResult = { ok: true; id?: string; mock?: boolean } | { ok: false; error: string }

type SendEmailInput = {
  to: string
  subject: string
  html: string
  text?: string
}

/**
 * Envio transacional via Resend (RESEND_API_KEY).
 * Em dev sem chave, loga no console e retorna mock=true.
 */
export async function sendTransactionalEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  const from = process.env.QOMANDA_FROM_EMAIL?.trim() ?? 'Qomanda <noreply@qomanda.com.br>'

  if (!apiKey) {
    if (process.env.NODE_ENV === 'development') {
      console.log('\n📧 [Email Mock] Para:', input.to)
      console.log('📌 Assunto:', input.subject)
      console.log('─'.repeat(60))
      console.log(input.text ?? input.html.replace(/<[^>]+>/g, ' ').slice(0, 500))
      console.log('─'.repeat(60))
      return { ok: true, mock: true }
    }
    return { ok: false, error: 'RESEND_API_KEY não configurada.' }
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
    })

    const data = (await res.json()) as { id?: string; message?: string }
    if (!res.ok) {
      console.error('[sendTransactionalEmail]', data)
      return { ok: false, error: data.message ?? 'Falha ao enviar e-mail.' }
    }

    return { ok: true, id: data.id }
  } catch (err) {
    console.error('[sendTransactionalEmail]', err)
    return { ok: false, error: 'Falha de rede ao enviar e-mail.' }
  }
}
