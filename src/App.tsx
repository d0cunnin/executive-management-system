import { lazy, Suspense, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { EMSProvider } from './app/EMSContext'
import { UIProvider } from './app/UIContext'
import { AuthProvider, useAuth } from './auth/AuthContext'
import { Layout } from './components/Layout'
import Login from './pages/Login'
import Today from './pages/Today'

const CommandCenter = lazy(() => import('./pages/CommandCenter'))
const AreaPage = lazy(() => import('./pages/AreaPage'))
const Work = lazy(() => import('./pages/Work'))
const ProjectPage = lazy(() => import('./pages/ProjectPage'))
const Tasks = lazy(() => import('./pages/Tasks'))
const CalendarPage = lazy(() => import('./pages/CalendarPage'))
const Ideas = lazy(() => import('./pages/Ideas'))
const Income = lazy(() => import('./pages/Income'))
const Wellness = lazy(() => import('./pages/Wellness'))
const Team = lazy(() => import('./pages/Team'))
const Assistant = lazy(() => import('./pages/Assistant'))
const Information = lazy(() => import('./pages/Information'))
const Reviews = lazy(() => import('./pages/Reviews'))

function Splash() {
  return (
    <div className="grid min-h-[50vh] place-items-center">
      <p className="label animate-pulse">Loading</p>
    </div>
  )
}

/** Everything inside EMS requires a signed-in user. */
function Protected({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <Splash />
  if (!user) return <Navigate to="/login" replace />
  return (
    <EMSProvider>
      <UIProvider>{children}</UIProvider>
    </EMSProvider>
  )
}

function LoginRoute() {
  const { user, loading } = useAuth()
  if (loading) return <Splash />
  return user ? <Navigate to="/" replace /> : <Login />
}

export default function App() {
  return (
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
            <Route path="map" element={<Suspense fallback={<Splash />}><CommandCenter /></Suspense>} />
            <Route path="areas/:slug" element={<Suspense fallback={<Splash />}><AreaPage /></Suspense>} />
            <Route path="work" element={<Suspense fallback={<Splash />}><Work /></Suspense>} />
            <Route path="projects/:id" element={<Suspense fallback={<Splash />}><ProjectPage /></Suspense>} />
            <Route path="tasks" element={<Suspense fallback={<Splash />}><Tasks /></Suspense>} />
            <Route path="calendar" element={<Suspense fallback={<Splash />}><CalendarPage /></Suspense>} />
            <Route path="ideas" element={<Suspense fallback={<Splash />}><Ideas /></Suspense>} />
            <Route path="income" element={<Suspense fallback={<Splash />}><Income /></Suspense>} />
            <Route path="wellness" element={<Suspense fallback={<Splash />}><Wellness /></Suspense>} />
            <Route path="team" element={<Suspense fallback={<Splash />}><Team /></Suspense>} />
            <Route path="assistant" element={<Suspense fallback={<Splash />}><Assistant /></Suspense>} />
            <Route path="information" element={<Suspense fallback={<Splash />}><Information /></Suspense>} />
            <Route path="reviews" element={<Suspense fallback={<Splash />}><Reviews /></Suspense>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
