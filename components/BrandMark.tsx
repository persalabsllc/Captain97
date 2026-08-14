import Link from 'next/link';
import Icon from './Icon';

export type BrandMarkProps = {
  className?: string;
  href?: string;
  tone?: 'default' | 'light';
  compact?: boolean;
};

export default function BrandMark({
  className = '',
  href = '/',
  tone = 'default',
  compact = false,
}: BrandMarkProps) {
  return (
    <Link
      href={href}
      className={`brand-mark brand-mark-${tone}${compact ? ' brand-mark-compact' : ''}${className ? ` ${className}` : ''}`}
      aria-label="Captain 97.1 home"
    >
      <span className="brand-mark-anchor" aria-hidden="true"><Icon name="anchor" size={30} /></span>
      <span className="brand-mark-lockup" aria-hidden="true">
        <span className="brand-mark-name">Captain</span>
        <strong className="brand-mark-frequency">97</strong>
        <span className="brand-mark-tagline">Carolina&apos;s Dock Rock</span>
      </span>
    </Link>
  );
}

