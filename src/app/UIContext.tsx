import { createContext, useContext, useState, type ReactNode } from 'react'

interface UIState {
  capture: { open: boolean; text?: string }
  newProject: { open: boolean; areaId?: string; name?: string; ideaId?: string }
  search: boolean
  openCapture(text?: string): void
  openNewProject(opts?: { areaId?: string; name?: string; ideaId?: string }): void
  openSearch(): void
  close(): void
}

const Ctx = createContext<UIState | null>(null)

export function UIProvider({ children }: { children: ReactNode }) {
  const [capture, setCapture] = useState<UIState['capture']>({ open: false })
  const [newProject, setNewProject] = useState<UIState['newProject']>({ open: false })
  const [search, setSearch] = useState(false)
  const close = () => {
    setCapture({ open: false })
    setNewProject({ open: false })
    setSearch(false)
  }
  return (
    <Ctx.Provider
      value={{
        capture,
        newProject,
        search,
        openCapture: (text) => (close(), setCapture({ open: true, text })),
        openNewProject: (opts) => (close(), setNewProject({ open: true, ...opts })),
        openSearch: () => (close(), setSearch(true)),
        close,
      }}
    >
      {children}
    </Ctx.Provider>
  )
}

export function useUI(): UIState {
  const v = useContext(Ctx)
  if (!v) throw new Error('useUI must be used inside UIProvider')
  return v
}
