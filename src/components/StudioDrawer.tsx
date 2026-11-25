import { useEffect, useRef, useState, type FormEvent } from 'react';
import { X, ArrowUpRight } from 'lucide-react';

export type StudioSection = 'work' | 'about' | 'journal' | 'contact' | null;

interface StudioDrawerProps {
  section: StudioSection;
  onClose: () => void;
  onNavigate: (next: StudioSection) => void;
}

const WORK_ITEMS = [
  {
    title: 'Kauri Canopy Observatory',
    client: 'Te Wao Nui Trust',
    year: '2026',
    summary:
      'Spatial acoustic monitoring and low-energy night ecology archive mapping canopy biodiversity across Northland.',
  },
  {
    title: 'Tidewater Living Shoreline',
    client: 'Waitematā Ecological Collective',
    year: '2025',
    summary:
      'Modular bio-receptive reef forms and public estuarine walk translating tidal data into coastal restoration.',
  },
  {
    title: 'Mycelium Material Library',
    client: 'Aotearoa Biofabric Lab',
    year: '2025',
    summary:
      'Tactile digital specimen catalogue and carbon-negative packaging system grown from agricultural waste.',
  },
];

const JOURNAL_ENTRIES = [
  {
    title: 'Designing at the Pace of Soil',
    date: 'October 2026',
    readTime: '6 min read',
    excerpt:
      'Why regenerative studios measure product cycles in seasons rather than sprints, and how calm interfaces lower ecological footprint.',
  },
  {
    title: 'Nocturnal Pollinators & Light Discipline',
    date: 'August 2026',
    readTime: '4 min read',
    excerpt:
      'Field notes from designing dark-sky sanctuaries where illumination serves orientation without erasing night ecology.',
  },
];

export function StudioDrawer({ section, onClose, onNavigate }: StudioDrawerProps) {
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!section) return;
    closeBtnRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [section, onClose]);

  useEffect(() => {
    setError('');
    setSubmitted(false);
  }, [section]);

  if (!section) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !email.includes('@')) {
      setError('Please enter your name and a valid email address.');
      return;
    }
    setError('');
    setSubmitted(true);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Fernhollow ${section}`}
      className="fixed inset-0 z-10 flex items-center justify-center p-4 sm:p-8"
      style={{ background: 'rgba(2, 3, 8, 0.78)' }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl border p-6 sm:p-10 text-[#f5efe2]"
        style={{
          background: '#0a0b10',
          borderColor: 'rgba(245, 239, 226, 0.18)',
          borderRadius: '18px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b pb-5" style={{ borderColor: 'rgba(245, 239, 226, 0.14)' }}>
          <div className="flex items-center gap-6 text-xs uppercase tracking-[0.16em] text-[#f5efe2]/70">
            <button
              type="button"
              onClick={() => onNavigate('work')}
              className={`transition-opacity ${section === 'work' ? 'text-[#f5efe2] underline underline-offset-8' : 'hover:opacity-80'}`}
            >
              Work
            </button>
            <button
              type="button"
              onClick={() => onNavigate('about')}
              className={`transition-opacity ${section === 'about' ? 'text-[#f5efe2] underline underline-offset-8' : 'hover:opacity-80'}`}
            >
              About
            </button>
            <button
              type="button"
              onClick={() => onNavigate('journal')}
              className={`transition-opacity ${section === 'journal' ? 'text-[#f5efe2] underline underline-offset-8' : 'hover:opacity-80'}`}
            >
              Journal
            </button>
            <button
              type="button"
              onClick={() => onNavigate('contact')}
              className={`transition-opacity ${section === 'contact' ? 'text-[#f5efe2] underline underline-offset-8' : 'hover:opacity-80'}`}
            >
              Let’s talk
            </button>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            aria-label="Close panel"
            className="grid h-9 w-9 place-items-center rounded-full border transition-colors hover:bg-[#f5efe2] hover:text-[#151510]"
            style={{ borderColor: 'rgba(245, 239, 226, 0.25)' }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-7 max-h-[70vh] overflow-y-auto pr-1">
          {section === 'work' && (
            <div>
              <h2
                className="text-4xl sm:text-5xl font-normal tracking-tight"
                style={{ fontFamily: 'Antonio, "Arial Narrow", sans-serif' }}
              >
                Selected regenerative work
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-[#f5efe2]/75">
                Ecological digital systems, spatial archives, and living brand worlds shaped with restorative science.
              </p>
              <div className="mt-6">
                {WORK_ITEMS.map((item) => (
                  <article
                    key={item.title}
                    className="border-b py-5 first:pt-2 last:border-b-0 last:pb-0"
                    style={{ borderColor: 'rgba(245, 239, 226, 0.12)' }}
                  >
                    <div className="flex items-baseline justify-between gap-4">
                      <h3 className="text-lg font-medium text-[#f5efe2]">{item.title}</h3>
                      <span className="text-xs text-[#f5efe2]/55 shrink-0">{item.year}</span>
                    </div>
                    <p className="mt-1 text-xs text-[#f5efe2]/60">{item.client}</p>
                    <p className="mt-2.5 text-sm leading-relaxed text-[#f5efe2]/80">{item.summary}</p>
                  </article>
                ))}
              </div>
              <div className="mt-7 flex justify-end">
                <button
                  type="button"
                  onClick={() => onNavigate('contact')}
                  className="inline-flex items-center gap-2 rounded-full bg-[#f5efe2] px-6 py-2.5 text-xs font-medium uppercase tracking-[0.14em] text-[#151510] transition-transform hover:-translate-y-0.5"
                >
                  Start a project <ArrowUpRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}

          {section === 'about' && (
            <div>
              <h2
                className="text-4xl sm:text-5xl font-normal tracking-tight"
                style={{ fontFamily: 'Antonio, "Arial Narrow", sans-serif' }}
              >
                Rooted in nature. Built for what’s next.
              </h2>
              <p className="mt-4 text-sm sm:text-base leading-relaxed text-[#f5efe2]/85">
                Fernhollow is an independent regenerative design studio working at the intersection of ecological
                research, low-impact digital craft, and living spatial storytelling.
              </p>
              <p className="mt-4 text-sm leading-relaxed text-[#f5efe2]/75">
                We partner with climate stewards, botanical sanctuaries, bio-material labs, and cultural institutions
                to replace extractive design patterns with systems that cultivate long-term resilience.
              </p>
              <div className="mt-7 grid grid-cols-1 sm:grid-cols-3 gap-6 border-t pt-6" style={{ borderColor: 'rgba(245, 239, 226, 0.14)' }}>
                <div>
                  <p className="text-xs uppercase tracking-[0.14em] text-[#f5efe2]/55">Practice</p>
                  <p className="mt-1.5 text-sm text-[#f5efe2]">Living Brand & Spatial Web</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.14em] text-[#f5efe2]/55">Footprint</p>
                  <p className="mt-1.5 text-sm text-[#f5efe2]">100% Renewable Hosted</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.14em] text-[#f5efe2]/55">Stewardship</p>
                  <p className="mt-1.5 text-sm text-[#f5efe2]">1% Watershed Restoration</p>
                </div>
              </div>
            </div>
          )}

          {section === 'journal' && (
            <div>
              <h2
                className="text-4xl sm:text-5xl font-normal tracking-tight"
                style={{ fontFamily: 'Antonio, "Arial Narrow", sans-serif' }}
              >
                Field notes & essays
              </h2>
              <div className="mt-6">
                {JOURNAL_ENTRIES.map((entry) => (
                  <article
                    key={entry.title}
                    className="border-b py-5 first:pt-2 last:border-b-0 last:pb-0"
                    style={{ borderColor: 'rgba(245, 239, 226, 0.12)' }}
                  >
                    <div className="text-xs text-[#f5efe2]/60">
                      <span>{entry.date}</span>
                      <span className="mx-2" aria-hidden="true">·</span>
                      <span>{entry.readTime}</span>
                    </div>
                    <h3 className="mt-2 text-lg font-medium text-[#f5efe2]">{entry.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-[#f5efe2]/80">{entry.excerpt}</p>
                  </article>
                ))}
              </div>
            </div>
          )}

          {section === 'contact' && (
            <div>
              <h2
                className="text-4xl sm:text-5xl font-normal tracking-tight"
                style={{ fontFamily: 'Antonio, "Arial Narrow", sans-serif' }}
              >
                Let’s talk
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-[#f5efe2]/75">
                Tell us about the ecosystem, exhibition, or digital venture you are cultivating.
              </p>

              {submitted ? (
                <div
                  className="mt-6 border p-6"
                  style={{ borderColor: 'rgba(245, 239, 226, 0.2)', borderRadius: '12px' }}
                >
                  <p className="text-base font-medium text-[#f5efe2]">Message received, {name}.</p>
                  <p className="mt-2 text-sm text-[#f5efe2]/75">
                    Our studio team will reply to {email} within two studio days.
                  </p>
                  <button
                    type="button"
                    onClick={onClose}
                    className="mt-5 rounded-full bg-[#f5efe2] px-5 py-2 text-xs font-medium uppercase tracking-[0.14em] text-[#151510]"
                  >
                    Return to valley
                  </button>
                </div>
              ) : (
                <form className="mt-6 space-y-4" onSubmit={handleSubmit} noValidate>
                  <div>
                    <label htmlFor="fh-name" className="block text-xs uppercase tracking-[0.14em] text-[#f5efe2]/65">
                      Your name
                    </label>
                    <input
                      id="fh-name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Rowan Kauri"
                      className="mt-1.5 w-full rounded-lg border bg-transparent px-3.5 py-2.5 text-sm text-[#f5efe2] placeholder:text-[#f5efe2]/35"
                      style={{ borderColor: 'rgba(245, 239, 226, 0.22)' }}
                    />
                  </div>
                  <div>
                    <label htmlFor="fh-email" className="block text-xs uppercase tracking-[0.14em] text-[#f5efe2]/65">
                      Email
                    </label>
                    <input
                      id="fh-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="rowan@example.org"
                      className="mt-1.5 w-full rounded-lg border bg-transparent px-3.5 py-2.5 text-sm text-[#f5efe2] placeholder:text-[#f5efe2]/35"
                      style={{ borderColor: 'rgba(245, 239, 226, 0.22)' }}
                    />
                  </div>
                  <div>
                    <label htmlFor="fh-notes" className="block text-xs uppercase tracking-[0.14em] text-[#f5efe2]/65">
                      Project notes
                    </label>
                    <textarea
                      id="fh-notes"
                      rows={3}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Timeline, goals, or questions..."
                      className="mt-1.5 w-full rounded-lg border bg-transparent px-3.5 py-2.5 text-sm text-[#f5efe2] placeholder:text-[#f5efe2]/35"
                      style={{ borderColor: 'rgba(245, 239, 226, 0.22)' }}
                    />
                  </div>
                  {error && (
                    <p role="alert" className="text-xs text-[#f0b5a8]">
                      {error}
                    </p>
                  )}
                  <div className="pt-2 flex justify-end">
                    <button
                      type="submit"
                      className="rounded-full bg-[#f5efe2] px-6 py-2.5 text-xs font-medium uppercase tracking-[0.14em] text-[#151510] transition-transform hover:-translate-y-0.5"
                    >
                      Send inquiry
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
