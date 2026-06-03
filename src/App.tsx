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
  const { trips, syncing, addTrip, updateTrip, deleteTrip, exportTrips, importTrips } = useTrips(user)
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
        onExport={exportTrips}
        onImport={importTrips}
        onSettingsOpen={() => setSettingsOpen(true)}
        user={user}
        authLoading={authLoading}
        syncing={syncing}
        onSignIn={signInWithGoogle}
        onSignOut={signOut}
        tripCount={trips.length}
      />

      {/* ── Hero — sits directly below the nav, no break ──────────────── */}
      <section style={{ borderBottom: '1px solid var(--color-border)', padding: '2rem 1.25rem 1.75rem', textAlign: 'center' }}>
        <h1
          style={{
            fontSize: 'clamp(2rem, 6vw, 3rem)',
            fontWeight: 800,
            color: '#2DBF8A',
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
            margin: '0 0 0.5rem',
          }}
        >
          Track your Schengen days.
        </h1>
        <p
          style={{
            fontSize: 'clamp(1rem, 2.5vw, 1.125rem)',
            fontWeight: 600,
            color: 'var(--color-text)',
            margin: '0 0 0.625rem',
            lineHeight: 1.4,
          }}
        >
          Log every adventure.
        </p>
        <p
          style={{
            fontSize: '0.875rem',
            color: 'var(--color-text-muted)',
            lineHeight: 1.65,
            maxWidth: '480px',
            margin: '0 auto',
          }}
        >
          Automatically calculates the 90/180-day Schengen rule.
          Add trips, check days remaining, and plan future stays.
          Supports 196 countries including the UK, USA, Turkey, UAE, Thailand, and Georgia.
        </p>
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
