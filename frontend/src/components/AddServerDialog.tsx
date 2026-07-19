import React, { useEffect, useState } from 'react'
import { CheckCircle2, XCircle } from 'lucide-react'
import clsx from 'clsx'
import { Modal } from './Modal'
import { Btn, Spinner } from './ui'
import { useApp } from '../store'
import { api } from '../api/client'
import type { Server } from '../types'

const empty: Server = {
  id: '', name: '', host: '', port: 22, user: 'root', auth: 'key',
  keyPath: '~/.ssh/id_ed25519', password: '', keyPassphrase: '', strictHostKey: false,
}

function Field({ label, children, span }: { label: string; children: React.ReactNode; span?: boolean }) {
  return (
    <label className={clsx('block', span && 'col-span-2')}>
      <div className="text-[11px] text-mute mb-1">{label}</div>
      {children}
    </label>
  )
}

const inputCls =
  'w-full bg-panel2 border border-edge rounded-md px-2.5 py-1.5 text-xs placeholder:text-dim focus:outline-none focus:border-accent/50'

export function AddServerDialog() {
  const { addServerOpen, closeAddServer, editingServer, reloadServers, setActive, activeId } = useApp()
  const [form, setForm] = useState<Server>(empty)
  const [testing, setTesting] = useState(false)
  const [test, setTest] = useState<{ ok: boolean; msg: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmRemove, setConfirmRemove] = useState(false)

  useEffect(() => {
    if (addServerOpen) {
      setForm(editingServer ? { ...empty, ...editingServer } : empty)
      setTest(null)
      setError(null)
      setConfirmRemove(false)
    }
  }, [addServerOpen, editingServer])

  if (!addServerOpen) return null

  const set = (patch: Partial<Server>) => {
    setForm((f) => ({ ...f, ...patch }))
    setTest(null)
  }
  const isEdit = !!editingServer?.id

  const doTest = async () => {
    setTesting(true)
    setTest(null)
    try {
      const msg = await api.testConnection(form)
      setTest({ ok: true, msg })
    } catch (e) {
      setTest({ ok: false, msg: e instanceof Error ? e.message : String(e) })
    } finally {
      setTesting(false)
    }
  }

  const doSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const saved = await api.saveServer(form)
      await reloadServers()
      if (!activeId || !isEdit) await setActive(saved.id)
      closeAddServer()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  const doRemove = async () => {
    if (!confirmRemove) {
      setConfirmRemove(true)
      return
    }
    await api.removeServer(form.id)
    await reloadServers()
    closeAddServer()
  }

  return (
    <Modal
      open
      onClose={closeAddServer}
      title={isEdit ? `Edit “${editingServer!.name}”` : 'Add server'}
      wide
      footer={
        <>
          {isEdit && (
            <Btn variant="danger" className="mr-auto" onClick={doRemove}>
              {confirmRemove ? 'Click again to confirm removal' : 'Remove server'}
            </Btn>
          )}
          <Btn onClick={doTest} disabled={testing || !form.host || !form.user}>
            {testing && <Spinner />} Test connection
          </Btn>
          <Btn variant="primary" onClick={doSave} disabled={saving || !form.host || !form.user}>
            {saving ? 'Saving…' : 'Save'}
          </Btn>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Display name" span>
          <input className={inputCls} value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. prod-eu-1 (defaults to host)" />
        </Field>
        <Field label="Host / IP">
          <input className={inputCls} value={form.host} onChange={(e) => set({ host: e.target.value })} placeholder="203.0.113.10" autoFocus />
        </Field>
        <Field label="SSH port">
          <input className={inputCls} type="number" value={form.port} onChange={(e) => set({ port: Number(e.target.value) || 22 })} />
        </Field>
        <Field label="SSH user" span>
          <input className={inputCls} value={form.user} onChange={(e) => set({ user: e.target.value })} placeholder="root" />
          <div className="text-[10px] text-dim mt-1">Must be able to run <code className="font-mono">docker</code> (root or docker group).</div>
        </Field>

        <div className="col-span-2">
          <div className="text-[11px] text-mute mb-1">Authentication</div>
          <div className="flex rounded-md overflow-hidden border border-edge w-fit">
            {(['key', 'agent', 'password'] as const).map((a) => (
              <button
                key={a}
                onClick={() => set({ auth: a })}
                className={clsx(
                  'px-3 py-1.5 text-xs capitalize transition-colors',
                  form.auth === a ? 'bg-accent/15 text-accent' : 'bg-panel2 text-mute hover:text-txt',
                )}
              >
                {a === 'key' ? 'SSH key' : a === 'agent' ? 'SSH agent' : 'Password'}
              </button>
            ))}
          </div>
        </div>

        {form.auth === 'password' && (
          <Field label="Password" span>
            <input className={inputCls} type="password" value={form.password} onChange={(e) => set({ password: e.target.value })} />
          </Field>
        )}
        {form.auth === 'key' && (
          <>
            <Field label="Private key path" span>
              <input className={inputCls} value={form.keyPath} onChange={(e) => set({ keyPath: e.target.value })} placeholder="~/.ssh/id_ed25519" />
            </Field>
            <Field label="Key passphrase (optional)" span>
              <input className={inputCls} type="password" value={form.keyPassphrase} onChange={(e) => set({ keyPassphrase: e.target.value })} />
            </Field>
          </>
        )}
        {form.auth === 'agent' && (
          <div className="col-span-2 text-[11px] text-mute bg-panel2 border border-edge rounded-md px-2.5 py-2">
            Uses keys loaded in your local <code className="font-mono">ssh-agent</code> (SSH_AUTH_SOCK). Add keys with <code className="font-mono">ssh-add</code>.
          </div>
        )}

        <label className="col-span-2 flex items-center gap-2 text-xs text-mute cursor-pointer select-none">
          <input
            type="checkbox"
            checked={!!form.strictHostKey}
            onChange={(e) => set({ strictHostKey: e.target.checked })}
            className="accent-sky-400"
          />
          Strict host key verification (~/.ssh/known_hosts)
        </label>

        {test && (
          <div className={clsx('col-span-2 flex items-start gap-2 text-xs rounded-md px-2.5 py-2 border', test.ok ? 'bg-ok/10 border-ok/25 text-ok' : 'bg-err/10 border-err/25 text-err')}>
            {test.ok ? <CheckCircle2 size={14} className="mt-px shrink-0" /> : <XCircle size={14} className="mt-px shrink-0" />}
            <span className="break-words select-text">{test.msg}</span>
          </div>
        )}
        {error && (
          <div className="col-span-2 flex items-start gap-2 text-xs rounded-md px-2.5 py-2 border bg-err/10 border-err/25 text-err">
            <XCircle size={14} className="mt-px shrink-0" />
            <span className="break-words select-text">{error}</span>
          </div>
        )}
      </div>
    </Modal>
  )
}
