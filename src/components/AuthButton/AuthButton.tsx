import { useTranslation } from 'react-i18next'
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

function SyncDot() {
  return (
    <span
      title="Syncing…"
      style={{
        display: 'inline-block',
        width: '6px',
        height: '6px',
        borderRadius: '50%',
        background: 'var(--color-accent)',
        animation: 'pulse 1.4s ease-in-out infinite',
        flexShrink: 0,
      }}
    />
  )
}

export default function AuthButton({ user, authLoading, syncing, onSignIn, onSignOut }: Props) {
  const { t } = useTranslation()

  if (authLoading) {
    return (
      <div
        style={{
          width: '7rem',
          height: '2rem',
          borderRadius: '0.5rem',
          background: 'var(--color-border)',
          opacity: 0.5,
        }}
      />
    )
  }

  if (!user) {
    return (
      <button
        onClick={onSignIn}
        title={t('auth.signInTitle')}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          padding: '0.375rem 0.75rem',
          borderRadius: '0.5rem',
          background: 'var(--color-accent)',
          border: 'none',
          color: '#fff',
          fontSize: '0.75rem',
          fontWeight: 600,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        <GoogleIcon />
        {t('auth.signIn')}
      </button>
    )
  }

  const avatar = user.user_metadata?.avatar_url as string | undefined
  const name = (user.user_metadata?.full_name ?? user.email ?? '') as string
  const displayName = name.split(' ')[0] // first name only

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      {/* Sync indicator */}
      {syncing && <SyncDot />}

      {/* Avatar */}
      {avatar ? (
        <img
          src={avatar}
          alt={name}
          title={name}
          style={{
            width: '1.75rem',
            height: '1.75rem',
            borderRadius: '50%',
            border: '1.5px solid var(--color-border)',
            flexShrink: 0,
          }}
        />
      ) : (
        <span
          title={name}
          style={{
            width: '1.75rem',
            height: '1.75rem',
            borderRadius: '50%',
            background: 'var(--color-accent)',
            color: '#fff',
            fontSize: '0.7rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {name.charAt(0).toUpperCase()}
        </span>
      )}

      {/* Name — hidden on very small screens */}
      <span
        className="hidden sm:inline"
        style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--color-text)', maxWidth: '6rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
      >
        {displayName}
      </span>

      {/* Sign out */}
      <button
        onClick={onSignOut}
        title={t('auth.signOut')}
        style={{
          padding: '0.25rem 0.5rem',
          borderRadius: '0.375rem',
          background: 'transparent',
          border: '1px solid var(--color-border)',
          color: 'var(--color-text-muted)',
          fontSize: '0.7rem',
          fontWeight: 600,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        {t('auth.signOut')}
      </button>
    </div>
  )
}
