import { useState } from 'react'
import { Link } from 'react-router-dom'

// ── Design tokens ──────────────────────────────────────────────────────────
const C = {
  bg:       '#F0FAF6',
  surface:  '#FFFFFF',
  primary:  '#2DBF8A',
  dark:     '#1A7A59',
  accent:   '#F5C842',
  alert:    '#FF6B6B',
  text:     '#0F2E22',
  muted:    '#5A7A6D',
  border:   '#C8EAD9',
}

// ── FAQ data ───────────────────────────────────────────────────────────────
const FAQ_ITEMS = [
  {
    q: 'What is the 90/180 Schengen rule?',
    a: 'You may stay in the Schengen Area for a maximum of 90 days within any rolling 180-day period. The window is not a fixed calendar period — it moves forward each day, looking back 180 days from today. Visato calculates this automatically for every day of your trip.',
  },
  {
    q: 'Which countries are in the Schengen zone?',
    a: '29 countries: Austria, Belgium, Bulgaria, Croatia, Czech Republic, Denmark, Estonia, Finland, France, Germany, Greece, Hungary, Iceland, Italy, Latvia, Liechtenstein, Lithuania, Luxembourg, Malta, Netherlands, Norway, Poland, Portugal, Romania, Slovakia, Slovenia, Spain, Sweden, and Switzerland.',
  },
  {
    q: 'Does the day of entry count?',
    a: 'Yes. Both the entry day and the exit day are counted as full Schengen days. A trip arriving on January 1 and leaving on January 5 uses 5 days, not 4.',
  },
  {
    q: 'What happens if I overstay?',
    a: 'Overstaying is a serious violation. Consequences can include a multi-year re-entry ban across all Schengen countries, fines, deportation, and difficulties obtaining future visas or residency permits anywhere in the EU.',
  },
  {
    q: 'I have EU residency — do limits apply to me?',
    a: 'If you hold a valid EU Permanent Residency permit (ПМЖ), the 90/180 rule typically does not apply within your country of residence. You can mark yourself as EU PR in Settings and Visato will stop showing Schengen limits. Always verify with your local immigration authority for travel to other Schengen states.',
  },
  {
    q: 'What is Temporary Protection status?',
    a: 'Temporary Protection (TPS / Тимчасовий захист) is an EU emergency mechanism granting displaced persons protection status. Holders are generally exempt from the standard Schengen day limits in their host country. Select TPS in Settings to hide Schengen tracking. Individual country rules may still apply for travel abroad.',
  },
  {
    q: 'Can I track non-Schengen trips too?',
    a: 'Yes. Visato tracks multiple travel zones: United Kingdom (180 days per 365), United States, Turkey, and UAE (90 days per 180), Thailand (60 days per entry), Georgia (365 days per year), and any other country as a simple travel log with no limits.',
  },
  {
    q: 'How is the 180-day window calculated?',
    a: "The 180-day window is a rolling lookback: for any given day, Visato counts all days spent in Schengen during the preceding 180 days (including today). It checks every single day of your planned trip to catch violations that might occur mid-trip, not just at the start.",
  },
  {
    q: "What's the difference between Schengen and EU?",
    a: 'The EU (European Union) and the Schengen Area are two overlapping but distinct groupings. Ireland is in the EU but not Schengen. Norway, Iceland, Switzerland, and Liechtenstein are in Schengen but not the EU. For the 90/180 rule, only Schengen membership matters — not EU membership.',
  },
]

// ── Accordion item ─────────────────────────────────────────────────────────
function FaqItem({ q, a, open, onToggle }: { q: string; a: string; open: boolean; onToggle: () => void }) {
  return (
    <div
      style={{
        borderBottom: `1px solid ${C.border}`,
      }}
    >
      <button
        onClick={onToggle}
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '1.125rem 0',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          gap: '1rem',
        }}
      >
        <span style={{ fontWeight: 600, fontSize: '0.9375rem', color: C.dark, lineHeight: 1.4 }}>
          {q}
        </span>
        <span
          style={{
            flexShrink: 0,
            width: '1.5rem',
            height: '1.5rem',
            borderRadius: '50%',
            background: open ? C.primary : C.border,
            color: open ? '#fff' : C.dark,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1rem',
            fontWeight: 700,
            transition: 'background 0.2s, color 0.2s',
            lineHeight: 1,
          }}
        >
          {open ? '−' : '+'}
        </span>
      </button>
      {open && (
        <p
          style={{
            margin: '0 0 1.125rem',
            color: C.muted,
            fontSize: '0.875rem',
            lineHeight: 1.7,
            paddingRight: '2.5rem',
          }}
        >
          {a}
        </p>
      )}
    </div>
  )
}

// ── Landing page ───────────────────────────────────────────────────────────
export default function Landing() {
  const [openIdx, setOpenIdx] = useState<number | null>(null)

  const toggle = (i: number) => setOpenIdx((prev) => (prev === i ? null : i))

  return (
    <div style={{ background: C.bg, minHeight: '100dvh', fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* Navbar */}
      <nav
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          background: 'rgba(240,250,246,0.85)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderBottom: `1px solid ${C.border}`,
        }}
      >
        <div
          style={{
            maxWidth: '720px',
            margin: '0 auto',
            padding: '0 1.25rem',
            height: '3.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.25rem' }}>🌍</span>
            <span style={{ fontWeight: 700, fontSize: '1rem', color: C.dark }}>Visato</span>
          </div>
          <Link
            to="/app"
            style={{
              padding: '0.4rem 1rem',
              borderRadius: '999px',
              background: C.primary,
              color: '#fff',
              fontWeight: 600,
              fontSize: '0.875rem',
              textDecoration: 'none',
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = C.dark)}
            onMouseLeave={(e) => (e.currentTarget.style.background = C.primary)}
          >
            Open App
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section
        style={{
          maxWidth: '720px',
          margin: '0 auto',
          padding: '5rem 1.25rem 4rem',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.3rem 0.875rem',
            borderRadius: '999px',
            background: 'rgba(45,191,138,0.12)',
            border: `1px solid ${C.primary}`,
            color: C.dark,
            fontSize: '0.8125rem',
            fontWeight: 600,
            marginBottom: '2rem',
          }}
        >
          <span>✦</span>
          <span>Free · No account required · Open source</span>
        </div>

        <h1
          style={{
            fontSize: 'clamp(3rem, 10vw, 5.5rem)',
            fontWeight: 800,
            color: C.dark,
            lineHeight: 1.05,
            letterSpacing: '-0.03em',
            margin: '0 0 1.25rem',
          }}
        >
          Visato
        </h1>

        <p
          style={{
            fontSize: 'clamp(1.125rem, 3vw, 1.375rem)',
            color: C.muted,
            lineHeight: 1.55,
            maxWidth: '480px',
            margin: '0 auto 2.5rem',
          }}
        >
          Track your Schengen days.{' '}
          <span style={{ color: C.primary, fontWeight: 600 }}>Log every adventure.</span>
        </p>

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link
            to="/app"
            style={{
              padding: '0.875rem 2rem',
              borderRadius: '999px',
              background: C.primary,
              color: '#fff',
              fontWeight: 700,
              fontSize: '1rem',
              textDecoration: 'none',
              boxShadow: `0 4px 20px rgba(45,191,138,0.35)`,
              transition: 'background 0.15s, transform 0.15s',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = C.dark
              e.currentTarget.style.transform = 'translateY(-1px)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = C.primary
              e.currentTarget.style.transform = 'translateY(0)'
            }}
          >
            Open App <span style={{ fontSize: '1.1em' }}>→</span>
          </Link>
        </div>

        {/* Feature pills */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.5rem',
            justifyContent: 'center',
            marginTop: '2.5rem',
          }}
        >
          {[
            '🇪🇺 Schengen 90/180',
            '🇬🇧 UK 180/365',
            '🇺🇸 USA 90/180',
            '🇹🇭 Thailand 60/entry',
            '🇬🇪 Georgia 365/yr',
            '🌍 196 countries',
          ].map((pill) => (
            <span
              key={pill}
              style={{
                padding: '0.3rem 0.75rem',
                borderRadius: '999px',
                background: C.surface,
                border: `1px solid ${C.border}`,
                color: C.muted,
                fontSize: '0.8125rem',
                fontWeight: 500,
              }}
            >
              {pill}
            </span>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section
        style={{
          maxWidth: '720px',
          margin: '0 auto',
          padding: '1rem 1.25rem 6rem',
        }}
      >
        <div
          style={{
            background: C.surface,
            borderRadius: '1.25rem',
            border: `1px solid ${C.border}`,
            padding: '2rem 2rem 0.5rem',
            boxShadow: '0 2px 16px rgba(26,122,89,0.06)',
          }}
        >
          <h2
            style={{
              fontSize: '1.25rem',
              fontWeight: 700,
              color: C.dark,
              marginBottom: '0.25rem',
            }}
          >
            Frequently Asked Questions
          </h2>
          <p style={{ color: C.muted, fontSize: '0.875rem', marginBottom: '1.25rem' }}>
            Everything you need to know about Schengen rules and Visato.
          </p>

          {FAQ_ITEMS.map((item, i) => (
            <FaqItem
              key={i}
              q={item.q}
              a={item.a}
              open={openIdx === i}
              onToggle={() => toggle(i)}
            />
          ))}
        </div>

        {/* Footer note */}
        <p
          style={{
            textAlign: 'center',
            color: C.muted,
            fontSize: '0.8125rem',
            marginTop: '2rem',
            lineHeight: 1.6,
          }}
        >
          Visato is a personal travel tool. Always verify visa rules with official government sources
          before travelling.{' '}
          <Link to="/app" style={{ color: C.primary, fontWeight: 600, textDecoration: 'none' }}>
            Open the app →
          </Link>
        </p>
      </section>
    </div>
  )
}
