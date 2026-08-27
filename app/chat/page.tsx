import type { Metadata } from 'next';
import ListenerChat from '@/components/ListenerChat';
import PageHero from '@/components/PageHero';
import Icon from '@/components/Icon';

export const metadata: Metadata = {
  title: 'Chat With the DJ',
  description: 'Send a private message to the Captain 97.1 studio and chat live with the DJ when the crew is available.',
  alternates: { canonical: '/chat' },
};

export default function ChatPage() {
  return (
    <main id="main-content" className="inner-page page-chat">
      <PageHero
        className="chat-page-hero"
        eyebrow="A direct line to the studio"
        title="Chat with the DJ"
        intro="Send a song request, a shout-out, or just say hello. Your conversation stays private between you and the Captain 97 crew."
      />

      <section className="section chat-section" aria-labelledby="chat-experience-heading">
        <div className="container chat-page-layout">
          <aside className="chat-page-intro premium-panel">
            <div className="chat-intro-icon" aria-hidden="true"><Icon name="message" size={26} /></div>
            <div className="eyebrow">Live from New Bern</div>
            <h2 id="chat-experience-heading">You’re talking directly to the studio.</h2>
            <p>
              When a DJ is available, replies appear here almost instantly. If the crew is busy or off air,
              your name, message, and email stay together in the studio inbox for a later response.
            </p>
            <ul>
              <li><Icon name="lock" size={17} />Private—not a public chatroom</li>
              <li><Icon name="microphone" size={17} />Seen by authorized station staff</li>
              <li><Icon name="mail" size={17} />Email lets us follow up later</li>
            </ul>
          </aside>
          <ListenerChat />
        </div>
      </section>
    </main>
  );
}
