/**
 * Toca um sinal sonoro curto para avisar o garçom que um pedido ficou pronto.
 * Usa a Web Audio API (sem arquivos externos). Falha silenciosamente quando
 * o navegador bloqueia áudio antes da primeira interação do usuário.
 */
let audioCtx: AudioContext | null = null

export function playReadyChime() {
  if (typeof window === 'undefined') return
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    audioCtx ??= new Ctx()
    const ctx = audioCtx

    // Toca duas notas curtas (ding-dong) para chamar atenção.
    const now = ctx.currentTime
    const notes = [880, 1175] // A5, D6
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      const start = now + i * 0.18
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16)
      osc.connect(gain).connect(ctx.destination)
      osc.start(start)
      osc.stop(start + 0.18)
    })

    // Vibra no celular, se suportado.
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate?.([120, 60, 120])
    }
  } catch {
    /* áudio indisponível — ignora */
  }
}
