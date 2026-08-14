import Link from 'next/link';
import { navigation, siteConfig } from '@/lib/site';
import BrandMark from './BrandMark';
import Icon, { type IconName } from './Icon';
import { ListenButton } from './StationPlayer';

const socialIcons: Record<string, IconName> = {
  Facebook: 'facebook',
  Instagram: 'instagram',
  Live365: 'radio',
};

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-glow" aria-hidden="true" />
      <div className="container footer-grid">
        <div className="footer-brand">
          <BrandMark tone="light" />
          <p>{siteConfig.description}</p>
          <ListenButton className="btn btn-primary footer-listen"><Icon name="play" size={17} />Listen live</ListenButton>
        </div>

        <nav className="footer-nav footer-column footer-links" aria-label="Footer navigation">
          <h3>Explore</h3>
          {navigation.map((item) => <Link href={item.href} key={item.href}>{item.label}</Link>)}
        </nav>

        <div className="footer-contact footer-column">
          <h3>Captain 97 Studios</h3>
          <address className="footer-address">
            {siteConfig.address.lines.map((line) => <span key={line}>{line}<br /></span>)}
          </address>
          <a href={siteConfig.phone.href}>{siteConfig.phone.display}</a>
          <p>{siteConfig.frequency} · {siteConfig.location}</p>
          <div className="footer-social footer-socials social-links" aria-label="Captain 97 social links">
            {siteConfig.socials.map((social) => (
              <a href={social.href} key={social.label} target="_blank" rel="noreferrer" aria-label={`${social.label} (opens in a new tab)`}>
                <Icon name={socialIcons[social.label] ?? 'external-link'} size={18} />
              </a>
            ))}
          </div>
        </div>
      </div>
      <div className="container footer-bottom">
        <span>© {new Date().getFullYear()} Captain 97.1 · WXNR-LP</span>
        <span>Locally broadcast from New Bern, North Carolina</span>
      </div>
    </footer>
  );
}
