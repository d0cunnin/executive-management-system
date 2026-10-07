import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { EMSProvider } from './app/EMSContext'
import { UIProvider } from './app/UIContext'
import { AuthProvider, useAuth } from './auth/AuthContext'
import { Layout } from './components/Layout'
import { ErrorBoundary } from './components/ErrorBoundary'
import Login from './pages/Login'
import Today from './pages/Today'

import CommandCenter from './pages/CommandCenter'
import AreaPage from './pages/AreaPage'
import Work from './pages/Work'
import ProjectPage from './pages/ProjectPage'
import Tasks from './pages/Tasks'
import CalendarPage from './pages/CalendarPage'
import Ideas from './pages/Ideas'
import Income from './pages/Income'
import Wellness from './pages/Wellness'
import Team from './pages/Team'
import Assistant from './pages/Assistant'
import Information from './pages/Information'
import Reviews from './pages/Reviews'

function Splash() {
  return (
    <div className="grid min-h-[50vh] place-items-center">
      <p className="label animate-pulse">Loading</p>
    </div>
  )
}

/** Everything inside EMS requires a signed-in user. */
function Protected({ children }: { children: ReactNode }) {
  const { user, loading, recovering } = useAuth()
  if (loading) return <Splash />
  if (!user || recovering) return <Navigate to={`/login${window.location.hash}`} replace />
  return (
    <EMSProvider>
      <UIProvider>{children}</UIProvider>
    </EMSProvider>
  )
}

function LoginRoute() {
  const { user, loading, recovering } = useAuth()
  if (loading) return <Splash />
  return user && !recovering ? <Navigate to="/" replace /> : <Login />
}

export default function App() {
  return (
    <ErrorBoundary>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginRoute />} />
          <Route
            element={
              <Protected>
                <Layout />
              </Protected>
            }
          >
            <Route index element={<Today />} />
            <Route path="map" element={<CommandCenter />} />
            <Route path="areas/:slug" element={<AreaPage />} />
            <Route path="work" element={<Work />} />
            <Route path="projects/:id" element={<ProjectPage />} />
            <Route path="tasks" element={<Tasks />} />
            <Route path="calendar" element={<CalendarPage />} />
            <Route path="ideas" element={<Ideas />} />
            <Route path="income" element={<Income />} />
            <Route path="wellness" element={<Wellness />} />
            <Route path="team" element={<Team />} />
            <Route path="assistant" element={<Assistant />} />
            <Route path="information" element={<Information />} />
            <Route path="reviews" element={<Reviews />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
    </ErrorBoundary>
  )
}
