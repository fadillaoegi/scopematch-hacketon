// Owner links remembered on this device, for the Projects list. A convenience
// only: the server is the source of truth, and storage may be unavailable.

export interface RememberedProject {
  ownerToken: string
  name: string
  createdAt: string
}

const KEY = 'scopematch.projects'

export function rememberedProjects(): RememberedProject[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as RememberedProject[]) : []
  } catch {
    return []
  }
}

export function rememberProject(p: RememberedProject) {
  try {
    const rest = rememberedProjects().filter((x) => x.ownerToken !== p.ownerToken)
    localStorage.setItem(KEY, JSON.stringify([p, ...rest]))
  } catch {
    /* storage unavailable — the owner link still works */
  }
}

export function ownerLink(token: string) {
  return `${window.location.origin}/o/${token}`
}
