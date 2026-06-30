'use client'

import { useRef, useEffect } from 'react'

type Props = {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  autoFocus?: boolean
  length?: 4 | 6
}

export function PinInput({ value, onChange, disabled, autoFocus, length = 4 }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const digits = value.replace(/\D/g, '').slice(0, length).split('')
  while (digits.length < length) digits.push('')

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus()
  }, [autoFocus])

  const boxClass = length === 6
    ? 'w-10 h-12 rounded-xl flex items-center justify-center text-lg font-bold font-mono transition-colors'
    : 'w-12 h-14 rounded-xl flex items-center justify-center text-xl font-bold font-mono transition-colors'

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="password"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={length}
        value={value.replace(/\D/g, '').slice(0, length)}
        onChange={e => onChange(e.target.value.replace(/\D/g, '').slice(0, length))}
        disabled={disabled}
        autoComplete="one-time-code"
        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
        aria-label={length === 6 ? 'Senha de 6 dígitos' : 'PIN de 4 dígitos'}
      />
      <div className={`flex justify-center gap-2 ${length === 6 ? 'flex-wrap max-w-[280px] mx-auto' : 'gap-3'}`}>
        {digits.map((d, i) => (
          <div
            key={i}
            className={boxClass}
            style={{
              background: '#0D1117',
              border: `2px solid ${d ? '#00E676' : '#30363D'}`,
              color: '#FFFFFF',
            }}
          >
            {d ? '•' : ''}
          </div>
        ))}
      </div>
    </div>
  )
}
