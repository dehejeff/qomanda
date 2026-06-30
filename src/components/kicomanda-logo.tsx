import Image from 'next/image'

export const KICOMANDA_GREEN = '#00E676'
export const KICOMANDA_NAVY  = '#0D1117'

type IconProps = {
  size?:      number
  className?: string
}

/** Mascote KiComanda */
export function KiComandaLogo({ size = 40, className }: IconProps) {
  return (
    <Image
      src="/Mascotinho/comandinha-mascote.png"
      alt="KiComanda"
      width={size}
      height={size}
      className={className ?? 'shrink-0'}
      priority={size >= 56}
      style={{ objectFit: 'contain' }}
    />
  )
}

type TextProps = {
  fontSize?:  number
  className?: string
}

/** "KiComanda" branco + "." verde — use dentro de wordmarks */
export function KiComandaText({ fontSize = 16, className }: TextProps) {
  return (
    <span
      className={`font-black leading-none select-none ${className ?? ''}`}
      style={{ fontFamily: 'Geist, sans-serif', fontSize, letterSpacing: '-0.02em', color: '#FFFFFF' }}
    >
      KiComanda<span style={{ color: KICOMANDA_GREEN }}>.</span>
    </span>
  )
}

type WordmarkProps = {
  size?:      number
  className?: string
}

/** Lockup horizontal: mascote + "KiComanda." */
export function KiComandaWordmark({ size = 36, className }: WordmarkProps) {
  return (
    <div
      className={`inline-flex items-center gap-2 ${className ?? ''}`}
      role="img"
      aria-label="KiComanda"
    >
      <KiComandaLogo size={Math.round(size * 0.9)} />
      <KiComandaText fontSize={size} />
    </div>
  )
}

/** @deprecated use KiComandaLogo */
export const QomandaLogo = KiComandaLogo
/** @deprecated use KiComandaWordmark */
export const QomandaWordmark = KiComandaWordmark
/** @deprecated use KICOMANDA_GREEN */
export const KICOMANDA_ORANGE       = KICOMANDA_GREEN
export const KICOMANDA_ORANGE_LIGHT = KICOMANDA_GREEN
export const KICOMANDA_LOGO = { default: '/Mascotinho/comandinha-mascote.png' } as const
export type KiComandaLogoVariant = 'default'
