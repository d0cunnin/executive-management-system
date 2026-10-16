import { useLocation, useSearchParams } from 'react-router-dom'

// The router's setter builds on the address as of the last render, so two
// quick changes (switch view, then pick a filter) could overwrite each other.
// Track the latest address we asked for until the router catches up.
let pending: { path: string; search: string } | null = null

export function useSearchState(): [URLSearchParams, (mutate: (p: URLSearchParams) => void) => void] {
  const [params, setParams] = useSearchParams()
  const { pathname } = useLocation()
  if (pending && (pending.path !== pathname || pending.search === params.toString())) pending = null
  const update = (mutate: (p: URLSearchParams) => void) => {
    const next = new URLSearchParams(pending?.path === pathname ? pending.search : params.toString())
    mutate(next)
    pending = { path: pathname, search: next.toString() }
    setParams(next, { replace: true })
  }
  return [params, update]
}
