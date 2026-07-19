import { useEffect } from 'react'
import { useApp } from './store'
import { TopBar } from './components/TopBar'
import { Sidebar } from './components/Sidebar'
import { AddServerDialog } from './components/AddServerDialog'
import { FullSpinner } from './components/ui'
import { Dashboard } from './views/Dashboard'
import { Nodes } from './views/Nodes'
import { Services } from './views/Services'
import { ServiceDetail } from './views/ServiceDetail'
import { Stacks } from './views/Stacks'
import { Containers } from './views/Containers'
import { Networks } from './views/Networks'
import { Volumes } from './views/Volumes'
import { ConfigsView } from './views/ConfigsView'
import { MetricsView } from './views/MetricsView'
import { Welcome } from './views/Welcome'

export default function App() {
  const { init, loaded, servers, route, activeId } = useApp()

  useEffect(() => {
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!loaded) {
    return (
      <div className="h-screen bg-ink flex">
        <FullSpinner label="Starting Swarm Lens…" />
      </div>
    )
  }

  if (servers.length === 0) {
    return (
      <div className="h-screen bg-ink">
        <Welcome />
        <AddServerDialog />
      </div>
    )
  }

  const renderView = () => {
    switch (route.view) {
      case 'dashboard':
        return <Dashboard />
      case 'nodes':
        return <Nodes />
      case 'services':
        return route.param ? <ServiceDetail id={route.param} /> : <Services />
      case 'stacks':
        return <Stacks />
      case 'containers':
        return <Containers />
      case 'networks':
        return <Networks />
      case 'volumes':
        return <Volumes />
      case 'configs':
        return <ConfigsView />
      case 'metrics':
        return <MetricsView />
    }
  }

  return (
    <div className="h-screen flex flex-col bg-ink text-txt">
      <TopBar />
      <div className="flex flex-1 min-h-0">
        <Sidebar />
        {/* Remount the content area when the context changes so drawers,
            log streams and local view state never leak across servers. */}
        <main key={activeId} className="flex-1 min-w-0 flex flex-col overflow-hidden">
          {renderView()}
        </main>
      </div>
      <AddServerDialog />
    </div>
  )
}
