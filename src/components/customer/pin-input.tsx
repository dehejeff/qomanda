'use client'

import { useRef, useEffect } from 'react'

type Props = {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  autoFocus?: boolean
}

export function PinInput({ value, onChange, disabled, autoFocus }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const digits = value.replace(/\D/g, '').slice(0, 4).split('')
  while (digits.length < 4) digits.push('')

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus()
  }, [autoFocus])

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="password"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={4}
        value={value.replace(/\D/g, '').slice(0, 4)}
        onChange={e => onChange(e.target.value.replace(/\D/g, '').slice(0, 4))}
        disabled={disabled}
        autoComplete="one-time-code"
        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
        aria-label="PIN de 4 dígitos"
      />
      <div className="flex justify-center gap-3">
        {digits.map((d, i) => (
          <div
            key={i}
            className="w-12 h-14 rounded-xl flex items-center justify-center text-xl font-bold font-mono transition-colors"
            style={{
              background: '#0b1326',
              border: `2px solid ${d ? '#f97316' : '#584237'}`,
              color: '#dae2fd',
            }}
          >
            {d ? '•' : ''}
          </div>
        ))}
      </div>
    </div>
  )
}
