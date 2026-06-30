'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatPhoneInput } from '@/lib/customer-form'
import { parseWaitlistContacts } from '@/lib/waitlist-contact'
import { playReadyChime } from '@/lib/ready-chime'

type Feature = { id: string; name: string; emoji: string | null; virtual?: boolean }
type Entry = {
  id: string
  featureName: string
  featureEmoji: string | null
  status: 'waiting' | 'notified' | 'seated' | 'expired' | 'cancelled'
  position: number | null
  notifiedTableNumber: string | null
  expiresAt: string | null
}

function storageKey(slug: string) { return `kicomanda_waitlist_${slug}` }
function readIds(slug: string): string[] {
  try { return JSON.parse(localStorage.getItem(storageKey(slug)) ?? '[]') } catch { return [] }
}
function writeIds(slug: string, ids: string[]) {
  localStorage.setItem(storageKey(slug), JSON.stringify(ids))
}

export default function WaitlistPage() {
  const params = useParams<{ slug: string }>()
  const slug = params.slug

  const [restaurantId, setRestaurantId] = useState('')
  const [restaurantName, setRestaurantName] = useState('')
  const [features, setFeatures] = useState<Feature[]>([])
  const [loading, setLoading] = useState(true)

  const [featureId, setFeatureId] = useState('')
  const [name, setName] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [partySize, setPartySize] = useState('2')
  const [showSecond, setShowSecond] = useState(false)
  const [secondName, setSecondName] = useState('')
  const [secondWhatsapp, setSecondWhatsapp] = useState('')
  const [joining, setJoining] = useState(false)

  const [entries, setEntries] = useState<Entry[]>([])
  const [now, setNow] = useState(Date.now())
  const notifiedSeen = useRef<Set<string>>(new Set())

  useEffect(() => {
    setName(localStorage.getItem('kicomanda_customer_name') ?? '')
    async function load() {
      const supabase = createClient()
      const { data: r } = await supabase
        .from('restaurants').select('id, name').eq('slug', slug).eq('status', 'active').maybeSingle()
      if (!r) { setLoading(false); return }
      setRestaurantId(r.id)
      setRestaurantName(r.name)
      const { data: feats } = await supabase
        .from('table_features').select('id, name, emoji').eq('restaurant_id', r.id).order('created_at')

      const featureList = (feats ?? []) as Feature[]
      const featureIds = featureList.map(f => f.id)

      // Quais features têm mesas atribuídas?
      const { data: fmap } = featureIds.length > 0
        ? await supabase.from('table_feature_map').select('feature_id').in('feature_id', featureIds)
        : { data: [] }

      const assignedFeatureIds = new Set((fmap ?? []).map((m: { feature_id: string }) => m.feature_id))

      // Mantém apenas sections com mesas cadastradas (espelha o mapa do dashboard).
      const withTables = featureList.filter(f => assignedFeatureIds.has(f.id))

      // Conta total de mesas e mesas atribuídas para detectar "Sem seção".
      const [{ count: totalTables }, { count: assignedTables }] = await Promise.all([
        supabase.from('tables').select('id', { count: 'exact', head: true }).eq('restaurant_id', r.id).is('archived_at', null),
        featureIds.length > 0
          ? supabase.from('table_feature_map').select('table_id', { count: 'exact', head: true }).in('feature_id', featureIds)
          : Promise.resolve({ count: 0 }),
      ])

      const hasUnassignedTables = (totalTables ?? 0) > (assignedTables ?? 0)

      const allSections: Feature[] = [
        ...withTables,
        ...(hasUnassignedTables ? [{ id: '', name: 'Qualquer seção', emoji: '🪑', virtual: true }] : []),
      ]

      setFeatures(allSections)
      setFeatureId(allSections[0]?.id ?? '')
      setLoading(false)
    }
    load()
  }, [slug])

  const refreshStatus = useCallback(async () => {
    const ids = readIds(slug)
    if (ids.length === 0) { setEntries([]); return }
    try {
      const res = await fetch(`/api/customer/waitlist?ids=${ids.join(',')}`)
      const data = await res.json()
      const next = (data.entries ?? []) as Entry[]
      // Avisa (som + vibração) quando uma entrada vira "pronta".
      for (const e of next) {
        if (e.status === 'notified' && !notifiedSeen.current.has(e.id)) {
          notifiedSeen.current.add(e.id)
          playReadyChime()
          toast.success(`Sua mesa ${e.notifiedTableNumber ?? ''} está pronta!`)
        }
        if (e.status !== 'notified') notifiedSeen.current.delete(e.id)
      }
      setEntries(next)
    } catch { /* ignore */ }
  }, [slug])

  useEffect(() => {
    refreshStatus()
    const poll = setInterval(refreshStatus, 5000)
    const tick = setInterval(() => setNow(Date.now()), 1000)
    return () => { clearInterval(poll); clearInterval(tick) }
  }, [refreshStatus])

  async function joinQueue() {
    if (!name.trim()) { toast.error('Informe seu nome.'); return }
    const selectedSection = features.find(f => f.id === featureId)
    if (!selectedSection) { toast.error('Escolha a seção.'); return }
    const contacts = parseWaitlistContacts({
      whatsapp,
      secondaryName: showSecond ? secondName : null,
      secondaryWhatsapp: showSecond ? secondWhatsapp : null,
    })
    if ('error' in contacts) { toast.error(contacts.error); return }
    setJoining(true)
    try {
      const customerId = localStorage.getItem('kicomanda_customer_id')
      const res = await fetch('/api/customer/waitlist', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantId, featureId: featureId || null, name: name.trim(),
          whatsapp: contacts.whatsapp,
          secondaryName: contacts.secondaryName,
          secondaryWhatsapp: contacts.whatsappSecondary,
          partySize: Number(partySize),
          customerId,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      if (data.id) writeIds(slug, [...new Set([...readIds(slug), data.id])])
      toast.success(data.alreadyInQueue ? 'Você já está na fila desta mesa.' : 'Você entrou na fila!')
      refreshStatus()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao entrar na fila.')
    } finally { setJoining(false) }
  }

  async function cancelEntry(id: string) {
    await fetch(`/api/customer/waitlist?id=${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {})
    writeIds(slug, readIds(slug).filter(x => x !== id))
    setEntries(prev => prev.filter(e => e.id !== id))
    toast.message('Você saiu da fila.')
  }

  const activeEntries = useMemo(
    () => entries.filter(e => e.status === 'waiting' || e.status === 'notified'),
    [entries],
  )
  const inQueue = activeEntries.length > 0
  const tableReady = activeEntries.some(e => e.status === 'notified')

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0D1117' }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#00E676' }} />
      </div>
    )
  }

  return (
    <div className="min-h-screen px-6 py-8 max-w-md mx-auto" style={{ background: '#0D1117', color: '#FFFFFF' }}>
      <Link href={`/${slug}`} className="text-xs font-mono" style={{ color: '#8B949E' }}>← Voltar</Link>
      <header className="mt-5 text-center">
        <span className="material-symbols-outlined text-[40px]" style={{ color: '#00E676' }}>deck</span>
        <h1 className="text-2xl font-black mt-2" style={{ fontFamily: 'Geist, sans-serif' }}>Fila de mesas</h1>
        {restaurantName && <p className="text-xs font-mono mt-1" style={{ color: '#8B949E' }}>{restaurantName}</p>}
        <p className="text-sm mt-2 leading-relaxed" style={{ color: '#e0c0b1' }}>
          Espere por uma mesa com a vista que você gosta. Avisamos aqui e no WhatsApp quando liberar.
        </p>
      </header>

      {/* Entradas ativas */}
      {activeEntries.length > 0 && (
        <div className="mt-6 space-y-3">
          {activeEntries.map(e => {
            const ready = e.status === 'notified'
            const secsLeft = ready && e.expiresAt
              ? Math.max(0, Math.floor((new Date(e.expiresAt).getTime() - now) / 1000)) : 0
            const mm = String(Math.floor(secsLeft / 60)).padStart(2, '0')
            const ss = String(secsLeft % 60).padStart(2, '0')
            return (
              <div key={e.id} className="rounded-2xl p-5"
                style={{
                  background: ready ? 'rgba(52,211,153,0.1)' : 'linear-gradient(145deg,#21262D,#161B22)',
                  border: `1px solid ${ready ? 'rgba(52,211,153,0.4)' : '#30363D'}`,
                }}>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">{e.featureEmoji} {e.featureName}</p>
                  <button onClick={() => cancelEntry(e.id)} className="text-[11px] font-mono" style={{ color: '#8B949E' }}>Sair</button>
                </div>
                {ready ? (
                  <div className="mt-3 text-center">
                    <p className="text-lg font-black" style={{ color: '#34d399', fontFamily: 'Geist, sans-serif' }}>
                      Sua mesa está pronta! {e.notifiedTableNumber ? `Mesa ${e.notifiedTableNumber}` : ''}
                    </p>
                    <p className="text-3xl font-black font-mono mt-1" style={{ color: secsLeft < 60 ? '#f87171' : '#34d399' }}>
                      {mm}:{ss}
                    </p>
                    <p className="text-xs mt-1" style={{ color: '#8B949E' }}>
                      Vá até a mesa ou escaneie o QR dela para confirmar antes do tempo acabar.
                    </p>
                    <Link href="/scan"
                      className="mt-4 flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-bold font-mono transition-all active:scale-[0.98]"
                      style={{ background: '#00E676', color: '#003319' }}>
                      <span className="material-symbols-outlined text-[20px]">qr_code_scanner</span>
                      Escanear QR da mesa
                    </Link>
                  </div>
                ) : (
                  <p className="text-sm mt-2" style={{ color: '#e0c0b1' }}>
                    Você é o <strong style={{ color: '#00E676' }}>{e.position ?? '—'}º</strong> da fila. Aguarde o aviso aqui.
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Formulário de entrada — só antes de entrar na fila */}
      {inQueue ? (
        tableReady ? null : (
          <p className="mt-8 text-center text-sm leading-relaxed" style={{ color: '#8B949E' }}>
            Você já está na fila. Quando sua mesa liberar, avisamos aqui e no WhatsApp.
          </p>
        )
      ) : features.length === 0 ? (
        <div className="mt-8 rounded-xl p-6 text-center" style={{ background: '#161B22', border: '1px dashed #30363D' }}>
          <p className="text-sm" style={{ color: '#8B949E' }}>Este restaurante ainda não tem mesas com fila de espera.</p>
        </div>
      ) : (
        <div className="mt-8 space-y-4">
          <div>
            <label className="text-[11px] font-mono uppercase tracking-wider" style={{ color: '#e0c0b1' }}>Seção</label>
            <div className="flex flex-wrap gap-2 mt-1.5">
              {features.map(f => (
                <button key={f.id} type="button" onClick={() => setFeatureId(f.id)}
                  className="px-3 py-2 rounded-lg text-sm font-mono transition-all"
                  style={{
                    background: featureId === f.id ? '#00E676' : 'transparent',
                    color: featureId === f.id ? '#003319' : '#8B949E',
                    border: `1px solid ${featureId === f.id ? '#00E676' : '#30363D'}`,
                  }}>
                  {f.emoji} {f.name}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Seu nome"
              className="h-11 px-3 rounded-lg text-sm outline-none" style={{ background: '#161B22', border: '1px solid #30363D', color: '#FFFFFF' }} />
            <input type="number" min={1} max={20} value={partySize} onChange={e => setPartySize(e.target.value)} placeholder="Pessoas"
              className="h-11 px-3 rounded-lg text-sm outline-none" style={{ background: '#161B22', border: '1px solid #30363D', color: '#FFFFFF' }} />
          </div>
          <input type="tel" inputMode="tel" value={whatsapp} onChange={e => setWhatsapp(formatPhoneInput(e.target.value))}
            placeholder="WhatsApp * — (11) 98765-4321" autoComplete="off"
            className="w-full h-11 px-3 rounded-lg text-sm outline-none font-mono"
            style={{ background: '#161B22', border: '1px solid #30363D', color: '#FFFFFF' }} />
          {!showSecond ? (
            <button type="button" onClick={() => setShowSecond(true)}
              className="text-xs font-mono text-left" style={{ color: '#58A6FF' }}>
              + Adicionar outra pessoa do grupo (opcional)
            </button>
          ) : (
            <div className="space-y-2 rounded-lg p-3" style={{ background: '#161B22', border: '1px solid #30363D' }}>
              <p className="text-[10px] font-mono uppercase tracking-wider" style={{ color: '#8B949E' }}>2ª pessoa — também recebe aviso</p>
              <input value={secondName} onChange={e => setSecondName(e.target.value)} placeholder="Nome (opcional)"
                className="w-full h-10 px-3 rounded-lg text-sm outline-none" style={{ background: '#0D1117', border: '1px solid #30363D', color: '#FFFFFF' }} />
              <input type="tel" inputMode="tel" value={secondWhatsapp} onChange={e => setSecondWhatsapp(formatPhoneInput(e.target.value))}
                placeholder="WhatsApp da 2ª pessoa" className="w-full h-10 px-3 rounded-lg text-sm outline-none font-mono"
                style={{ background: '#0D1117', border: '1px solid #30363D', color: '#FFFFFF' }} />
            </div>
          )}
          <button onClick={joinQueue} disabled={joining || !whatsapp.trim()}
            className="w-full py-4 rounded-xl text-base font-bold flex items-center justify-center gap-2 active:scale-[0.97] disabled:opacity-50"
            style={{ background: '#00E676', color: '#003319' }}>
            {joining ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Entrar na fila <span className="material-symbols-outlined">hourglass_top</span></>}
          </button>
        </div>
      )}
    </div>
  )
}
