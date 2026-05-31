'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, useCallback, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { QomandaLogo } from '@/components/qomanda-logo'
import { HubBottomNav } from '@/components/customer/hub-bottom-nav'
import { TestTableCheckInLink } from '@/components/customer/test-table-checkin-link'

type ScanStatus = 'starting' | 'scanning' | 'detected' | 'no-support' | 'denied'

export default function ScanPage() {
  const router = useRouter()
  const videoRef   = useRef<HTMLVideoElement>(null)
  const streamRef  = useRef<MediaStream | null>(null)
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
        const hasToken = url.searchParams.has('t')
        const hasMesa = url.searchParams.has('mesa')
        if (!hasToken || !hasMesa) {
          scannedRef.current = false
          setStatus('scanning')
          return
        }
        router.push(url.pathname + url.search)
      } catch {
        if (rawValue.startsWith('/') && rawValue.includes('t=') && rawValue.includes('mesa=')) {
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

  const isDetected = status === 'detected'
  const hasError   = status === 'no-support' || status === 'denied'

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
            Posicione o QR Code fixado na mesa do restaurante para fazer check-in com segurança
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
          <div className="mt-6 text-center max-w-[280px] space-y-3">
            <p className="text-sm leading-relaxed" style={{ color: '#e0c0b1' }}>
              {status === 'no-support'
                ? 'Seu navegador não suporta scanner de QR Code.'
                : 'Permita o acesso à câmera para escanear o QR da mesa.'}
            </p>
            <p className="text-xs font-mono leading-relaxed px-4 py-3 rounded-xl"
              style={{ background: '#131b2e', border: '1px solid #584237', color: '#a78b7d' }}>
              Por segurança, não é possível entrar digitando apenas o número da mesa. Use o QR fixado no restaurante.
            </p>
          </div>
        )}

        {!isDetected && !hasError && (
          <div className="mt-10">
            <TestTableCheckInLink />
          </div>
        )}
        {hasError && (
          <div className="mt-6">
            <TestTableCheckInLink />
          </div>
        )}
      </main>

      {/* Bottom nav */}
      <Suspense fallback={null}>
        <HubBottomNav active="scan" />
      </Suspense>

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
