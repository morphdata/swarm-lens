import React from 'react'
import { X } from 'lucide-react'
import { IconBtn } from './ui'

interface Props {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  footer?: React.ReactNode
  wide?: boolean
}

export function Modal({ open, onClose, title, children, footer, wide }: Props) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh]">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className={`relative ${wide ? 'w-[640px]' : 'w-[460px]'} max-w-[94vw] bg-panel border border-edge2 rounded-xl shadow-2xl`}>
        <div className="px-4 py-3 border-b border-edge flex items-center gap-3">
          <div className="flex-1 text-sm font-semibold">{title}</div>
          <IconBtn title="Close" onClick={onClose}>
            <X size={15} />
          </IconBtn>
        </div>
        <div className="p-4 max-h-[62vh] overflow-y-auto">{children}</div>
        {footer && <div className="px-4 py-3 border-t border-edge flex items-center justify-end gap-2">{footer}</div>}
      </div>
    </div>
  )
}

interface ConfirmProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  body: React.ReactNode
  confirmLabel?: string
  busy?: boolean
  error?: string | null
}

import { Btn } from './ui'
import { AlertTriangle } from 'lucide-react'

export function ConfirmModal({ open, onClose, onConfirm, title, body, confirmLabel = 'Remove', busy, error }: ConfirmProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn variant="danger" disabled={busy} onClick={onConfirm}>
            {confirmLabel}
          </Btn>
        </>
      }
    >
      <div className="flex items-start gap-2.5 text-xs text-mute">
        <AlertTriangle size={15} className="text-warn mt-0.5 shrink-0" />
        <div>{body}</div>
      </div>
    </Modal>
  )
}
