type BrandLogoProps = {
  className?: string;
  decorative?: boolean;
};

export function BrandLogo({ className = '', decorative = false }: BrandLogoProps) {
  return <img
    className={`brand-logo ${className}`.trim()}
    src="/shreedevi-security-logo.png"
    alt={decorative ? '' : 'Shreedevi Security'}
    aria-hidden={decorative || undefined}
    width={2048}
    height={2048}
    decoding="async"
  />;
}
