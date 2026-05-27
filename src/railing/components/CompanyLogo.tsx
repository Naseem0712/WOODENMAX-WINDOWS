import { useState } from 'react'

const LOGO_CANDIDATES = ['/logo.jpg', '/logo.png'] as const

interface Props {
  size?: number
  className?: string
}

export function CompanyLogo({ size = 72, className = '' }: Props) {
  const [srcIdx, setSrcIdx] = useState(0)
  const src = LOGO_CANDIDATES[srcIdx] ?? LOGO_CANDIDATES[0]

  return (
    <img
      src={src}
      alt="WoodenMax Architectural Elements"
      width={size}
      height={size}
      className={`company-logo-img ${className}`.trim()}
      style={{ width: size, height: 'auto', maxHeight: size }}
      onError={() => {
        setSrcIdx((i) => (i < LOGO_CANDIDATES.length - 1 ? i + 1 : i))
      }}
    />
  )
}
