import Image from 'next/image';
import Link from 'next/link';

export type BrandMarkProps = {
  className?: string;
  href?: string;
  tone?: 'default' | 'light';
  compact?: boolean;
  preload?: boolean;
};

export default function BrandMark({
  className = '',
  href = '/',
  tone = 'default',
  compact = false,
  preload = false,
}: BrandMarkProps) {
  return (
    <Link
      href={href}
      className={`brand-mark brand-mark-${tone}${compact ? ' brand-mark-compact' : ''}${className ? ` ${className}` : ''}`}
      aria-label="Captain 97.1 home"
    >
      <Image
        className="brand-mark-image"
        src="/captain97-logo.png"
        width={1089}
        height={644}
        sizes="(max-width: 640px) 128px, 230px"
        alt=""
        preload={preload}
        unoptimized
      />
    </Link>
  );
}
