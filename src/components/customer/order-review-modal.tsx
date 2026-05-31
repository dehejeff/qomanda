'use client'

import { useState } from 'react'
import type { CartItem } from '@/types'
import { formatCurrency } from '@/lib/utils'
import { menuItemEffectivePrice } from '@/lib/menu-item-pricing'
import { Loader2 } from 'lucide-react'

type Props = {
  cart: CartItem[]
  notes: Record<string, string>
  total: number
  itemCount: number
  placing: boolean
  onClose: () => void
  onConfirm: () => void
  onUpdateQuantity: (itemId: string, delta: number) => void
  onRemoveItem: (itemId: string) => void
  onUpdateNote: (itemId: string, note: string) => void
}

export function OrderReviewModal({
  cart,
  notes,
  total,
  itemCount,
  placing,
  onClose,
  onConfirm,
  onUpdateQuantity,
  onRemoveItem,
  onUpdateNote,
}: Props) {
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [draftNote, setDraftNote] = useState('')

  function startEditNote(itemId: string) {
    setEditingNoteId(itemId)
    setDraftNote(notes[itemId] ?? '')
  }

  function saveNote(itemId: string) {
    onUpdateNote(itemId, draftNote.trim())
    setEditingNoteId(null)
    setDraftNote('')
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center"
      style={{ background: 'rgba(11,19,38,0.75)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg max-h-[92vh] flex flex-col rounded-t-2xl sm:rounded-2xl overflow-hidden"
        style={{ background: '#131b2e', border: '1px solid #334155', boxShadow: '0 -8px 40px rgba(0,0,0,0.5)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ borderBottom: '1px solid #334155' }}>
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: '#a78b7d' }}>Revisar pedido</p>
            <h2 className="text-lg font-bold" style={{ fontFamily: 'Geist, sans-serif', color: '#ffb690' }}>
              {itemCount} {itemCount === 1 ? 'item' : 'itens'} · {formatCurrency(total)}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-full flex items-center justify-center transition-colors"
            style={{ background: '#1e293b', border: '1px solid #334155', color: '#a78b7d' }}
            aria-label="Continuar comprando"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {cart.length === 0 ? (
            <p className="text-center text-sm py-8 font-mono" style={{ color: '#a78b7d' }}>
              Seu carrinho está vazio.
            </p>
          ) : (
            cart.map(({ menu_item: item, quantity }) => {
              const unit = menuItemEffectivePrice(item)
              return (
              <div
                key={item.id}
                className="rounded-xl p-4 space-y-3"
                style={{ background: 'rgba(30,41,59,0.6)', border: '1px solid #334155' }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold leading-tight" style={{ fontFamily: 'Geist, sans-serif' }}>
                      {item.name}
                    </p>
                    <p className="text-xs font-mono mt-0.5" style={{ color: '#ffb690' }}>
                      {formatCurrency(unit)} · {formatCurrency(unit * quantity)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <div
                      className="flex items-center rounded-full p-0.5"
                      style={{ background: '#2d3449', border: '1px solid rgba(88,66,55,0.3)' }}
                    >
                      <button
                        type="button"
                        onClick={() => onUpdateQuantity(item.id, -1)}
                        className="w-9 h-9 flex items-center justify-center rounded-full active:scale-90"
                        style={{ color: '#f97316' }}
                      >
                        <span className="material-symbols-outlined text-[18px]">remove</span>
                      </button>
                      <span className="px-2 text-sm font-mono font-bold min-w-[28px] text-center" style={{ color: '#ffb690' }}>
                        {quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => onUpdateQuantity(item.id, 1)}
                        className="w-9 h-9 flex items-center justify-center rounded-full active:scale-95"
                        style={{ background: '#f97316', color: '#582200' }}
                      >
                        <span className="material-symbols-outlined text-[18px]">add</span>
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemoveItem(item.id)}
                      className="w-9 h-9 flex items-center justify-center rounded-full ml-1"
                      style={{ color: '#f87171', background: 'rgba(248,113,113,0.1)' }}
                      aria-label="Remover item"
                    >
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                  </div>
                </div>

                {/* Observação por item */}
                {editingNoteId === item.id ? (
                  <div className="space-y-2">
                    <input
                      autoFocus
                      type="text"
                      placeholder="ex: sem cebola, ponto bem passado…"
                      value={draftNote}
                      onChange={e => setDraftNote(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') saveNote(item.id) }}
                      className="w-full h-11 px-3 rounded-xl text-sm outline-none font-mono"
                      style={{ background: '#0b1326', border: '1px solid #f97316', color: '#dae2fd' }}
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => { setEditingNoteId(null); setDraftNote('') }}
                        className="flex-1 h-11 rounded-xl text-sm font-mono font-medium transition-colors"
                        style={{ border: '1px solid #334155', color: '#a78b7d' }}
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={() => saveNote(item.id)}
                        className="flex-1 h-11 rounded-xl text-sm font-bold font-mono flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                        style={{ background: '#34d399', color: '#064e3b' }}
                      >
                        <span className="material-symbols-outlined text-[20px]">check</span>
                        Salvar observação
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => startEditNote(item.id)}
                    className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-left text-xs font-mono transition-colors"
                    style={{
                      background: notes[item.id] ? 'rgba(249,115,22,0.08)' : '#0b1326',
                      border: notes[item.id] ? '1px solid rgba(249,115,22,0.35)' : '1px dashed #584237',
                      color: notes[item.id] ? '#ffb690' : '#a78b7d',
                    }}
                  >
                    <span className="material-symbols-outlined text-[18px] shrink-0">
                      {notes[item.id] ? 'edit_note' : 'add_comment'}
                    </span>
                    <span className="line-clamp-2">
                      {notes[item.id] || 'Toque para adicionar observação'}
                    </span>
                  </button>
                )}
              </div>
            )})
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 px-5 py-4 space-y-3" style={{ borderTop: '1px solid #334155', background: '#0b1326' }}>
          <div className="flex justify-between items-center">
            <span className="text-sm font-mono" style={{ color: '#a78b7d' }}>Total do pedido</span>
            <span className="text-xl font-bold" style={{ color: '#ffb690', fontFamily: 'Geist, sans-serif' }}>
              {formatCurrency(total)}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-full h-11 rounded-xl text-sm font-mono font-medium transition-colors"
            style={{ border: '1px solid #334155', color: '#dae2fd' }}
          >
            Continuar comprando
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={placing || cart.length === 0}
            className="w-full h-12 rounded-xl text-sm font-bold font-mono flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50"
            style={{ background: '#f97316', color: '#582200', boxShadow: '0 8px 24px rgba(249,115,22,0.3)' }}
          >
            {placing ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <span className="material-symbols-outlined text-[20px]">restaurant</span>
                Enviar para a cozinha
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
