import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useTrips } from './hooks/useTrips'
import { useTheme } from './hooks/useTheme'
import { useAuth } from './hooks/useAuth'
import { useSchengen } from './hooks/useSchengen'
import Header from './components/Header/Header'
import Dashboard from './components/Dashboard/Dashboard'
import TripList from './components/TripList/TripList'
import TripForm from './components/TripForm/TripForm'
import TripChecker from './components/TripChecker/TripChecker'
import Timeline from './components/Timeline/Timeline'
import SettingsPanel from './components/SettingsPanel/SettingsPanel'
import FAQ from './components/FAQ'
import type { TripEntry } from './types'
import { COUNTRY_ZONE } from './constants/countries'
import i18n from './i18n'

function App() {
  const { t } = useTranslation()
  const { user, authLoading, signInWithGoogle, signOut } = useAuth()
  const { trips, syncing, addTrip, updateTrip, deleteTrip } = useTrips(user)
  const { theme, language, residencyStatus, setTheme, setLanguage, setResidencyStatus } = useTheme()
  const schengenTrips = useMemo(() => trips.filter((t) => COUNTRY_ZONE[t.country] === 'schengen'), [trips])
  const status = useSchengen(schengenTrips)
  const isExempt = residencyStatus === 'eu_pr' || residencyStatus === 'tps'

  const [formOpen, setFormOpen] = useState(false)
  const [editingTrip, setEditingTrip] = useState<TripEntry | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const handleLanguageChange = (lang: 'en' | 'ru') => {
    setLanguage(lang)
    i18n.changeLanguage(lang)
  }

  const handleEdit = (trip: TripEntry) => {
    setEditingTrip(trip)
    setFormOpen(true)
  }

  const handleFormClose = () => {
    setFormOpen(false)
    setEditingTrip(null)
  }

  const handleFormSave = (data: Omit<TripEntry, 'id'>) => {
    if (editingTrip) {
      updateTrip(editingTrip.id, data)
    } else {
      addTrip(data)
    }
    handleFormClose()
  }

  return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100dvh' }}>

      {/* ── Sticky nav — controls at the very top ─────────────────────── */}
      <Header
        theme={theme}
        language={language}
        onThemeChange={setTheme}
        onLanguageChange={handleLanguageChange}
        onSettingsOpen={() => setSettingsOpen(true)}
        user={user}
        authLoading={authLoading}
        syncing={syncing}
        onSignIn={signInWithGoogle}
        onSignOut={signOut}
        tripCount={trips.length}
      />

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50%       { transform: translateY(-14px) rotate(0deg); }
        }
        @keyframes float-card {
          0%, 100% { transform: rotate(4deg) translateY(0px); }
          50%       { transform: rotate(4deg) translateY(-8px); }
        }
        @media (max-width: 640px) {
          .hero-grid { grid-template-columns: 1fr !important; }
          .hero-visual { display: none !important; }
        }
      `}</style>

      <section>
        <div
          className="hero-grid"
          style={{
            maxWidth: '60rem',
            margin: '0 auto',
            padding: '4rem 1.5rem',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '3rem',
            alignItems: 'center',
          }}
        >
          {/* ── Left: text ── */}
          <div>
            {/* Label */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
              padding: '0.25rem 0.875rem', borderRadius: '999px',
              background: 'rgba(45,191,138,0.12)', border: '1px solid rgba(45,191,138,0.3)',
              color: '#1A7A59', fontSize: '0.75rem', fontWeight: 700,
              marginBottom: '1.25rem', letterSpacing: '0.02em',
            }}>
              ✦ {t('hero.badge')}
            </div>

            {/* Headline */}
            <h1 style={{
              fontSize: 'clamp(2.25rem, 4.5vw, 3.25rem)',
              fontWeight: 800, color: '#1A7A59',
              lineHeight: 1.1, letterSpacing: '-0.03em',
              margin: '0 0 1rem',
            }}>
              {t('hero.title1')}<br />{t('hero.title2')}
            </h1>

            {/* Description */}
            <p style={{
              fontSize: '1rem', color: '#3D6659', lineHeight: 1.7,
              margin: '0 0 1.75rem', maxWidth: '380px',
            }}>
              {t('hero.description')}
            </p>

            {/* Stats */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.25rem', fontSize: '0.875rem', fontWeight: 600, color: '#1A7A59' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                <span style={{ fontSize: '1rem' }}>🌍</span> {t('hero.stat1')}
              </span>
              <span style={{ color: '#A8D4C0' }}>·</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                <span style={{ fontSize: '1rem' }}>📅</span> {t('hero.stat2')}
              </span>
            </div>
          </div>

          {/* ── Right: animated visual ── */}
          <div
            className="hero-visual"
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}
          >
            {/* Floating gauge card */}
            <div style={{
              background: '#fff',
              borderRadius: '1.5rem',
              padding: '1.5rem 1.75rem',
              boxShadow: '0 24px 64px rgba(45,191,138,0.18), 0 4px 16px rgba(26,122,89,0.08)',
              animation: 'float 4s ease-in-out infinite',
              width: '100%', maxWidth: '240px',
            }}>
              {/* Card header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#1A7A59' }}>🇪🇺 Schengen</span>
                <span style={{
                  fontSize: '0.65rem', fontWeight: 700, padding: '0.15rem 0.5rem',
                  borderRadius: '999px', background: 'rgba(45,191,138,0.12)', color: '#1A7A59',
                }}>90 / 180</span>
              </div>

              {/* SVG gauge */}
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.75rem' }}>
                <svg width="120" height="120" viewBox="0 0 140 140">
                  <circle cx="70" cy="70" r="54" fill="none" stroke="#E8F8F0" strokeWidth="10" />
                  <circle
                    cx="70" cy="70" r="54" fill="none"
                    stroke="#2DBF8A" strokeWidth="10" strokeLinecap="round"
                    strokeDasharray="339.3" strokeDashoffset="252.5"
                    style={{ transform: 'rotate(-90deg)', transformOrigin: '70px 70px' }}
                  />
                  <text x="70" y="63" textAnchor="middle" fontSize="28" fontWeight="800" fill="#1A7A59" fontFamily="Inter,system-ui,sans-serif">67</text>
                  <text x="70" y="79" textAnchor="middle" fontSize="9" fill="#5A7A6D" fontFamily="Inter,system-ui,sans-serif">days left</text>
                  <text x="70" y="91" textAnchor="middle" fontSize="8" fill="#A8C4BB" fontFamily="Inter,system-ui,sans-serif">out of 90</text>
                </svg>
              </div>

              <div style={{ textAlign: 'center', fontSize: '0.75rem', color: '#5A7A6D', fontWeight: 500 }}>
                23 days used · window ends Jun 30
              </div>
            </div>

            {/* Trip card — rotated, slightly lower */}
            <div style={{
              background: '#fff',
              borderRadius: '1rem',
              padding: '0.75rem 1rem',
              boxShadow: '0 8px 28px rgba(26,122,89,0.12)',
              animation: 'float-card 4s ease-in-out 0.8s infinite',
              border: '1px solid #E4F4EE',
              width: '100%', maxWidth: '210px',
              alignSelf: 'flex-end', marginRight: '1rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                <span style={{ fontSize: '1.1rem' }}>🇫🇷</span>
                <span style={{ fontWeight: 700, fontSize: '0.875rem', color: '#1A7A59' }}>France</span>
                <span style={{
                  marginLeft: 'auto', fontSize: '0.65rem', fontWeight: 700,
                  padding: '0.1rem 0.45rem', borderRadius: '999px',
                  background: '#E4F4EE', color: '#1A7A59',
                }}>Past</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#7A9E93' }}>Mar 5 – Mar 19 · 15 days</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── App content — flows directly from hero ────────────────────── */}
      <main
        className="max-w-4xl mx-auto px-4 pb-16 pt-6 space-y-6"
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        {...(formOpen || settingsOpen ? ({ inert: true } as any) : {})}
      >
        {isExempt ? (
          <div
            className="glass-card p-5"
            style={{
              background: 'rgba(16,185,129,0.08)',
              border: '1px solid var(--color-success)',
              color: 'var(--color-success)',
              fontSize: '0.875rem',
              fontWeight: 500,
            }}
          >
            {residencyStatus === 'eu_pr' ? t('dashboard.exemptEuPr') : t('dashboard.exemptTps')}
          </div>
        ) : (
          <>
            <Dashboard status={status} trips={trips} />
            <TripChecker trips={schengenTrips} onAddTrip={addTrip} />
            <Timeline trips={trips} />
          </>
        )}
        <TripList
          trips={trips}
          onAdd={() => setFormOpen(true)}
          onEdit={handleEdit}
          onDelete={deleteTrip}
        />
      </main>

      {/* ── FAQ ───────────────────────────────────────────────────────── */}
      <FAQ />

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <footer
        style={{
          borderTop: '1px solid var(--color-border)',
          padding: '1.25rem',
          textAlign: 'center',
          color: 'var(--color-text-muted)',
          fontSize: '0.8125rem',
        }}
      >
        Made with <span style={{ color: '#2DBF8A' }}>♥</span> by Visato
      </footer>

      <TripForm
        open={formOpen}
        trip={editingTrip}
        existingTrips={trips}
        onSave={handleFormSave}
        onClose={handleFormClose}
      />

      <SettingsPanel
        open={settingsOpen}
        residencyStatus={residencyStatus}
        onResidencyChange={setResidencyStatus}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  )
}

export default App
