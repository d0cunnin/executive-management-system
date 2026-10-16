import { Moon, Sun } from 'lucide-react'
import { useState } from 'react'
import { getTheme, setTheme, type Theme } from '../lib/theme'

export function ThemeToggle() {
  const [theme, set] = useState<Theme>(getTheme)
  const next: Theme = theme === 'dark' ? 'light' : 'dark'
  return (
    <button
      className="btn-ghost px-2.5"
      onClick={() => {
        setTheme(next)
        set(next)
      }}
      aria-label={`Switch to ${next === 'light' ? 'daytime (light)' : 'evening (dark)'} theme`}
      title={next === 'light' ? 'Daytime theme' : 'Evening theme'}
    >
      {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  )
}
