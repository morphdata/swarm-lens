import React from 'react'
import { X } from 'lucide-react'
import { IconBtn } from './ui'

interface Props {
  open: boolean
  onClose: () => void
  title: React.ReactNode
  sub?: string
  actions?: React.ReactNode
  children: React.ReactNode
  width?: string
}

/** Right-side slide-over panel used for resource details. */
export function Drawer({ open, onClose, title, sub, actions, children, width = 'w-[620px]' }: Props) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className={`absolute inset-y-0 right-0 ${width} max-w-[94vw] bg-panel border-l border-edge shadow-2xl flex flex-col`}>
        <div className="shrink-0 px-4 py-3 border-b border-edge flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold truncate">{title}</div>
            {sub && <div className="text-xs text-mute truncate mt-0.5 font-mono">{sub}</div>}
          </div>
          {actions}
          <IconBtn title="Close" onClick={onClose}>
            <X size={16} />
          </IconBtn>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  )
}
