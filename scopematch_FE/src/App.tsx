import { Route, Routes } from 'react-router'
import { InvalidLinkPage } from './pages/InvalidLinkPage'
import { NewProjectPage } from './pages/NewProjectPage'
import { OwnerWorkspace } from './pages/OwnerWorkspace'
import { ProjectsPage } from './pages/ProjectsPage'

export function App() {
  return (
    <Routes>
      <Route path="/" element={<ProjectsPage />} />
      <Route path="/new" element={<NewProjectPage />} />
      <Route path="/o/:token" element={<OwnerWorkspace />} />
      <Route path="*" element={<InvalidLinkPage />} />
    </Routes>
  )
}
