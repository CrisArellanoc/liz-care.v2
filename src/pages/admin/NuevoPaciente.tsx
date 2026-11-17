import { AlertTriangle, ArrowLeft, HeartPulse, Phone, Save, Send, ShieldAlert, UserRound } from 'lucide-react'
import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Avatar, Button, ButtonLink, Card, Field, Input, PageHeader, Select, Toggle } from '../../components/ui'
import { edad, fechaCorta, nombreCompleto } from '../../lib/format'
import { useStore } from '../../lib/store'
import { PAISES, registrarPaciente } from '../../modules/pacientes/registro'
import { buscarDuplicados, datosAltaVacios, type DatosAlta, type ErroresAlta } from '../../modules/pacientes/validacion'

const nacionalidades = Object.keys(PAISES)
const idiomas = ['Inglés', 'Español', 'Francés', 'Alemán', 'Portugués', 'Italiano', 'Japonés', 'Coreano', 'Chino', 'Otro']
const parentescos = ['Esposo(a)', 'Pareja', 'Padre', 'Madre', 'Hijo(a)', 'Hermano(a)', 'Amigo(a)', 'Otro']

type Form = DatosAlta

function Seccion({ icon, title, desc, children }: { icon: ReactNode; title: string; desc: string; children: ReactNode }) {
  return (
    <Card className="p-5 sm:p-6">
      <div className="mb-5 flex items-start gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">{icon}</div>
        <div><h2 className="font-bold">{title}</h2><p className="text-sm text-ink-500">{desc}</p></div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </Card>
  )
}

export default function NuevoPaciente() {
  const { pacientes, sesion, agregarPaciente, notify } = useStore()
  const navigate = useNavigate()
  const [f, setF] = useState<Form>(datosAltaVacios)
  const [errores, setErrores] = useState<ErroresAlta>({})
  const [invitar, setInvitar] = useState(true)
  const [confirmarDuplicado, setConfirmarDuplicado] = useState(false)
  const [guardando, setGuardando] = useState(false)

  const set = (k: keyof Form) => (e: { target: { value: string } }) => {
    setF((x) => ({ ...x, [k]: e.target.value }))
    if (errores[k]) setErrores((x) => ({ ...x, [k]: undefined }))
    setConfirmarDuplicado(false)
  }

  const { porCorreo, porNombre } = useMemo(() => buscarDuplicados(f, pacientes), [f, pacientes])
  const duplicados = porCorreo.length ? porCorreo : porNombre
  const bloqueaCorreo = porCorreo.length > 0

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (guardando) return
    setGuardando(true)
    const r = await registrarPaciente(f, { sesion, pacientes, guardar: agregarPaciente, invitarAlPortal: invitar, confirmaHomonimo: confirmarDuplicado })
    setGuardando(false)
    if (r.ok) {
      notify(invitar ? `${r.paciente.nombre} fue registrado. El acceso al portal quedó pendiente de activación.` : `${r.paciente.nombre} fue registrado correctamente.`)
      navigate(`/admin/pacientes/${r.paciente.id}`)
      return
    }
    // Ante cualquier error se conservan los datos capturados para corregir o reintentar.
    switch (r.motivo) {
      case 'sin-permiso':
        notify('Solo una administradora puede registrar pacientes.', 'error')
        return
      case 'datos-invalidos':
        setErrores(r.errores)
        notify('Revisa los campos marcados en rojo.', 'error')
        requestAnimationFrame(() => document.querySelector('[aria-invalid="true"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
        return
      case 'correo-duplicado':
        setErrores({ email: 'Este correo ya pertenece a un paciente registrado.' })
        notify('No se registró: el correo ya existe.', 'error')
        window.scrollTo({ top: 0, behavior: 'smooth' })
        return
      case 'posible-homonimo':
        setConfirmarDuplicado(true)
        window.scrollTo({ top: 0, behavior: 'smooth' })
        return
      case 'error-guardado':
        notify('No se pudo guardar el paciente. Tus datos siguen en el formulario; intenta de nuevo.', 'error')
    }
  }

  const inv = (k: keyof Form) => ({ invalid: !!errores[k], 'aria-invalid': !!errores[k] })

  return (
    <form onSubmit={submit} noValidate>
      <PageHeader
        back={<Link to="/admin/pacientes" className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-500 hover:text-ink-900"><ArrowLeft className="size-4" /> Pacientes</Link>}
        title="Registrar paciente"
        subtitle="Captura la información básica. El historial médico lo llenará el paciente desde su portal."
      />

      {duplicados.length > 0 && (
        <div className={`mb-6 animate-fade-up rounded-2xl border p-4 sm:p-5 ${bloqueaCorreo || confirmarDuplicado ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'}`} role="alert">
          <div className="flex gap-3">
            <AlertTriangle className={`size-5 shrink-0 ${bloqueaCorreo || confirmarDuplicado ? 'text-red-600' : 'text-amber-600'}`} />
            <div className="flex-1">
              <p className="font-bold text-ink-900">{bloqueaCorreo ? 'Correo ya registrado' : 'Posible paciente duplicado'}</p>
              <p className="text-sm text-ink-600">
                {bloqueaCorreo
                  ? 'Ya existe un paciente con este correo. No se puede registrar de nuevo; abre su expediente o corrige el correo.'
                  : confirmarDuplicado
                    ? 'Confirma que se trata de una persona distinta. Presiona “Guardar paciente” otra vez para registrarlo de todos modos.'
                    : 'Ya existe un paciente con el mismo nombre y fecha de nacimiento. Verifica antes de guardar.'}
              </p>
              <div className="mt-3 space-y-2">
                {duplicados.map((p) => (
                  <Link key={p.id} to={`/admin/pacientes/${p.id}`} className="flex items-center gap-3 rounded-xl bg-white p-3 shadow-sm hover:ring-2 hover:ring-brand-200">
                    <Avatar name={nombreCompleto(p)} color={p.color} size={36} />
                    <div className="min-w-0 text-sm">
                      <p className="truncate font-semibold">{nombreCompleto(p)}</p>
                      <p className="truncate text-ink-500">{p.email} · {edad(p.fechaNacimiento)} años · alta {fechaCorta(p.altaEl)}</p>
                    </div>
                    <span className="ml-auto text-xs font-bold text-brand-600">Ver expediente</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Seccion icon={<UserRound className="size-5" />} title="Datos personales" desc="Nombre como aparece en su pasaporte o identificación.">
            <Field label="Nombre(s)" required error={errores.nombre}><Input value={f.nombre} onChange={set('nombre')} placeholder="Emily" {...inv('nombre')} /></Field>
            <Field label="Primer apellido" required error={errores.apellidoPaterno}><Input value={f.apellidoPaterno} onChange={set('apellidoPaterno')} placeholder="Carter" {...inv('apellidoPaterno')} /></Field>
            <Field label="Segundo apellido" optional hint="Muchos pacientes extranjeros solo tienen un apellido."><Input value={f.apellidoMaterno} onChange={set('apellidoMaterno')} /></Field>
            <Field label="Fecha de nacimiento" required error={errores.fechaNacimiento}><Input type="date" value={f.fechaNacimiento} onChange={set('fechaNacimiento')} max={new Date().toISOString().slice(0, 10)} {...inv('fechaNacimiento')} /></Field>
            <Field label="Sexo" required error={errores.sexo}>
              <Select value={f.sexo} onChange={set('sexo')} {...inv('sexo')}>
                <option value="">Selecciona</option><option value="F">Femenino</option><option value="M">Masculino</option><option value="X">Prefiere no decir</option>
              </Select>
            </Field>
            <Field label="Nacionalidad" required error={errores.nacionalidad}>
              <Select value={f.nacionalidad} onChange={set('nacionalidad')} {...inv('nacionalidad')}>
                <option value="">Selecciona</option>{nacionalidades.map((n) => <option key={n}>{n}</option>)}
              </Select>
            </Field>
            <Field label="Idioma preferido" required error={errores.idioma} hint="Define si necesitará traducción en sus consultas.">
              <Select value={f.idioma} onChange={set('idioma')} {...inv('idioma')}>
                <option value="">Selecciona</option>{idiomas.map((n) => <option key={n}>{n}</option>)}
              </Select>
            </Field>
          </Seccion>

          <Seccion icon={<Phone className="size-5" />} title="Contacto" desc="Datos de contacto para coordinar el acceso al portal y el seguimiento.">
            <Field label="Teléfono / WhatsApp" required error={errores.telefono}><Input type="tel" value={f.telefono} onChange={set('telefono')} placeholder="+1 512 555 0142" {...inv('telefono')} /></Field>
            <Field label="Correo electrónico" required error={errores.email}><Input type="email" value={f.email} onChange={set('email')} placeholder="paciente@correo.com" {...inv('email')} /></Field>
          </Seccion>

          <Seccion icon={<ShieldAlert className="size-5" />} title="Contacto de emergencia" desc="Persona a quien llamar si el paciente no puede comunicarse.">
            <Field label="Nombre completo" required error={errores.emNombre}><Input value={f.emNombre} onChange={set('emNombre')} {...inv('emNombre')} /></Field>
            <Field label="Parentesco" required error={errores.emParentesco}>
              <Select value={f.emParentesco} onChange={set('emParentesco')} {...inv('emParentesco')}>
                <option value="">Selecciona</option>{parentescos.map((n) => <option key={n}>{n}</option>)}
              </Select>
            </Field>
            <Field label="Teléfono" required error={errores.emTelefono}><Input type="tel" value={f.emTelefono} onChange={set('emTelefono')} {...inv('emTelefono')} /></Field>
          </Seccion>

          <Seccion icon={<HeartPulse className="size-5" />} title="Información médica" desc="Solo el motivo principal. El resto lo captura el paciente en su historial inicial.">
            <Field label="Padecimiento principal" required error={errores.padecimientoPrincipal} className="sm:col-span-2">
              <Input value={f.padecimientoPrincipal} onChange={set('padecimientoPrincipal')} placeholder="Ej. Hipertensión arterial, control prenatal, dolor lumbar…" {...inv('padecimientoPrincipal')} />
            </Field>
          </Seccion>
        </div>

        <div className="space-y-4 xl:sticky xl:top-24 xl:self-start">
          <Card className="p-5">
            <h3 className="font-bold">Acceso al portal</h3>
            <p className="mt-1 text-sm text-ink-500">El registro puede quedar pendiente de activación del portal. Este prototipo no envía invitaciones ni crea contraseñas.</p>
            <div className="mt-4"><Toggle checked={invitar} onChange={setInvitar} label="Dejar acceso pendiente de activación" description={f.email || 'Al correo registrado'} /></div>
          </Card>
          <Card className="p-5">
            <p className="text-sm text-ink-500">Los campos con <span className="font-bold text-brand-600">*</span> son obligatorios. Solo se guardan los datos necesarios para la atención del paciente (LFPDPPP).</p>
            <div className="mt-4 grid gap-2">
              <Button type="submit" size="lg" disabled={guardando}>{invitar ? <Send className="size-4.5" /> : <Save className="size-4.5" />} Guardar paciente</Button>
              <ButtonLink to="/admin/pacientes" variant="ghost">Cancelar</ButtonLink>
            </div>
          </Card>
        </div>
      </div>
    </form>
  )
}

