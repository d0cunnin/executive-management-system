// Light (daytime) and dark (evening) themes. The choice is remembered on
// this device. index.html applies it before the page draws, so there is no
// flash of the wrong theme. The Command Center always stays dark.
export type Theme = 'dark' | 'light'

const KEY = 'ems.theme'

export function getTheme(): Theme {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'
}

export function setTheme(t: Theme) {
  document.documentElement.dataset.theme = t
  try {
    localStorage.setItem(KEY, t)
  } catch {
    // Storage blocked: the theme still applies for this visit.
  }
}
