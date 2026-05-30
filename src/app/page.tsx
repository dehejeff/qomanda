import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white p-8">
      <div className="text-center space-y-6 max-w-md">
        <div className="text-6xl font-black tracking-tight">
          <span className="text-orange-500">Q</span>omanda
        </div>
        <p className="text-slate-400 text-lg">
          Cardápio digital e pagamento inteligente para restaurantes e bares.
        </p>
        <div className="flex flex-col gap-3 pt-4">
          <Link
            href="/dashboard"
            className="bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
          >
            Acessar Painel do Restaurante
          </Link>
          <p className="text-slate-500 text-sm">
            Cliente? Escaneie o QR Code na sua mesa.
          </p>
        </div>
      </div>
    </main>
  )
}
