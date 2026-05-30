type IconProps = {
  size?: number
  className?: string
}

/** Ícone — Q circular com tail de speech bubble */
export function QomandaLogo({ size = 40, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Anel (ring) — fill-rule evenodd cria o buraco interno */}
      <path
        fill="#f97316"
        fillRule="evenodd"
        d="M46 5a41 41 0 100 82 41 41 0 000-82zm0 21a20 20 0 100 40 20 20 0 000-40z"
      />
      {/* Tail do speech bubble — triângulo no canto inferior direito */}
      <path
        fill="#f97316"
        d="M63 65 L88 88 L58 76 Z"
      />
    </svg>
  )
}

/** Wordmark — Qomanda em fonte arredondada com ícone inline */
export function QomandaWordmark({
  size = 36,
  color = '#ffffff',
  className,
}: {
  size?: number
  color?: string
  className?: string
}) {
  return (
    <svg
      height={size}
      viewBox="0 0 320 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Q icon inline */}
      <g transform="translate(0, 0) scale(0.8)">
        <path
          fill={color}
          fillRule="evenodd"
          d="M46 5a41 41 0 100 82 41 41 0 000-82zm0 21a20 20 0 100 40 20 20 0 000-40z"
        />
        <path fill={color} d="M63 65 L88 88 L58 76 Z" />
      </g>
      {/* "omanda" — texto arredondado */}
      <text
        x="75"
        y="57"
        fontFamily="'Geist', 'Nunito', 'Poppins', system-ui, sans-serif"
        fontWeight="700"
        fontSize="52"
        fill={color}
        letterSpacing="-1"
      >
        omanda
      </text>
    </svg>
  )
}
