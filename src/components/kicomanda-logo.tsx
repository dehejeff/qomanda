import Image from 'next/image'

/** Cores laranja da marca (globals.css) */
export const KICOMANDA_ORANGE = '#f97316'
export const KICOMANDA_ORANGE_LIGHT = '#ffb690'
export const KICOMANDA_NAVY = '#0b1326'

/** Arquivos em public/brand/ */
export const KICOMANDA_LOGO = {
  /** Logo oficial — fundo laranja + K branco */
  default: '/brand/logo.png',
  orangeWhite: '/brand/logo-orange-bg-k-white.png',
  /** Alternativas */
  navy: '/brand/logo-navy-bg-k-orange.png',
  orangeNavy: '/brand/logo-orange-bg-k-navy.png',
  icon: '/brand/logo-icon.png',
} as const

export type KiComandaLogoVariant = keyof typeof KICOMANDA_LOGO

/** PNG tem margem interna — escala unifica o tamanho visual em todo o app */
const LOGO_DISPLAY_SCALE = 1.2

type IconProps = {
  size?: number
  className?: string
  variant?: KiComandaLogoVariant
}

/** Ícone KiComanda (PNG oficial) */
export function KiComandaLogo({
  size = 40,
  className,
  variant = 'default',
}: IconProps) {
  const src = KICOMANDA_LOGO[variant]
  const px = Math.round(size * LOGO_DISPLAY_SCALE)
  return (
    <Image
      src={src}
      alt="KiComanda"
      width={px}
      height={px}
      className={className ?? 'shrink-0'}
      priority={px >= 56}
    />
  )
}

/** @deprecated use KiComandaLogo */
export const QomandaLogo = KiComandaLogo

type WordmarkProps = {
  size?: number
  color?: string
  variant?: KiComandaLogoVariant
  className?: string
}

/** Wordmark — ícone + “iComanda” */
export function KiComandaWordmark({
  size = 36,
  color = '#ffffff',
  variant = 'default',
  className,
}: WordmarkProps) {
  const iconSize = Math.round(size * 0.95)
  return (
    <div
      className={`inline-flex items-center gap-2.5 ${className ?? ''}`}
      role="img"
      aria-label="KiComanda"
    >
      <KiComandaLogo size={iconSize} variant={variant} />
      <span
        className="font-black leading-none"
        style={{
          fontFamily: 'Geist, sans-serif',
          fontSize: size * 0.95,
          color,
          letterSpacing: '-0.02em',
        }}
      >
        iComanda
      </span>
    </div>
  )
}

/** @deprecated use KiComandaWordmark */
export const QomandaWordmark = KiComandaWordmark
