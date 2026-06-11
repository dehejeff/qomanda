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

type Feature = { id: string; name: string; emoji: string | null }
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
      setFeatures((feats ?? []) as Feature[])
      setFeatureId((feats ?? [])[0]?.id ?? '')
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
    if (!featureId) { toast.error('Escolha a seção.'); return }
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
          restaurantId, featureId, name: name.trim(),
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0b1326' }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#f97316' }} />
      </div>
    )
  }

  return (
    <div className="min-h-screen px-6 py-8 max-w-md mx-auto" style={{ background: '#0b1326', color: '#dae2fd' }}>
      <Link href={`/${slug}`} className="text-xs font-mono" style={{ color: '#a78b7d' }}>← Voltar</Link>
      <header className="mt-5 text-center">
        <span className="material-symbols-outlined text-[40px]" style={{ color: '#f97316' }}>deck</span>
        <h1 className="text-2xl font-black mt-2" style={{ fontFamily: 'Geist, sans-serif' }}>Fila de mesas</h1>
        {restaurantName && <p className="text-xs font-mono mt-1" style={{ color: '#a78b7d' }}>{restaurantName}</p>}
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
                  background: ready ? 'rgba(52,211,153,0.1)' : 'linear-gradient(145deg,#1e293b,#131b2e)',
                  border: `1px solid ${ready ? 'rgba(52,211,153,0.4)' : '#334155'}`,
                }}>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">{e.featureEmoji} {e.featureName}</p>
                  <button onClick={() => cancelEntry(e.id)} className="text-[11px] font-mono" style={{ color: '#a78b7d' }}>Sair</button>
                </div>
                {ready ? (
                  <div className="mt-3 text-center">
                    <p className="text-lg font-black" style={{ color: '#34d399', fontFamily: 'Geist, sans-serif' }}>
                      Sua mesa está pronta! {e.notifiedTableNumber ? `Mesa ${e.notifiedTableNumber}` : ''}
                    </p>
                    <p className="text-3xl font-black font-mono mt-1" style={{ color: secsLeft < 60 ? '#f87171' : '#34d399' }}>
                      {mm}:{ss}
                    </p>
                    <p className="text-xs mt-1" style={{ color: '#a78b7d' }}>
                      Vá até a mesa ou escaneie o QR dela para confirmar antes do tempo acabar.
                    </p>
                  </div>
                ) : (
                  <p className="text-sm mt-2" style={{ color: '#e0c0b1' }}>
                    Você é o <strong style={{ color: '#ffb690' }}>{e.position ?? '—'}º</strong> da fila. Aguarde o aviso aqui.
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Formulário de entrada */}
      {features.length === 0 ? (
        <div className="mt-8 rounded-xl p-6 text-center" style={{ background: '#131b2e', border: '1px dashed #334155' }}>
          <p className="text-sm" style={{ color: '#a78b7d' }}>Este restaurante ainda não tem mesas com fila de espera.</p>
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
                    background: featureId === f.id ? '#f97316' : 'transparent',
                    color: featureId === f.id ? '#582200' : '#a78b7d',
                    border: `1px solid ${featureId === f.id ? '#f97316' : '#334155'}`,
                  }}>
                  {f.emoji} {f.name}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Seu nome"
              className="h-11 px-3 rounded-lg text-sm outline-none" style={{ background: '#131b2e', border: '1px solid #334155', color: '#dae2fd' }} />
            <input type="number" min={1} max={20} value={partySize} onChange={e => setPartySize(e.target.value)} placeholder="Pessoas"
              className="h-11 px-3 rounded-lg text-sm outline-none" style={{ background: '#131b2e', border: '1px solid #334155', color: '#dae2fd' }} />
          </div>
          <input type="tel" inputMode="tel" value={whatsapp} onChange={e => setWhatsapp(formatPhoneInput(e.target.value))}
            placeholder="WhatsApp * — (11) 98765-4321" autoComplete="off"
            className="w-full h-11 px-3 rounded-lg text-sm outline-none font-mono"
            style={{ background: '#131b2e', border: '1px solid #334155', color: '#dae2fd' }} />
          {!showSecond ? (
            <button type="button" onClick={() => setShowSecond(true)}
              className="text-xs font-mono text-left" style={{ color: '#7bd0ff' }}>
              + Adicionar outra pessoa do grupo (opcional)
            </button>
          ) : (
            <div className="space-y-2 rounded-lg p-3" style={{ background: '#131b2e', border: '1px solid #334155' }}>
              <p className="text-[10px] font-mono uppercase tracking-wider" style={{ color: '#a78b7d' }}>2ª pessoa — também recebe aviso</p>
              <input value={secondName} onChange={e => setSecondName(e.target.value)} placeholder="Nome (opcional)"
                className="w-full h-10 px-3 rounded-lg text-sm outline-none" style={{ background: '#0b1326', border: '1px solid #334155', color: '#dae2fd' }} />
              <input type="tel" inputMode="tel" value={secondWhatsapp} onChange={e => setSecondWhatsapp(formatPhoneInput(e.target.value))}
                placeholder="WhatsApp da 2ª pessoa" className="w-full h-10 px-3 rounded-lg text-sm outline-none font-mono"
                style={{ background: '#0b1326', border: '1px solid #334155', color: '#dae2fd' }} />
            </div>
          )}
          <button onClick={joinQueue} disabled={joining || !whatsapp.trim()}
            className="w-full py-4 rounded-xl text-base font-bold flex items-center justify-center gap-2 active:scale-[0.97] disabled:opacity-50"
            style={{ background: '#f97316', color: '#582200' }}>
            {joining ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Entrar na fila <span className="material-symbols-outlined">hourglass_top</span></>}
          </button>
        </div>
      )}
    </div>
  )
}
