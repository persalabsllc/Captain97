'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { navigation, siteConfig } from '@/lib/site';
import BrandMark from './BrandMark';
import Icon from './Icon';
import { ListenButton } from './StationPlayer';

export default function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const menuId = useId();
  const firstLinkRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    firstLinkRef.current?.focus();

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [menuOpen]);

  return (
    <header className="site-header">
      <div className="container header-inner">
        <BrandMark preload />
        <nav className="main-nav" aria-label="Main navigation">
          {navigation.map((item) => (
            <Link href={item.href} key={item.href} aria-current={pathname === item.href ? 'page' : undefined}>
              {item.label}
            </Link>
          ))}
        </nav>
        <ListenButton className="btn btn-primary btn-shimmer header-listen"><span className="status-dot header-live-dot" aria-hidden="true" />Listen live</ListenButton>
        <button
          type="button"
          className="mobile-menu-toggle"
          aria-expanded={menuOpen}
          aria-controls={menuId}
          aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <Icon name={menuOpen ? 'close' : 'menu'} size={24} />
        </button>
      </div>

      <div id={menuId} className={`mobile-menu${menuOpen ? ' is-open' : ''}`} aria-hidden={!menuOpen}>
        <nav aria-label="Mobile navigation">
          {navigation.map((item, index) => (
            <Link
              ref={index === 0 ? firstLinkRef : undefined}
              href={item.href}
              key={item.href}
              aria-current={pathname === item.href ? 'page' : undefined}
              tabIndex={menuOpen ? 0 : -1}
              onClick={() => setMenuOpen(false)}
            >
              <span>{item.label}</span><Icon name="arrow-right" size={18} />
            </Link>
          ))}
        </nav>
        <div className="mobile-menu-meta">
          <span>{siteConfig.callSign} · {siteConfig.frequency}</span>
          <a href={siteConfig.phone.href} tabIndex={menuOpen ? 0 : -1}>{siteConfig.phone.display}</a>
        </div>
      </div>
    </header>
  );
}
