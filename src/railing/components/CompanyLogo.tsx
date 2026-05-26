const LOGO_SRC = '/logo.png'

interface Props {
  size?: number
  className?: string
}

export function CompanyLogo({ size = 72, className = '' }: Props) {
  return (
    <img
      src={LOGO_SRC}
      alt="WoodenMax Architectural Elements"
      width={size}
      height={size}
      className={`company-logo-img ${className}`.trim()}
      style={{ width: size, height: 'auto', maxHeight: size }}
    />
  )
}
