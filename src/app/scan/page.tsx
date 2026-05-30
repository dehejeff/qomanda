'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { QomandaLogo } from '@/components/qomanda-logo'

type ScanStatus = 'starting' | 'scanning' | 'detected' | 'no-support' | 'denied'

export default function ScanPage() {
  const router = useRouter()
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const scannedRef = useRef(false)
  const [status, setStatus] = useState<ScanStatus>('starting')

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
          } catch { /* scanning errors are expected */ }
        }, 300)
      } catch {
        setStatus('denied')
      }
    }

    start()
    return stopCamera
  }, [handleDetected, stopCamera])

  function handleManualEntry() {
    const code = prompt('Insira o código da mesa (ex: /restaurante?mesa=4):')
    if (!code) return
    try {
      const url = new URL(code)
      router.push(url.pathname + url.search)
    } catch {
      if (code.startsWith('/')) router.push(code)
      else alert('Código inválido. Use o formato: /restaurante?mesa=4')
    }
  }

  const isDetected = status === 'detected'
  const hasError = status === 'no-support' || status === 'denied'

  return (
    <div
      className="relative h-screen w-full flex flex-col overflow-hidden"
      style={{ background: '#060e20', color: '#dae2fd' }}
    >
      {/* Camera feed */}
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        muted
        playsInline
        aria-hidden="true"
      />
      {/* Overlay */}
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(11,19,38,0.72)', backdropFilter: 'blur(2px)' }}
      />

      {/* Header */}
      <header
        className="relative z-10 flex justify-between items-center px-6 h-16 shrink-0"
        style={{ background: 'rgba(23,31,51,0.85)', borderBottom: '1px solid rgba(88,66,55,0.4)' }}
      >
        <div className="flex items-center gap-2">
          <QomandaLogo size={28} />
          <span className="font-black text-base" style={{ fontFamily: 'Geist, sans-serif', color: '#ffffff', letterSpacing: '-0.02em' }}>Qomanda</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            className="p-2 rounded-full transition-colors"
            style={{ color: '#e0c0b1' }}
            aria-label="Dicas"
          >
            <span className="material-symbols-outlined text-[22px]">lightbulb</span>
          </button>
          <button
            className="p-2 rounded-full transition-colors"
            style={{ color: '#e0c0b1' }}
            aria-label="Carrinho"
          >
            <span className="material-symbols-outlined text-[22px]">shopping_bag</span>
          </button>
        </div>
      </header>

      {/* Scanner */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-8">
        <div className="text-center mb-10">
          <h1 className="text-2xl font-semibold mb-2">Escaneie a Mesa</h1>
          <p className="text-sm max-w-[280px] mx-auto leading-relaxed" style={{ color: '#e0c0b1' }}>
            Posicione o QR Code da mesa no quadro abaixo para começar
          </p>
        </div>

        {/* Viewfinder frame */}
        <div
          className="relative w-64 h-64"
          style={{ boxShadow: '0 0 24px rgba(249,115,22,0.18)' }}
        >
          {/* Corner brackets */}
          <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 rounded-tl-xl" style={{ borderColor: '#f97316' }} />
          <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 rounded-tr-xl" style={{ borderColor: '#f97316' }} />
          <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 rounded-bl-xl" style={{ borderColor: '#f97316' }} />
          <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 rounded-br-xl" style={{ borderColor: '#f97316' }} />

          {/* Inner area */}
          <div
            className="absolute inset-2 rounded-lg overflow-hidden flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.18)', border: '1px solid rgba(88,66,55,0.2)' }}
          >
            {status === 'scanning' && (
              <div className="scanner-laser absolute left-0 right-0 h-1 z-10" />
            )}
            {isDetected ? (
              <span
                className="material-symbols-outlined"
                style={{ fontSize: 80, color: '#f97316', fontVariationSettings: "'FILL' 1" }}
              >
                check_circle
              </span>
            ) : (
              <span
                className="material-symbols-outlined select-none"
                style={{ fontSize: 120, color: 'rgba(218,226,253,0.07)' }}
              >
                qr_code_2
              </span>
            )}
          </div>
        </div>

        {/* Status messages */}
        {isDetected && (
          <p className="mt-6 text-sm font-semibold" style={{ color: '#ffb690' }}>
            Mesa identificada! Redirecionando...
          </p>
        )}
        {hasError && (
          <p className="mt-6 text-sm text-center max-w-[260px] leading-relaxed" style={{ color: '#e0c0b1' }}>
            {status === 'no-support'
              ? 'Seu navegador não suporta scanner automático. Use a entrada manual abaixo.'
              : 'Não foi possível acessar a câmera. Verifique as permissões do navegador.'}
          </p>
        )}

        {/* Manual entry */}
        {!isDetected && (
          <div className="mt-12 w-full max-w-xs flex flex-col items-center gap-5">
            <div className="flex items-center gap-4 w-full">
              <div className="h-px flex-1" style={{ background: '#584237' }} />
              <span className="text-[11px] font-mono uppercase tracking-widest" style={{ color: '#a78b7d' }}>
                Ou
              </span>
              <div className="h-px flex-1" style={{ background: '#584237' }} />
            </div>
            <button
              onClick={handleManualEntry}
              className="w-full h-12 flex items-center justify-center gap-2 text-sm font-mono rounded-lg active:scale-95 transition-all"
              style={{ background: 'transparent', border: '1px solid #584237', color: '#dae2fd' }}
            >
              <span className="material-symbols-outlined text-[18px]">keyboard</span>
              DIGITAR CÓDIGO MANUALMENTE
            </button>
            <button
              onClick={handleManualEntry}
              className="w-full h-12 flex items-center justify-center gap-2 text-sm font-mono rounded-lg active:scale-95 transition-all"
              style={{ background: '#f97316', color: '#582200' }}
            >
              <span className="material-symbols-outlined text-[18px]">keyboard</span>
              DIGITAR CÓDIGO DA MESA
            </button>
          </div>
        )}
      </main>

      {/* Bottom nav */}
      <nav
        className="relative z-10 flex justify-around items-center h-20 px-4 shrink-0"
        style={{ background: '#171f33', borderTop: '1px solid rgba(88,66,55,0.4)' }}
      >
        <a
          href="#"
          className="flex flex-col items-center justify-center gap-0.5 p-2 rounded-xl"
          style={{ color: '#e0c0b1' }}
        >
          <span className="material-symbols-outlined">menu_book</span>
          <span className="text-[11px] font-mono">Menu</span>
        </a>
        <a
          href="/scan"
          className="flex flex-col items-center justify-center gap-0.5 rounded-full px-5 py-2"
          style={{ background: '#f97316', color: '#582200' }}
        >
          <span
            className="material-symbols-outlined"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            qr_code_scanner
          </span>
          <span className="text-[11px] font-mono">Scan</span>
        </a>
        <a
          href="#"
          className="flex flex-col items-center justify-center gap-0.5 p-2 rounded-xl"
          style={{ color: '#e0c0b1' }}
        >
          <span className="material-symbols-outlined">receipt_long</span>
          <span className="text-[11px] font-mono">Pedidos</span>
        </a>
      </nav>

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
