import { useState } from 'react'
import { useTrips } from './hooks/useTrips'
import { useTheme } from './hooks/useTheme'
import { useSchengen } from './hooks/useSchengen'
import Header from './components/Header/Header'
import Dashboard from './components/Dashboard/Dashboard'
import TripList from './components/TripList/TripList'
import TripForm from './components/TripForm/TripForm'
import TripChecker from './components/TripChecker/TripChecker'
import Timeline from './components/Timeline/Timeline'
import SettingsPanel from './components/SettingsPanel/SettingsPanel'
import type { TripEntry } from './types'
import i18n from './i18n'

function App() {
  const { trips, addTrip, updateTrip, deleteTrip, exportTrips, importTrips } = useTrips()
  const { theme, language, residencyStatus, setTheme, setLanguage, setResidencyStatus } = useTheme()
  const status = useSchengen(trips)

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
    <div style={{ minHeight: '100dvh', background: 'var(--color-bg)' }}>
      <Header
        theme={theme}
        language={language}
        onThemeChange={setTheme}
        onLanguageChange={handleLanguageChange}
        onExport={exportTrips}
        onImport={importTrips}
        onSettingsOpen={() => setSettingsOpen(true)}
        tripCount={trips.length}
      />

      {/* inert prevents background interaction when modal is open */}
      <main
        className="max-w-4xl mx-auto px-4 pb-16 pt-6 space-y-6"
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        {...(formOpen || settingsOpen ? ({ inert: true } as any) : {})}
      >
        <Dashboard status={status} trips={trips} residencyStatus={residencyStatus} />

        <TripChecker trips={trips} onAddTrip={addTrip} residencyStatus={residencyStatus} />

        <Timeline trips={trips} />

        <TripList
          trips={trips}
          onAdd={() => setFormOpen(true)}
          onEdit={handleEdit}
          onDelete={deleteTrip}
        />
      </main>

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
