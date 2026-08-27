import type { Metadata } from 'next';
import DonationCheckout from '@/components/DonationCheckout';
import PageHero from '@/components/PageHero';

export const metadata: Metadata = {
  title: 'Support Captain 97.1',
  description:
    "Help keep Captain 97.1 broadcasting and streaming Carolina's Dock Rock from New Bern, North Carolina.",
  alternates: { canonical: '/donate' },
};

const monthlyExpenses = [
  { label: 'Studio rent', amount: 1000 },
  { label: 'Studio utilities', amount: 550 },
  { label: 'Tower rent', amount: 350 },
  { label: 'Tower utilities', amount: 250 },
  { label: 'Music royalties', amount: 100 },
  { label: 'Websites and marketing', amount: 100 },
  { label: 'Staff and payroll', amount: 250 },
  { label: 'Broadcast equipment and maintenance', amount: 75 },
] as const;

const monthlyExpenseTotal = monthlyExpenses.reduce((total, expense) => total + expense.amount, 0);
const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

export default function DonatePage() {
  return (
    <main id="main-content" className="inner-page page-donate">
      <PageHero
        eyebrow="Listener supported"
        title="Keep the Captain on the air"
        intro="Local radio takes a community. Your support helps WXNR-LP keep broadcasting, streaming and showing up for New Bern."
      />

      <section className="section donation-intro" aria-labelledby="donation-heading">
        <div className="container donation-layout">
          <article className="donation-primary premium-panel">
            <div className="donation-heart" aria-hidden="true">♥</div>
            <div>
              <div className="eyebrow">Support Captain 97</div>
              <h2 id="donation-heading">Every contribution keeps local radio moving.</h2>
              <p>
                Make a one-time contribution to support Captain 97.1&apos;s community radio
                programming and operating costs. Choose an amount below, then finish on
                Stripe&apos;s secure checkout.
              </p>
              <DonationCheckout />
            </div>
          </article>

          <aside className="donation-note premium-card">
            <span className="detail-kicker">More ways to help</span>
            <h3>Listen. Share. Tell a friend.</h3>
            <p>
              Tune in, follow Captain 97, share the stream and tell local businesses you
              heard them on the Captain. Those simple actions help a local station grow.
            </p>
          </aside>
        </div>
      </section>

      <section className="section impact-section expense-section" aria-labelledby="impact-heading">
        <div className="container">
          <div className="expense-overview">
            <header className="section-heading">
              <div className="eyebrow dark">Where your support goes</div>
              <h2 id="impact-heading">What it takes to keep the Captain on the air.</h2>
              <p>
                Before an unexpected repair, equipment upgrade or special project,
                Captain 97 begins every month with these recurring operating expenses.
                Listener support helps carry the station from one month to the next.
              </p>
            </header>

            <aside className="expense-total premium-panel" aria-label="Monthly operating total">
              <span>Monthly operating baseline</span>
              <strong>{currency.format(monthlyExpenseTotal)}</strong>
              <small>Every month, before the unexpected.</small>
            </aside>
          </div>

          <div className="expense-breakdown premium-card">
            {monthlyExpenses.map((expense) => (
              <div className="expense-row" key={expense.label}>
                <div className="expense-row-heading">
                  <span>{expense.label}</span>
                  <strong>{currency.format(expense.amount)}</strong>
                </div>
                <div className="expense-track" aria-hidden="true">
                  <span
                    style={{ width: `${Math.max((expense.amount / monthlyExpenseTotal) * 100, 4)}%` }}
                  />
                </div>
              </div>
            ))}
            <div className="expense-breakdown-total">
              <span>Total recurring monthly expenses</span>
              <strong>{currency.format(monthlyExpenseTotal)}</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="section supporter-perks-section" aria-labelledby="supporter-perks-heading">
        <div className="container">
          <article className="supporter-perks premium-panel glow-frame">
            <div className="supporter-perks-copy">
              <div className="eyebrow">More than a donation</div>
              <h2 id="supporter-perks-heading">Support the station. Join the crew.</h2>
              <p>
                Every supporter receives one complimentary Captain 97 T-shirt—and an
                invitation to come hang out with us at the studio. If you have ever
                wondered what it feels like behind the microphone, you can even join us
                on air as a guest host and experience being a Captain 97 DJ for a day.
              </p>
              <p className="supporter-perks-note">
                We&apos;ll use the email and shirt size from checkout to make arrangements.
                Studio visits and guest-host appearances are scheduled in advance and
                follow station guidelines.
              </p>
            </div>

            <div className="supporter-perk-grid">
              <div className="supporter-perk-card">
                <span className="supporter-perk-icon" aria-hidden="true">97</span>
                <div>
                  <strong>Captain 97 T-shirt</strong>
                  <small>A complimentary station shirt for every supporter.</small>
                </div>
              </div>
              <div className="supporter-perk-card">
                <span className="supporter-perk-icon on-air" aria-hidden="true">ON AIR</span>
                <div>
                  <strong>DJ for a day</strong>
                  <small>Visit the studio and join us as a scheduled guest host.</small>
                </div>
              </div>
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}
