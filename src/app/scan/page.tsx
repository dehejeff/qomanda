'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, useCallback, Suspense } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { QomandaLogo } from '@/components/qomanda-logo'
import { HubBottomNav } from '@/components/customer/hub-bottom-nav'
import { TestTableCheckInLink } from '@/components/customer/test-table-checkin-link'
import {
  isMobileSafariLike,
  parseCheckInTargetFromQr,
  resolveCheckInAbsoluteUrl,
} from '@/lib/table-checkin-url'

type ScanStatus = 'starting' | 'scanning' | 'detected' | 'invalid' | 'denied'

const SCANNER_ID = 'qomanda-qr-reader'

export default function ScanPage() {
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const scannedRef = useRef(false)
  const startScannerRef = useRef<(() => Promise<void>) | null>(null)

  const [status, setStatus] = useState<ScanStatus>('starting')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null)
  const [tableLabel, setTableLabel] = useState<string | null>(null)

  const stopScanner = useCallback(async () => {
    const scanner = scannerRef.current
    scannerRef.current = null
    if (!scanner) return
    try {
      if (scanner.isScanning) await scanner.stop()
      scanner.clear()
    } catch {
      /* ignore cleanup errors */
    }
  }, [])

  const resetScan = useCallback(async (message?: string) => {
    scannedRef.current = false
    setRedirectUrl(null)
    setTableLabel(null)
    setErrorMessage(message ?? null)
    setStatus(message ? 'invalid' : 'starting')
    await stopScanner()
    await startScannerRef.current?.()
  }, [stopScanner])

  const onQrDecoded = useCallback(async (rawValue: string) => {
    if (scannedRef.current) return
    scannedRef.current = true
    await stopScanner()

    const path = parseCheckInTargetFromQr(rawValue)
    if (!path) {
      await resetScan('QR Code inválido. Use o cartão com QR fixado na mesa do restaurante.')
      return
    }

    const absoluteUrl = resolveCheckInAbsoluteUrl(path)
    const mesa = new URL(absoluteUrl).searchParams.get('mesa')
    setTableLabel(mesa)
    setRedirectUrl(absoluteUrl)
    setStatus('detected')
    setErrorMessage(null)
    if ('vibrate' in navigator) navigator.vibrate(200)

    // iOS bloqueia redirect automático após câmera — exige toque no botão.
    if (!isMobileSafariLike()) {
      window.setTimeout(() => {
        window.location.href = absoluteUrl
      }, 300)
    }
  }, [stopScanner, resetScan])

  useEffect(() => {
    async function start() {
      try {
        await stopScanner()
        const scanner = new Html5Qrcode(SCANNER_ID, { verbose: false })
        scannerRef.current = scanner

        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 240, height: 240 }, aspectRatio: 1 },
          decoded => { void onQrDecoded(decoded) },
          () => {},
        )
        setStatus('scanning')
        setErrorMessage(null)
      } catch {
        setStatus('denied')
      }
    }

    startScannerRef.current = start
    start()
    return () => { void stopScanner() }
  }, [onQrDecoded, stopScanner])

  const isDetected = status === 'detected'
  const hasError = status === 'denied' || status === 'invalid'

  return (
    <div className="relative h-[100dvh] w-full flex flex-col overflow-hidden"
      style={{ background: '#060e20', color: '#dae2fd' }}>

      <div
        id={SCANNER_ID}
        className="absolute inset-0 z-0 [&>video]:object-cover [&>video]:w-full [&>video]:h-full"
        aria-hidden={isDetected}
      />
      <div className="absolute inset-0 z-[1]"
        style={{ background: 'rgba(11,19,38,0.55)', backdropFilter: 'blur(1px)' }} />

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

      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-6 pb-28">
        {!isDetected && (
          <div className="text-center mb-6">
            <h1 className="text-2xl font-semibold mb-2">Escaneie a Mesa</h1>
            <p className="text-sm max-w-[280px] mx-auto leading-relaxed" style={{ color: '#e0c0b1' }}>
              Aponte para o QR Code fixado na mesa. No iPhone, toque em &quot;Entrar na mesa&quot; após a leitura.
            </p>
          </div>
        )}

        {!isDetected && status === 'scanning' && (
          <div className="relative w-64 h-64 pointer-events-none" style={{ boxShadow: '0 0 24px rgba(249,115,22,0.18)' }}>
            <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 rounded-tl-xl" style={{ borderColor: '#f97316' }} />
            <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 rounded-tr-xl" style={{ borderColor: '#f97316' }} />
            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 rounded-bl-xl" style={{ borderColor: '#f97316' }} />
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 rounded-br-xl" style={{ borderColor: '#f97316' }} />
            <div className="absolute inset-2 rounded-lg overflow-hidden">
              <div className="scanner-laser absolute left-0 right-0 h-1 z-10" />
            </div>
          </div>
        )}

        {isDetected && redirectUrl && (
          <div className="text-center space-y-5 max-w-[320px] w-full">
            <span className="material-symbols-outlined block mx-auto"
              style={{ fontSize: 72, color: '#f97316', fontVariationSettings: "'FILL' 1" }}>check_circle</span>
            <div>
              <h2 className="text-xl font-semibold">Mesa {tableLabel ?? ''} identificada</h2>
              <p className="text-sm mt-2 leading-relaxed" style={{ color: '#e0c0b1' }}>
                {isMobileSafariLike()
                  ? 'Toque no botão abaixo para abrir o restaurante.'
                  : 'Abrindo o restaurante… se não redirecionar, toque no botão.'}
              </p>
            </div>
            <a
              href={redirectUrl}
              className="flex items-center justify-center gap-2 w-full h-14 rounded-xl text-base font-bold active:scale-[0.98] transition-transform"
              style={{ background: '#f97316', color: '#fff' }}
            >
              Entrar na mesa
            </a>
          </div>
        )}

        {status === 'invalid' && errorMessage && (
          <div className="text-center max-w-[300px] space-y-3">
            <p className="text-sm leading-relaxed" style={{ color: '#fca5a5' }}>{errorMessage}</p>
            <button type="button" onClick={() => resetScan()}
              className="w-full h-11 rounded-xl text-sm font-mono font-bold"
              style={{ background: '#131b2e', border: '1px solid #584237', color: '#ffb690' }}>
              Escanear novamente
            </button>
          </div>
        )}

        {status === 'denied' && (
          <div className="text-center max-w-[280px] space-y-3">
            <p className="text-sm leading-relaxed" style={{ color: '#e0c0b1' }}>
              Permita o acesso à câmera nas configurações do navegador para escanear o QR da mesa.
            </p>
            <p className="text-xs font-mono leading-relaxed px-4 py-3 rounded-xl"
              style={{ background: '#131b2e', border: '1px solid #584237', color: '#a78b7d' }}>
              Alternativa: abra a câmera do celular e aponte para o QR — o link abre direto no navegador.
            </p>
          </div>
        )}

        {!isDetected && !hasError && status !== 'starting' && (
          <div className="mt-8 w-full max-w-sm">
            <TestTableCheckInLink />
          </div>
        )}
        {hasError && (
          <div className="mt-6 w-full max-w-sm">
            <TestTableCheckInLink />
          </div>
        )}
      </main>

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
        #${SCANNER_ID} img[alt="Info icon"] { display: none !important; }
      `}</style>
    </div>
  )
}
