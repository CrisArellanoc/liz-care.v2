// Bandeja de solicitudes del sitio público. ✓ acepta (crea al paciente con sus datos) · ✗ rechaza (no se integra).
import { Check, Inbox, Mail, MessageSquareText, Phone, UserPlus, X } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Avatar, Badge, Button, Card, EmptyState, PageHeader, Tabs, cx } from '../../components/ui'
import { supabase } from '../../data/supabase'
import type { Paciente, Solicitud } from '../../data/types'
import { edad, fechaCorta, relativo } from '../../lib/format'
import { useStore } from '../../lib/store'
import { AccesoPortalModal } from './AccesoPortal'

const ERRORES = {
  'correo-duplicado': 'Ya existe un paciente con ese correo. No se creó otro; revisa su expediente.',
  'ya-resuelta': 'Esta solicitud ya fue resuelta.',
  'sin-datos': 'La solicitud no trae los datos necesarios para crear al paciente.',
  error: 'No se pudo completar la acción. Inténtalo de nuevo.',
} as const

function Dato({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return <p className="flex min-w-0 items-center gap-2 text-sm text-ink-600"><span className="text-ink-400">{icon}</span><span className="min-w-0 break-words">{children}</span></p>
}

function Tarjeta({ s, onAceptar, onRechazar, ocupada }: { s: Solicitud; onAceptar: () => void; onRechazar: () => void; ocupada: boolean }) {
  const [confirmando, setConfirmando] = useState(false)
  const nombre = [s.nombre, s.apellidoPaterno, s.apellidoMaterno].filter(Boolean).join(' ')
  const nueva = s.estado === 'nueva'
  const quiereSerPaciente = s.tipo === 'cita'
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="flex min-w-0 flex-1 gap-3">
          <Avatar name={nombre} size={44} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-bold">{nombre}</h3>
              <Badge tone={quiereSerPaciente ? 'brand' : 'gray'}>{quiereSerPaciente ? 'Quiere ser paciente' : 'Pide informes'}</Badge>
              {s.estado === 'aceptada' && <Badge tone="blue">{quiereSerPaciente ? 'Aceptada · paciente creado' : 'Atendida'}</Badge>}
              {s.estado === 'rechazada' && <Badge tone="red">Rechazada</Badge>}
            </div>
            <p className="text-xs text-ink-400">{relativo(s.creadaEl)} · {fechaCorta(s.creadaEl)}</p>
            <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
              <Dato icon={<Mail className="size-4" />}>{s.email}</Dato>
              <Dato icon={<Phone className="size-4" />}>{s.telefono}</Dato>
              {s.idioma && <Dato icon={<MessageSquareText className="size-4" />}>Idioma: {s.idioma}</Dato>}
              {s.especialidad && <Dato icon={<UserPlus className="size-4" />}>Especialidad: {s.especialidad}</Dato>}
            </div>
            {quiereSerPaciente && s.fechaNacimiento && (
              <p className="mt-2 text-sm text-ink-500">{edad(s.fechaNacimiento)} años · {s.nacionalidad}{s.contactoEmergencia ? ` · Emergencia: ${s.contactoEmergencia.nombre} (${s.contactoEmergencia.parentesco}) ${s.contactoEmergencia.telefono}` : ''}</p>
            )}
            {s.mensaje && <p className="mt-3 rounded-xl bg-ink-50 p-3 text-sm text-ink-700">{s.mensaje}</p>}
            {s.estado === 'aceptada' && s.pacienteId && <Link to={`/admin/pacientes/${s.pacienteId}`} className="mt-3 inline-block text-sm font-bold text-brand-600 hover:text-brand-700">Ver expediente →</Link>}
          </div>
        </div>

        {nueva && !confirmando && (
          <div className="flex shrink-0 items-center gap-3 sm:flex-col sm:items-stretch">
            <button type="button" onClick={onAceptar} disabled={ocupada} aria-label={quiereSerPaciente ? `Aceptar a ${nombre} y crear paciente` : `Marcar atendida la solicitud de ${nombre}`}
              className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-brand-500 px-4 font-bold text-white shadow-sm transition hover:bg-brand-600 disabled:opacity-50 sm:flex-none">
              <Check className="size-5" /> {quiereSerPaciente ? 'Aceptar' : 'Atendida'}
            </button>
            <button type="button" onClick={() => setConfirmando(true)} disabled={ocupada} aria-label={`Rechazar la solicitud de ${nombre}`}
              className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 font-bold text-red-700 transition hover:bg-red-100 disabled:opacity-50 sm:flex-none">
              <X className="size-5" /> Rechazar
            </button>
          </div>
        )}
        {nueva && confirmando && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm sm:w-56">
            <p className="font-semibold text-red-800">{quiereSerPaciente ? '¿Rechazar? No se creará el paciente.' : '¿Descartar esta solicitud?'}</p>
            <div className="mt-3 flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setConfirmando(false)}>Volver</Button>
              <button type="button" onClick={() => { setConfirmando(false); onRechazar() }} className={cx('h-9 rounded-xl bg-red-600 px-3 text-sm font-bold text-white hover:bg-red-700')}>Sí, rechazar</button>
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}

export default function Solicitudes() {
  const { solicitudes, aceptarSolicitud, rechazarSolicitud, notify } = useStore()
  const [tab, setTab] = useState<'nuevas' | 'resueltas'>('nuevas')
  const [ocupada, setOcupada] = useState(false)
  const [creado, setCreado] = useState<Paciente | null>(null)

  const nuevas = solicitudes.filter((s) => s.estado === 'nueva')
  const resueltas = solicitudes.filter((s) => s.estado !== 'nueva')
  const lista = tab === 'nuevas' ? nuevas : resueltas

  const aceptar = async (s: Solicitud) => {
    setOcupada(true)
    const r = await aceptarSolicitud(s.id)
    setOcupada(false)
    if (!r.ok) { notify(ERRORES[r.error], 'error'); return }
    if (r.paciente) {
      notify(`${r.paciente.nombre} ${r.paciente.apellidoPaterno} fue integrado como paciente.`)
      if (supabase) setCreado(r.paciente) // ofrece crear su acceso al portal de inmediato
    } else notify('Solicitud marcada como atendida.')
  }
  const rechazar = async (s: Solicitud) => {
    setOcupada(true)
    const r = await rechazarSolicitud(s.id)
    setOcupada(false)
    notify(r.ok ? 'Solicitud rechazada. No se creó ningún paciente.' : ERRORES[r.error], r.ok ? 'ok' : 'error')
  }

  return (
    <>
      <PageHeader title="Solicitudes" subtitle="Personas que escribieron desde el sitio. Acepta para integrarlas como pacientes o recházalas." />
      <div className="mb-5"><Tabs value={tab} onChange={setTab} items={[{ value: 'nuevas', label: 'Nuevas', count: nuevas.length }, { value: 'resueltas', label: 'Resueltas', count: resueltas.length }]} /></div>
      {lista.length === 0 ? (
        <Card><EmptyState icon={<Inbox className="size-6" />} title={tab === 'nuevas' ? 'No hay solicitudes nuevas' : 'Aún no hay solicitudes resueltas'} text={tab === 'nuevas' ? 'Cuando alguien llene el formulario del sitio, aparecerá aquí.' : undefined} /></Card>
      ) : (
        <div className="space-y-4">{lista.map((s) => <Tarjeta key={s.id} s={s} ocupada={ocupada} onAceptar={() => void aceptar(s)} onRechazar={() => void rechazar(s)} />)}</div>
      )}
      {creado && <AccesoPortalModal paciente={creado} onCerrar={() => setCreado(null)} />}
    </>
  )
}
