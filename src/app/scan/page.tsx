'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { QomandaLogo } from '@/components/qomanda-logo'
import { HubBottomNav } from '@/components/customer/hub-bottom-nav'

type ScanStatus = 'starting' | 'scanning' | 'detected' | 'no-support' | 'denied'

export default function ScanPage() {
  const router = useRouter()
  const videoRef   = useRef<HTMLVideoElement>(null)
  const streamRef  = useRef<MediaStream | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const scannedRef = useRef(false)

  const [status, setStatus]       = useState<ScanStatus>('starting')
  const [showModal, setShowModal] = useState(false)
  const [slug, setSlug]           = useState('')
  const [mesa, setMesa]           = useState('')
  const [slugError, setSlugError] = useState(false)
  const [mesaError, setMesaError] = useState(false)

  const stopCamera = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
  }, [])

  const handleDetected = useCallback((rawValue: string) => {
    if (scannedRef.current) return
    scannedRef.current = true
    stopCamera()
    setStatus('detected')
    if ('vibrate' in navigator) navigator.vibrate(200)

    setTimeout(() => {
      try {
        const url = new URL(rawValue)
        router.push(url.pathname + url.search)
      } catch {
        if (rawValue.startsWith('/')) {
          router.push(rawValue)
        } else {
          scannedRef.current = false
          setStatus('scanning')
        }
      }
    }, 900)
  }, [stopCamera, router])

  useEffect(() => {
    if (!('BarcodeDetector' in window)) {
      setStatus('no-support')
      return
    }

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        })
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
        setStatus('scanning')

        const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] })
        intervalRef.current = setInterval(async () => {
          if (!videoRef.current) return
          try {
            const codes = await detector.detect(videoRef.current)
            if (codes.length > 0) handleDetected(codes[0].rawValue)
          } catch { /* esperado durante escaneamento */ }
        }, 300)
      } catch {
        setStatus('denied')
      }
    }

    start()
    return stopCamera
  }, [handleDetected, stopCamera])

  function handleConfirmManual() {
    const s = slug.trim().toLowerCase().replace(/\//g, '').replace(/\s/g, '-')
    const m = mesa.trim()
    let valid = true

    if (!s) { setSlugError(true); valid = false }
    else setSlugError(false)

    if (!m) { setMesaError(true); valid = false }
    else setMesaError(false)

    if (!valid) return

    setShowModal(false)
    router.push(`/${s}?mesa=${m}`)
  }

  const isDetected = status === 'detected'
  const hasError   = status === 'no-support' || status === 'denied'

  const inputStyle: React.CSSProperties = {
    background: '#0b1326',
    border: '1px solid #584237',
    color: '#dae2fd',
    outline: 'none',
    width: '100%',
    height: 48,
    borderRadius: 12,
    padding: '0 16px',
    fontSize: 15,
    fontFamily: 'Geist, sans-serif',
    transition: 'border-color 0.15s',
  }

  return (
    <div className="relative h-screen w-full flex flex-col overflow-hidden"
      style={{ background: '#060e20', color: '#dae2fd' }}>

      {/* Camera feed */}
      <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover"
        muted playsInline aria-hidden="true" />
      <div className="absolute inset-0"
        style={{ background: 'rgba(11,19,38,0.72)', backdropFilter: 'blur(2px)' }} />

      {/* Header */}
      <header className="relative z-10 flex justify-between items-center px-6 h-16 shrink-0"
        style={{ background: 'rgba(23,31,51,0.85)', borderBottom: '1px solid rgba(88,66,55,0.4)' }}>
        <Link href="/hub" className="p-2 -ml-2 rounded-full" style={{ color: '#ffb690' }}>
          <span className="material-symbols-outlined">arrow_back</span>
        </Link>
        <div className="flex items-center gap-2">
          <QomandaLogo size={28} />
          <span className="font-black text-base" style={{ fontFamily: 'Geist, sans-serif', color: '#ffffff', letterSpacing: '-0.02em' }}>Qomanda</span>
        </div>
        <div className="w-8" />
      </header>

      {/* Scanner area */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-8">
        <div className="text-center mb-10">
          <h1 className="text-2xl font-semibold mb-2">Escaneie a Mesa</h1>
          <p className="text-sm max-w-[280px] mx-auto leading-relaxed" style={{ color: '#e0c0b1' }}>
            Posicione o QR Code da mesa no quadro abaixo para começar
          </p>
        </div>

        {/* Viewfinder */}
        <div className="relative w-64 h-64" style={{ boxShadow: '0 0 24px rgba(249,115,22,0.18)' }}>
          <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 rounded-tl-xl" style={{ borderColor: '#f97316' }} />
          <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 rounded-tr-xl" style={{ borderColor: '#f97316' }} />
          <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 rounded-bl-xl" style={{ borderColor: '#f97316' }} />
          <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 rounded-br-xl" style={{ borderColor: '#f97316' }} />
          <div className="absolute inset-2 rounded-lg overflow-hidden flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.18)', border: '1px solid rgba(88,66,55,0.2)' }}>
            {status === 'scanning' && <div className="scanner-laser absolute left-0 right-0 h-1 z-10" />}
            {isDetected ? (
              <span className="material-symbols-outlined"
                style={{ fontSize: 80, color: '#f97316', fontVariationSettings: "'FILL' 1" }}>check_circle</span>
            ) : (
              <span className="material-symbols-outlined select-none"
                style={{ fontSize: 120, color: 'rgba(218,226,253,0.07)' }}>qr_code_2</span>
            )}
          </div>
        </div>

        {isDetected && (
          <p className="mt-6 text-sm font-semibold" style={{ color: '#ffb690' }}>
            Mesa identificada! Redirecionando...
          </p>
        )}
        {hasError && (
          <p className="mt-6 text-sm text-center max-w-[260px] leading-relaxed" style={{ color: '#e0c0b1' }}>
            {status === 'no-support'
              ? 'Seu navegador não suporta scanner. Digite o código manualmente.'
              : 'Câmera não disponível. Digite o código manualmente.'}
          </p>
        )}

        {/* Um único botão de entrada manual */}
        {!isDetected && (
          <div className="mt-10 w-full max-w-xs flex flex-col items-center gap-4">
            <div className="flex items-center gap-4 w-full">
              <div className="h-px flex-1" style={{ background: '#584237' }} />
              <span className="text-[11px] font-mono uppercase tracking-widest" style={{ color: '#a78b7d' }}>Ou</span>
              <div className="h-px flex-1" style={{ background: '#584237' }} />
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="w-full h-12 flex items-center justify-center gap-2 text-sm font-mono rounded-xl active:scale-95 transition-all"
              style={{ background: '#f97316', color: '#582200', fontWeight: 700 }}
            >
              <span className="material-symbols-outlined text-[18px]">keyboard</span>
              DIGITAR CÓDIGO DA MESA
            </button>
          </div>
        )}
      </main>

      {/* Bottom nav */}
      <HubBottomNav active="scan" />

      {/* ── Modal de entrada manual ─────────────────────── */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          style={{ background: 'rgba(6,14,32,0.85)', backdropFilter: 'blur(8px)' }}
          onClick={() => setShowModal(false)}
        >
          <div
            className="w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl p-6 flex flex-col gap-5"
            style={{ background: '#131b2e', border: '1px solid rgba(88,66,55,0.5)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-[22px]" style={{ color: '#f97316' }}>table_restaurant</span>
                <div>
                  <p className="text-base font-bold" style={{ fontFamily: 'Geist, sans-serif' }}>Código da Mesa</p>
                  <p className="text-xs" style={{ color: '#a78b7d' }}>Digite o restaurante e número da mesa</p>
                </div>
              </div>
              <button onClick={() => setShowModal(false)}
                className="p-2 rounded-full transition-colors" style={{ color: '#584237' }}>
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Inputs */}
            <div className="space-y-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-mono uppercase tracking-wider" style={{ color: '#a78b7d' }}>
                  Restaurante (slug)
                </label>
                <input
                  type="text"
                  value={slug}
                  onChange={e => { setSlug(e.target.value); setSlugError(false) }}
                  placeholder="ex: tasca-do-porto"
                  autoComplete="off"
                  autoCapitalize="none"
                  style={{
                    ...inputStyle,
                    borderColor: slugError ? '#f87171' : '#584237',
                  }}
                  onFocus={e => { if (!slugError) e.target.style.borderColor = '#f97316' }}
                  onBlur={e => { if (!slugError) e.target.style.borderColor = '#584237' }}
                />
                {slugError && (
                  <p className="text-[11px] font-mono" style={{ color: '#f87171' }}>Informe o restaurante.</p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-mono uppercase tracking-wider" style={{ color: '#a78b7d' }}>
                  Número da Mesa
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={mesa}
                  onChange={e => { setMesa(e.target.value); setMesaError(false) }}
                  placeholder="ex: 4"
                  style={{
                    ...inputStyle,
                    borderColor: mesaError ? '#f87171' : '#584237',
                  }}
                  onFocus={e => { if (!mesaError) e.target.style.borderColor = '#f97316' }}
                  onBlur={e => { if (!mesaError) e.target.style.borderColor = '#584237' }}
                  onKeyDown={e => e.key === 'Enter' && handleConfirmManual()}
                />
                {mesaError && (
                  <p className="text-[11px] font-mono" style={{ color: '#f87171' }}>Informe o número da mesa.</p>
                )}
              </div>
            </div>

            {/* Preview URL */}
            {slug && mesa && (
              <div className="px-3 py-2 rounded-lg" style={{ background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.2)' }}>
                <p className="text-[11px] font-mono truncate" style={{ color: '#ffb690' }}>
                  /{slug.trim().toLowerCase()}?mesa={mesa.trim()}
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 h-12 rounded-xl text-sm font-mono transition-all active:scale-95"
                style={{ background: 'transparent', border: '1px solid #584237', color: '#a78b7d' }}
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmManual}
                className="flex-[2] h-12 rounded-xl text-sm font-mono font-bold flex items-center justify-center gap-2 transition-all active:scale-95"
                style={{ background: '#f97316', color: '#582200' }}
              >
                <span className="material-symbols-outlined text-[18px]">login</span>
                Ir para a Mesa
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes scan-line {
          0%   { top: 0%;   opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
        .scanner-laser {
          position: absolute;
          animation: scan-line 2.5s ease-in-out infinite;
          background: linear-gradient(to bottom, transparent, #f97316, transparent);
        }
      `}</style>
    </div>
  )
}
