import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import type { ResidencyStatus } from '../../types'

interface Props {
  open: boolean
  residencyStatus: ResidencyStatus
  onResidencyChange: (s: ResidencyStatus) => void
  onClose: () => void
}

const STATUS_OPTIONS: { value: ResidencyStatus; emoji: string; labelKey: string; descKey: string }[] = [
  { value: 'tourist', emoji: '🌍', labelKey: 'settings.statusTourist', descKey: 'settings.statusTouristDesc' },
  { value: 'eu_pr', emoji: '🏠', labelKey: 'settings.statusEuPr', descKey: 'settings.statusEuPrDesc' },
  { value: 'tps', emoji: '🛡', labelKey: 'settings.statusTps', descKey: 'settings.statusTpsDesc' },
]

export default function SettingsPanel({ open, residencyStatus, onResidencyChange, onClose }: Props) {
  const { t } = useTranslation()

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.18 }}
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.4)',
          backdropFilter: 'blur(2px)',
          zIndex: 49,
        }}
      />

      {/* Side panel */}
      <motion.div
        initial={{ x: '100%', opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: '320px',
          maxWidth: '90vw',
          background: 'var(--color-surface-solid)',
          borderLeft: '1px solid var(--color-border)',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.15)',
          zIndex: 50,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '1.25rem 1.25rem 1rem',
            borderBottom: '1px solid var(--color-border)',
          }}
        >
          <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--color-text)' }}>
            {t('settings.title')}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: '1px solid var(--color-border)',
              borderRadius: '0.5rem',
              width: '2rem',
              height: '2rem',
              cursor: 'pointer',
              color: 'var(--color-text-muted)',
              fontSize: '1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', flex: 1 }}>
          {/* Residency status */}
          <section>
            <p
              style={{
                margin: '0 0 0.75rem',
                fontSize: '0.75rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--color-text-muted)',
              }}
            >
              {t('settings.residencyStatus')}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {STATUS_OPTIONS.map((opt) => {
                const isSelected = residencyStatus === opt.value
                return (
                  <button
                    key={opt.value}
                    onClick={() => onResidencyChange(opt.value)}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.75rem',
                      padding: '0.75rem',
                      borderRadius: '0.75rem',
                      border: isSelected
                        ? '2px solid var(--color-accent)'
                        : '1.5px solid var(--color-border)',
                      background: isSelected ? 'rgba(59,130,246,0.06)' : 'transparent',
                      cursor: 'pointer',
                      textAlign: 'left',
                      width: '100%',
                      transition: 'border-color 0.15s, background 0.15s',
                    }}
                  >
                    {/* Radio indicator */}
                    <span
                      style={{
                        width: '1rem',
                        height: '1rem',
                        borderRadius: '50%',
                        border: `2px solid ${isSelected ? 'var(--color-accent)' : 'var(--color-border)'}`,
                        flexShrink: 0,
                        marginTop: '0.1rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {isSelected && (
                        <span
                          style={{
                            width: '0.5rem',
                            height: '0.5rem',
                            borderRadius: '50%',
                            background: 'var(--color-accent)',
                            display: 'block',
                          }}
                        />
                      )}
                    </span>

                    {/* Text */}
                    <span style={{ display: 'flex', flexDirection: 'column', gap: '0.125rem' }}>
                      <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>
                        {opt.emoji} {t(opt.labelKey)}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
                        {t(opt.descKey)}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          </section>
        </div>
      </motion.div>
    </>
  )
}
