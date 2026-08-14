import type { ReactNode } from 'react';

export type PageHeroProps = {
  eyebrow: ReactNode;
  title: ReactNode;
  intro: ReactNode;
  actions?: ReactNode;
  className?: string;
};

export default function PageHero({ eyebrow, title, intro, actions, className = '' }: PageHeroProps) {
  return (
    <section className={`page-hero${className ? ` ${className}` : ''}`}>
      <div className="page-hero-glow" aria-hidden="true" />
      <div className="page-hero-lines" aria-hidden="true"><span /><span /><span /></div>
      <div className="container page-hero-inner">
        <div className="eyebrow eyebrow-light"><span className="eyebrow-line" />{eyebrow}</div>
        <h1>{title}</h1>
        <p>{intro}</p>
        {actions ? <div className="page-hero-actions">{actions}</div> : null}
      </div>
    </section>
  );
}

