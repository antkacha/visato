import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'

function Item({ q, a, open, onToggle }: { q: string; a: string; open: boolean; onToggle: () => void }) {
  return (
    <div style={{ borderBottom: '1px solid var(--color-border)' }}>
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
        <span style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--color-text)', lineHeight: 1.4 }}>
          {q}
        </span>
        <motion.span
          animate={{ rotate: open ? 45 : 0 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
          style={{
            flexShrink: 0,
            width: '1.375rem',
            height: '1.375rem',
            borderRadius: '50%',
            background: open ? '#2DBF8A' : 'var(--color-border)',
            color: open ? '#fff' : 'var(--color-text-muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1rem',
            fontWeight: 700,
            lineHeight: 1,
            transition: 'background 0.3s ease, color 0.3s ease',
          }}
        >
          +
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <p
              style={{
                margin: '0 0 1rem',
                color: 'var(--color-text-muted)',
                fontSize: '0.875rem',
                lineHeight: 1.7,
                paddingRight: '2rem',
              }}
            >
              {a}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function FAQ() {
  const { t } = useTranslation()
  const [openIdx, setOpenIdx] = useState<number | null>(null)

  const ITEMS = Array.from({ length: 9 }, (_, i) => ({
    q: t(`faq.q${i + 1}`),
    a: t(`faq.a${i + 1}`),
  }))

  return (
    <section style={{ background: 'var(--color-section)' }}>
      <div style={{ maxWidth: '52rem', margin: '0 auto', padding: '5rem 1.25rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text)', margin: '0 0 0.25rem' }}>
          {t('faq.title')}
        </h2>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', margin: '0 0 1.25rem' }}>
          {t('faq.subtitle')}
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
