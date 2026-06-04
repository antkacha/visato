import { useState, useRef, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'

interface Props {
  user: User | null
  authLoading: boolean
  syncing: boolean
  onSignIn: () => void
  onSignOut: () => void
}

function GoogleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 18 18" style={{ flexShrink: 0 }}>
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" />
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" />
    </svg>
  )
}

function PersonIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}

function LogoutIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  )
}

function SyncDot() {
  return (
    <span style={{
      display: 'inline-block', width: '6px', height: '6px',
      borderRadius: '50%', background: 'var(--color-accent)',
      animation: 'pulse 1.4s ease-in-out infinite', flexShrink: 0,
    }} />
  )
}

const divider = (
  <div style={{ height: 1, background: 'var(--color-border)', margin: '0.25rem 0' }} />
)

const menuItem = (
  icon: React.ReactNode,
  label: string,
  onClick: () => void,
  danger = false,
): React.ReactNode => (
  <button
    onClick={onClick}
    style={{
      width: '100%', display: 'flex', alignItems: 'center', gap: '0.5rem',
      padding: '0.5rem 0.875rem', background: 'transparent', border: 'none',
      textAlign: 'left', fontSize: '0.8125rem', fontWeight: 500,
      color: danger ? 'var(--color-danger)' : 'var(--color-text)',
      cursor: 'pointer',
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.background = danger
        ? 'rgba(239,68,68,0.06)'
        : 'var(--color-bg)'
    }}
    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
  >
    {icon}
    {label}
  </button>
)

export default function AuthButton({ user, authLoading, syncing, onSignIn, onSignOut }: Props) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  if (authLoading) {
    return (
      <div style={{
        width: '7rem', height: '2rem', borderRadius: '0.5rem',
        background: 'var(--color-border)', opacity: 0.5,
      }} />
    )
  }

  if (!user) {
    return (
      <button
        onClick={onSignIn}
        title={t('auth.signInTitle')}
        style={{
          display: 'flex', alignItems: 'center', gap: '0.4rem',
          padding: '0.375rem 0.75rem', borderRadius: '0.5rem',
          background: 'var(--color-accent)', border: 'none',
          color: '#fff', fontSize: '0.75rem', fontWeight: 600,
          cursor: 'pointer', whiteSpace: 'nowrap',
        }}
      >
        <GoogleIcon />
        <span className="hidden sm:inline">{t('auth.signIn')}</span>
      </button>
    )
  }

  const avatar = user.user_metadata?.avatar_url as string | undefined
  const name   = (user.user_metadata?.full_name ?? user.email ?? '') as string
  const email  = user.email ?? ''
  const displayName = name.split(' ')[0]

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
      {syncing && <SyncDot />}

      {/* Trigger: avatar + name, no border */}
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: '0.4rem',
          padding: '0.125rem 0.25rem',
          borderRadius: '0.5rem', border: 'none',
          background: 'transparent', cursor: 'pointer',
        }}
      >
        {avatar ? (
          <img
            src={avatar}
            alt={name}
            style={{ width: '1.75rem', height: '1.75rem', borderRadius: '50%', flexShrink: 0 }}
          />
        ) : (
          <span style={{
            width: '1.75rem', height: '1.75rem', borderRadius: '50%',
            background: 'var(--color-accent)', color: '#fff',
            fontSize: '0.7rem', fontWeight: 700, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {name.charAt(0).toUpperCase()}
          </span>
        )}

        <span
          className="hidden sm:inline"
          style={{
            fontSize: '0.8125rem', fontWeight: 500, color: 'var(--color-text)',
            maxWidth: '6rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}
        >
          {displayName}
        </span>

        <svg width="10" height="10" viewBox="0 0 10 10" style={{ flexShrink: 0, color: 'var(--color-text-muted)' }}>
          <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96 }}
            transition={{ duration: 0.14, ease: 'easeOut' }}
            style={{
              position: 'absolute', top: 'calc(100% + 8px)', right: 0,
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: '0.875rem',
              boxShadow: '0 8px 24px rgba(0,0,0,0.1), 0 2px 8px rgba(0,0,0,0.06)',
              minWidth: '180px', overflow: 'hidden', zIndex: 200,
              paddingTop: '0.25rem', paddingBottom: '0.25rem',
            }}
          >
            {/* Email */}
            <div style={{ padding: '0.5rem 0.875rem 0.625rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {email}
              </div>
            </div>

            {divider}

            {/* Profile */}
            {menuItem(<PersonIcon />, t('auth.profile'), () => { setOpen(false); navigate('/profile') })}

            {divider}

            {/* Sign out */}
            {menuItem(<LogoutIcon />, t('auth.signOut'), () => { setOpen(false); onSignOut() }, true)}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
