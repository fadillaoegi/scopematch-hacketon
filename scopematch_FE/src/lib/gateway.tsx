import { createContext, useContext, type ReactNode } from 'react'
import type { ProjectGateway } from '../application/projectGateway'

const GatewayContext = createContext<ProjectGateway | null>(null)

export function ProjectGatewayProvider({ gateway, children }: { gateway: ProjectGateway; children: ReactNode }) {
  return <GatewayContext.Provider value={gateway}>{children}</GatewayContext.Provider>
}

export function useProjectGateway(): ProjectGateway {
  const gateway = useContext(GatewayContext)
  if (!gateway) throw new Error('Project gateway must be provided at the composition root.')
  return gateway
}
