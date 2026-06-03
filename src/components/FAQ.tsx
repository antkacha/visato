import { useState } from 'react'

const ITEMS = [
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
    a: 'Overstaying is a serious violation. Consequences can include a multi-year re-entry ban across all Schengen countries, fines, deportation, and difficulties obtaining future visas or residency permits.',
  },
  {
    q: 'I have EU residency — do limits apply to me?',
    a: 'If you hold a valid EU Permanent Residency permit (ПМЖ), the 90/180 rule typically does not apply within your country of residence. Mark yourself as EU PR in Settings and Visato will stop showing Schengen limits. Always verify with your local immigration authority for travel to other Schengen states.',
  },
  {
    q: 'What is Temporary Protection status?',
    a: 'Temporary Protection (TPS / Тимчасовий захист) is an EU emergency mechanism granting displaced persons protection status. Holders are generally exempt from standard Schengen day limits in their host country. Select TPS in Settings to hide Schengen tracking.',
  },
  {
    q: 'Can I track non-Schengen trips too?',
    a: 'Yes. Visato tracks multiple travel zones: United Kingdom (180 days / 365), United States, Turkey, and UAE (90 days / 180), Thailand (60 days per entry), Georgia (365 days / year), and any other country as a simple travel log with no limits.',
  },
  {
    q: 'How is the 180-day window calculated?',
    a: "The 180-day window is a rolling lookback: for any given day, Visato counts all days spent in Schengen during the preceding 180 days (including today). It checks every single day of your planned trip to catch violations that might occur mid-trip, not just at the start.",
  },
  {
    q: "What's the difference between Schengen and EU?",
    a: 'The EU and Schengen Area are two overlapping but distinct groupings. Ireland is in the EU but not Schengen. Norway, Iceland, Switzerland, and Liechtenstein are in Schengen but not the EU. For the 90/180 rule, only Schengen membership matters.',
  },
]

function Item({ q, a, open, onToggle }: { q: string; a: string; open: boolean; onToggle: () => void }) {
  return (
    <div style={{ borderBottom: '1px solid #C8EAD9' }}>
      <button
        onClick={onToggle}
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '1rem 0',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          gap: '1rem',
        }}
      >
        <span style={{ fontWeight: 600, fontSize: '0.9375rem', color: '#1A7A59', lineHeight: 1.4 }}>
          {q}
        </span>
        <span
          style={{
            flexShrink: 0,
            width: '1.375rem',
            height: '1.375rem',
            borderRadius: '50%',
            background: open ? '#2DBF8A' : '#C8EAD9',
            color: open ? '#fff' : '#1A7A59',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1rem',
            fontWeight: 700,
            lineHeight: 1,
            transition: 'background 0.15s',
          }}
        >
          {open ? '−' : '+'}
        </span>
      </button>
      {open && (
        <p
          style={{
            margin: '0 0 1rem',
            color: '#3D6659',
            fontSize: '0.875rem',
            lineHeight: 1.7,
            paddingRight: '2rem',
          }}
        >
          {a}
        </p>
      )}
    </div>
  )
}

export default function FAQ() {
  const [openIdx, setOpenIdx] = useState<number | null>(null)
  return (
    <section style={{ background: '#F0FAF6', borderTop: '1px solid #C8EAD9' }}>
      <div style={{ maxWidth: '52rem', margin: '0 auto', padding: '3.5rem 1.25rem 4rem' }}>
        <h2 style={{ fontSize: '1.375rem', fontWeight: 700, color: '#1A7A59', margin: '0 0 0.25rem' }}>
          Frequently Asked Questions
        </h2>
        <p style={{ color: '#3D6659', fontSize: '0.875rem', margin: '0 0 1.5rem' }}>
          Everything you need to know about Schengen rules and Visato.
        </p>
        {ITEMS.map((item, i) => (
          <Item
            key={i}
            q={item.q}
            a={item.a}
            open={openIdx === i}
            onToggle={() => setOpenIdx((prev) => (prev === i ? null : i))}
          />
        ))}
      </div>
    </section>
  )
}
