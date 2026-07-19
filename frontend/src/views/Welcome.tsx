import { Container, Globe, KeyRound, Plus, Terminal } from 'lucide-react'
import { useApp } from '../store'
import { Btn } from '../components/ui'

export function Welcome() {
  const { openAddServer } = useApp()
  return (
    <div className="h-full flex flex-col items-center justify-center gap-5 p-8 text-center">
      <div className="w-14 h-14 rounded-2xl bg-accent/15 text-accent flex items-center justify-center">
        <Container size={28} />
      </div>
      <div>
        <h1 className="text-xl font-semibold tracking-tight mb-1.5">Swarm Lens</h1>
        <p className="text-sm text-mute max-w-md">
          A Lens-style IDE for Docker Swarm. Add a server over SSH to manage services, stacks,
          nodes, logs and metrics across all of your VPS machines.
        </p>
      </div>
      <Btn variant="primary" className="px-4 py-2 text-sm" onClick={() => openAddServer(null)}>
        <Plus size={15} /> Add your first server
      </Btn>
      <div className="flex gap-6 mt-2 text-[11px] text-dim">
        <span className="flex items-center gap-1.5"><Globe size={12} /> Multi-server contexts</span>
        <span className="flex items-center gap-1.5"><KeyRound size={12} /> Key, agent or password auth</span>
        <span className="flex items-center gap-1.5"><Terminal size={12} /> Nothing to install on servers</span>
      </div>
    </div>
  )
}
