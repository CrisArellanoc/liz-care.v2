import { asset } from '../../lib/asset'
import {
  ArrowRight, CalendarCheck2, CalendarDays, Check, ClipboardList, FileHeart, Globe2, HeartHandshake,
  Languages, Lock, MapPin, Menu, MessageCircle, Phone, Pill, Search, ShieldCheck, Smartphone, Stethoscope, X,
} from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Logo, LogoMark } from '../../components/Logo'
import { Avatar, Badge, Button, ButtonLink, Card, Field, Input, Select, Textarea, cx } from '../../components/ui'
import { PAISES } from '../../modules/pacientes/registro'
import { especialistas } from '../../data/mock'
import { useStore } from '../../lib/store'

const especialidades = Array.from(new Set(especialistas.map((e) => e.especialidad))).sort()

function Navbar() {
  const [open, setOpen] = useState(false)
  const links = [
    ['Servicios', '#servicios'], ['Cómo funciona', '#como-funciona'], ['Portal', '#portal'], ['Contacto', '#contacto'],
  ]
  return (
    <header className="sticky top-0 z-40 border-b border-ink-100/70 bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex h-18 max-w-7xl items-center gap-8 px-4 sm:px-6 lg:px-8">
        <Logo />
        <nav className="hidden flex-1 items-center gap-1 lg:flex">
          {links.map(([l, h]) => (
            <a key={h} href={h} className="rounded-full px-3.5 py-2 text-sm font-semibold text-ink-600 transition hover:bg-ink-50 hover:text-ink-900">{l}</a>
          ))}
        </nav>
        <div className="ml-auto hidden items-center gap-2 sm:flex">
          <ButtonLink to="/login?rol=admin" variant="ghost" size="sm">Soy administradora</ButtonLink>
          <ButtonLink to="/login?rol=paciente" size="sm">Portal del paciente <ArrowRight className="size-4" /></ButtonLink>
        </div>
        <button className="ml-auto grid size-10 place-items-center rounded-full hover:bg-ink-100 sm:ml-0 lg:hidden" onClick={() => setOpen(!open)} aria-label="Menú">
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>
      {open && (
        <div className="animate-fade-up border-t border-ink-100 bg-white px-4 py-4 lg:hidden">
          {links.map(([l, h]) => (
            <a key={h} href={h} onClick={() => setOpen(false)} className="block rounded-xl px-3 py-3 font-semibold text-ink-700 hover:bg-ink-50">{l}</a>
          ))}
          <div className="mt-3 grid gap-2 sm:hidden">
            <ButtonLink to="/login?rol=paciente">Portal del paciente</ButtonLink>
            <ButtonLink to="/login?rol=admin" variant="outline">Soy administradora</ButtonLink>
          </div>
        </div>
      )}
    </header>
  )
}

function Hero({ onBuscar }: { onBuscar: (esp: string) => void }) {
  const [esp, setEsp] = useState('')
  const dr = especialistas[0]
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-brand-50 via-brand-50/40 to-white">
      <div className="pointer-events-none absolute -right-40 -top-40 size-[520px] rounded-full bg-brand-200/40 blur-3xl" />
      <div className="pointer-events-none absolute -left-32 top-64 size-80 rounded-full bg-sky-200/30 blur-3xl" />
      <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 pb-20 pt-12 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:px-8 lg:pb-28 lg:pt-20">
        <div className="animate-fade-up">
          <Badge tone="brand" className="mb-5 bg-white px-3 py-1 shadow-sm" icon={<Globe2 className="size-3.5" />}>Para pacientes extranjeros en México</Badge>
          <h1 className="text-4xl font-extrabold leading-[1.08] tracking-tight text-ink-900 sm:text-5xl lg:text-[58px]">
            Tu salud en México,<br /><span className="text-brand-500">acompañada</span> en cada paso.
          </h1>
          <p className="mt-3 text-lg font-medium italic text-ink-400">Your health in Mexico, guided every step of the way.</p>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-600">
            Agendamos tus citas con especialistas públicos y privados, te acompañamos a cada consulta, traducimos por ti
            y guardamos tu expediente y tus recetas en un solo lugar seguro.
          </p>

          <form onSubmit={(e) => { e.preventDefault(); onBuscar(esp) }}
            className="mt-8 flex flex-col gap-2 rounded-3xl bg-white p-2 shadow-float sm:flex-row sm:items-center sm:rounded-full">
            <label className="flex min-w-0 flex-1 items-center gap-3 px-4 py-2 sm:py-0">
              <Stethoscope className="size-5 shrink-0 text-brand-500" />
              <select value={esp} onChange={(e) => setEsp(e.target.value)} className="h-10 w-full bg-transparent text-sm font-medium text-ink-800 focus:outline-none" aria-label="Especialidad">
                <option value="">¿Qué especialista necesitas?</option>
                {especialidades.map((e) => <option key={e}>{e}</option>)}
              </select>
            </label>
            <div className="hidden h-8 w-px bg-ink-100 sm:block" />
            <div className="flex shrink-0 items-center gap-2 px-4 py-2 text-sm font-medium text-ink-600 sm:py-0">
              <MapPin className="size-5 shrink-0 text-brand-500" /> León, Gto.
            </div>
            <Button type="submit" size="lg" className="sm:h-12"><Search className="size-4.5" /> Solicitar cita</Button>
          </form>

        </div>

        <div className="relative mx-auto w-full max-w-xl animate-fade-up [animation-delay:120ms] lg:max-w-none">
          <div className="relative overflow-hidden rounded-[2rem] shadow-float">
            <img src={asset('images/hero.jpg')} alt="Médica conversando con una paciente en consultorio" className="aspect-[5/4] w-full object-cover sm:aspect-[4/3.6]" />
            <div className="absolute inset-0 bg-gradient-to-t from-ink-950/30 via-transparent to-transparent" />
          </div>

          <div className="absolute -left-4 bottom-10 w-72 animate-float rounded-2xl bg-white p-4 shadow-float sm:-left-10">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-ink-400">Próxima cita</span>
              <Badge tone="brand">Confirmada</Badge>
            </div>
            <div className="flex items-center gap-3">
              <Avatar name={dr.nombre} src={dr.foto} size={42} />
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">{dr.nombre}</p>
                <p className="text-xs text-ink-500">{dr.especialidad}</p>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-ink-50 px-3 py-2 text-xs font-semibold text-ink-700">
              <CalendarDays className="size-4 text-brand-500" /> Jueves 10:30 · Liz te acompaña
            </div>
          </div>

          <div className="absolute -right-2 top-8 flex animate-float items-center gap-2.5 rounded-2xl bg-white px-4 py-3 shadow-float [animation-delay:-2s] sm:-right-6">
            <div className="grid size-9 place-items-center rounded-xl bg-sky-50 text-sky-600"><Languages className="size-5" /></div>
            <div><p className="text-sm font-bold">Traducción</p><p className="text-xs text-ink-500">English · Español</p></div>
          </div>

          <div className="absolute -bottom-5 right-6 flex animate-float items-center gap-2.5 rounded-2xl bg-ink-900 px-4 py-3 text-white shadow-float [animation-delay:-4s]">
            <div className="grid size-9 place-items-center rounded-xl bg-white/10 text-brand-300"><Pill className="size-5" /></div>
            <div><p className="text-sm font-bold">Receta disponible</p><p className="text-xs text-white/60">3 medicamentos · ver indicaciones</p></div>
          </div>
        </div>
      </div>
    </section>
  )
}

function TrustBar() {
  const items = [
    { k: 'Sector público y privado', v: 'IMSS, ISSSTE y hospitales privados', icon: Stethoscope },
    { k: 'Atención en tu idioma', v: 'Inglés, francés, alemán y más', icon: Languages },
    { k: 'Expediente digital', v: 'Consultas, tratamientos y recetas', icon: FileHeart },
    { k: 'Privacidad garantizada', v: 'Conforme a la LFPDPPP', icon: ShieldCheck },
  ]
  return (
    <section className="border-y border-ink-100 bg-white">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 py-8 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
        {items.map(({ k, v, icon: Icon }) => (
          <div key={k} className="flex items-center gap-3">
            <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-600"><Icon className="size-5" /></div>
            <div><p className="font-bold text-ink-900">{k}</p><p className="text-sm text-ink-500">{v}</p></div>
          </div>
        ))}
      </div>
    </section>
  )
}

function Servicios() {
  const s = [
    { t: 'Agenda de citas', d: 'Buscamos al especialista adecuado y agendamos tu cita en el sistema público o privado.', icon: CalendarCheck2, c: 'bg-brand-50 text-brand-600' },
    { t: 'Acompañamiento a consulta', d: 'Liz va contigo a cada consulta para que nunca te sientas perdido en el sistema de salud.', icon: HeartHandshake, c: 'bg-rose-50 text-rose-600' },
    { t: 'Traducción médica', d: 'Traducimos lo que dice el médico y te explicamos tu diagnóstico en tu idioma.', icon: Languages, c: 'bg-sky-50 text-sky-600' },
    { t: 'Compra de medicamentos', d: 'Te ayudamos a surtir tu receta y a entender cómo tomar cada medicamento.', icon: Pill, c: 'bg-amber-50 text-amber-600' },
  ]
  return (
    <section id="servicios" className="scroll-mt-20 py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-bold uppercase tracking-wider text-brand-600">Servicios</p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">Todo lo que necesitas para atenderte en México</h2>
          <p className="mt-4 text-lg text-ink-500">Un solo contacto de confianza para tus citas, consultas, tratamientos y recetas.</p>
        </div>
        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {s.map(({ t, d, icon: Icon, c }) => (
            <Card key={t} className="group p-6 transition duration-300 hover:-translate-y-1 hover:shadow-float">
              <div className={cx('mb-5 grid size-13 place-items-center rounded-2xl transition group-hover:scale-110', c)}><Icon className="size-6" /></div>
              <h3 className="text-lg font-bold">{t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-500">{d}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}

function ComoFunciona() {
  const pasos = [
    { t: 'Te registramos', d: 'Damos de alta tu información básica y tu contacto de emergencia, y te enviamos tu acceso al portal.', icon: ClipboardList },
    { t: 'Llenas tu historial', d: 'Desde tu celular capturas tus padecimientos, alergias y tratamientos en un formulario sencillo.', icon: Smartphone },
    { t: 'Te acompañamos', d: 'Agendamos tu cita con el especialista adecuado y registramos el resumen, tu tratamiento y tu receta.', icon: HeartHandshake },
    { t: 'Consultas todo', d: 'En tu portal ves tus próximas citas, tu expediente y cómo tomar tus medicamentos.', icon: FileHeart },
  ]
  return (
    <section id="como-funciona" className="scroll-mt-20 bg-ink-50 py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-bold uppercase tracking-wider text-brand-600">Cómo funciona</p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">Tu atención, ordenada en cuatro pasos</h2>
          <p className="mt-4 text-lg text-ink-500">Sin papeles perdidos ni llamadas para preguntar lo mismo: todo queda en un solo lugar.</p>
        </div>
        <ol className="relative mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <div aria-hidden className="absolute left-[12.5%] right-[12.5%] top-6 hidden border-t-2 border-dashed border-brand-200 lg:block" />
          {pasos.map(({ t, d, icon: Icon }, i) => (
            <li key={t} className="relative flex flex-col items-center text-center">
              <span className="relative grid size-12 place-items-center rounded-full bg-brand-500 text-lg font-extrabold text-white ring-8 ring-ink-50">{i + 1}</span>
              <Card className="mt-6 flex w-full flex-1 flex-col items-center p-6">
                <div className="grid size-11 place-items-center rounded-xl bg-brand-50 text-brand-600"><Icon className="size-5.5" /></div>
                <h3 className="mt-4 font-bold">{t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-500">{d}</p>
              </Card>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

function PhoneMock() {
  return (
    <div className="relative mx-auto w-[260px] rounded-[2.6rem] border-[10px] border-ink-900 bg-ink-900 shadow-float">
      <div className="absolute left-1/2 top-2 z-10 h-5 w-20 -translate-x-1/2 rounded-full bg-ink-900" />
      <div className="overflow-hidden rounded-[2rem] bg-ink-50">
        <div className="bg-gradient-to-br from-brand-500 to-brand-700 px-4 pb-10 pt-9 text-white">
          <p className="text-[10px] font-semibold text-white/70">Good morning</p>
          <p className="text-base font-extrabold">Emily Carter</p>
        </div>
        <div className="-mt-7 space-y-2.5 px-3 pb-5">
          <div className="rounded-2xl bg-white p-3 shadow-card">
            <p className="text-[9px] font-bold uppercase tracking-wider text-ink-400">Next appointment</p>
            <div className="mt-2 flex items-center gap-2">
              <img src={especialistas[4].foto} alt="" className="size-8 rounded-full object-cover object-top" />
              <div><p className="text-[11px] font-bold">Dr. Ernesto Ramírez</p><p className="text-[9px] text-ink-500">Endocrinology · Tue 12:00</p></div>
            </div>
          </div>
          <div className="rounded-2xl bg-white p-3 shadow-card">
            <p className="text-[9px] font-bold uppercase tracking-wider text-ink-400">Today’s medication</p>
            {[['Losartan 50 mg', 'Morning', 'bg-amber-100 text-amber-700'], ['Aspirin 100 mg', 'Afternoon', 'bg-sky-100 text-sky-700'], ['Atorvastatin 20 mg', 'Night', 'bg-violet-100 text-violet-700']].map(([m, h, c]) => (
              <div key={m} className="mt-2 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[11px] font-semibold"><Pill className="size-3 text-brand-500" />{m}</span>
                <span className={cx('rounded-full px-1.5 py-0.5 text-[8px] font-bold', c)}>{h}</span>
              </div>
            ))}
          </div>
          <div className="overflow-hidden rounded-2xl bg-white shadow-card">
            <img src={asset('images/receta-ejemplo.png')} alt="" className="h-20 w-full object-cover object-top" />
            <p className="px-3 py-2 text-[10px] font-bold">Prescription photo</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function DashboardMock() {
  return (
    <div className="w-[520px] overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-float">
      <div className="flex items-center gap-1.5 border-b border-ink-100 bg-ink-50 px-3 py-2">
        <span className="size-2.5 rounded-full bg-red-300" /><span className="size-2.5 rounded-full bg-amber-300" /><span className="size-2.5 rounded-full bg-green-300" />
        <span className="ml-3 rounded-md bg-white px-3 py-0.5 text-[10px] text-ink-400">app.lizcare.mx/admin</span>
      </div>
      <div className="flex">
        <div className="w-28 space-y-1.5 border-r border-ink-100 p-3">
          <LogoMark className="mb-3 size-6" />
          {['Inicio', 'Pacientes', 'Agenda', 'Especialistas'].map((x, i) => (
            <div key={x} className={cx('rounded-md px-2 py-1 text-[10px] font-semibold', i === 1 ? 'bg-brand-50 text-brand-700' : 'text-ink-500')}>{x}</div>
          ))}
        </div>
        <div className="flex-1 p-4">
          <p className="text-xs font-extrabold">Emily Carter</p>
          <p className="text-[9px] text-ink-500">Hipertensión arterial · 41 años · EE. UU.</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {[['4', 'Consultas'], ['3', 'Especialistas'], ['2', 'Alergias']].map(([n, l]) => (
              <div key={l} className="rounded-lg bg-ink-50 p-2"><p className="text-sm font-extrabold text-brand-600">{n}</p><p className="text-[9px] text-ink-500">{l}</p></div>
            ))}
          </div>
          <div className="mt-3 space-y-2">
            {especialistas.slice(0, 3).map((e, i) => (
              <div key={e.id} className="flex items-center gap-2 rounded-lg border border-ink-100 p-2">
                <span className="size-1.5 rounded-full bg-brand-500" />
                <img src={e.foto} alt="" className="size-5 rounded-full object-cover object-top" />
                <span className="flex-1 text-[10px] font-semibold">{e.especialidad}</span>
                <span className="text-[9px] text-ink-400">{['24 sep', '28 ago', '15 jul'][i]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function PortalSection() {
  return (
    <section id="portal" className="scroll-mt-20 overflow-hidden bg-gradient-to-b from-white via-brand-50/50 to-white py-20 lg:py-28">
      <div className="mx-auto grid max-w-7xl items-center gap-16 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
        <div>
          <p className="text-sm font-bold uppercase tracking-wider text-brand-600">Plataforma Liz Care</p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">Tu expediente, tus citas y tu receta, siempre en tu bolsillo.</h2>
          <p className="mt-4 text-lg text-ink-500">Una aplicación web que funciona en tu celular y en tu computadora, sin instalar nada.</p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {[
              ['Próximas citas', 'Fecha, hora, médico y dirección.', CalendarDays],
              ['Tratamiento claro', 'Qué tomar, cuánto y a qué hora.', Pill],
              ['Foto de tu receta', 'Disponible aunque pierdas el papel.', FileHeart],
              ['En tu idioma', 'Portal en español e inglés.', Languages],
            ].map(([t, d, Icon]) => {
              const I = Icon as typeof Pill
              return (
                <div key={t as string} className="flex gap-3">
                  <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-brand-600 shadow-card"><I className="size-5" /></div>
                  <div><p className="font-bold">{t as string}</p><p className="text-sm text-ink-500">{d as string}</p></div>
                </div>
              )
            })}
          </div>
          <div className="mt-10 flex flex-wrap gap-3">
            <ButtonLink to="/login?rol=paciente" size="lg">Probar el portal <ArrowRight className="size-4.5" /></ButtonLink>
            <ButtonLink to="/login?rol=admin" size="lg" variant="outline">Ver panel administrativo</ButtonLink>
          </div>
        </div>
        <div className="perspective-stage relative h-[460px] sm:h-[520px]">
          <div className="absolute left-1/2 top-1/2 -translate-x-[62%] -translate-y-[58%] scale-[.68] sm:scale-90 lg:scale-100">
            <div className="tilt-left"><DashboardMock /></div>
          </div>
          <div className="absolute left-1/2 top-1/2 translate-x-[-10%] -translate-y-[42%] scale-[.78] sm:translate-x-[8%] sm:scale-90 lg:scale-100">
            <div className="tilt-right animate-float"><PhoneMock /></div>
          </div>
        </div>
      </div>
    </section>
  )
}

function Privacidad() {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-10 rounded-[2rem] border border-ink-100 bg-white p-8 shadow-card lg:grid-cols-[1fr_1.3fr] lg:p-12">
          <div className="relative overflow-hidden rounded-3xl">
            <img src={asset('images/registro.jpg')} alt="Médico escribiendo en un expediente" className="aspect-[4/3] w-full object-cover" />
            <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-white/95 px-3 py-1.5 text-xs font-bold text-ink-800"><Lock className="size-3.5 text-brand-600" /> Acceso protegido</div>
          </div>
          <div>
            <ShieldCheck className="size-10 text-brand-500" />
            <h2 className="mt-4 text-3xl font-extrabold tracking-tight">Tu información de salud, protegida.</h2>
            <p className="mt-3 text-lg text-ink-500">Cumplimos con la Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP).</p>
            <ul className="mt-6 space-y-3">
              {[
                'Solo tú y la administradora pueden ver tu expediente y tus recetas.',
                'Acceso con usuario y contraseña, con permisos diferenciados por rol.',
                'Guardamos únicamente los datos necesarios para tu atención.',
                'Nadie sin sesión iniciada puede ver datos de pacientes.',
              ].map((x) => (
                <li key={x} className="flex gap-3 text-ink-700"><span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-brand-500 text-white"><Check className="size-3.5" /></span>{x}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}

const IDIOMAS_FORM = ['Inglés', 'Español', 'Francés', 'Alemán', 'Portugués', 'Italiano', 'Japonés', 'Coreano', 'Chino', 'Otro']
const PARENTESCOS_FORM = ['Esposo(a)', 'Pareja', 'Padre', 'Madre', 'Hijo(a)', 'Hermano(a)', 'Amigo(a)', 'Otro']

const formVacio = {
  nombre: '', apellidoPaterno: '', apellidoMaterno: '', telefono: '', email: '', especialidad: '', idioma: '', mensaje: '',
  fechaNacimiento: '', sexo: '' as '' | 'F' | 'M' | 'X', nacionalidad: '', emNombre: '', emParentesco: '', emTelefono: '',
}

function Contacto({ especialidad, setEspecialidad }: { especialidad: string; setEspecialidad: (s: string) => void }) {
  const { enviarSolicitud } = useStore()
  const [enviado, setEnviado] = useState<'cita' | 'informes' | null>(null)
  const [motivo, setMotivo] = useState<'cita' | 'informes'>('cita')
  const [f, setF] = useState(formVacio)
  const [errores, setErrores] = useState<Partial<Record<keyof typeof formVacio, string>>>({})
  const [aviso, setAviso] = useState(false)
  const [trampa, setTrampa] = useState('') // campo oculto: un bot lo llena, una persona no
  const [enviando, setEnviando] = useState(false)
  const [fallo, setFallo] = useState(false)
  const set = (k: keyof typeof formVacio) => (e: { target: { value: string } }) => { setF((x) => ({ ...x, [k]: e.target.value })); setErrores((x) => ({ ...x, [k]: undefined })) }
  const esp = especialidad

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (enviando) return
    if (trampa) { setEnviado(motivo); return } // bot: se finge éxito y no se guarda nada
    const er: typeof errores = {}
    const req = (k: keyof typeof formVacio) => { if (!f[k].trim()) er[k] = 'Este dato es obligatorio.' }
    ;(['nombre', 'apellidoPaterno', 'telefono', 'email'] as const).forEach(req)
    if (f.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) er.email = 'Escribe un correo válido.'
    if (motivo === 'cita') {
      ;(['idioma', 'mensaje', 'fechaNacimiento', 'sexo', 'nacionalidad', 'emNombre', 'emParentesco', 'emTelefono'] as const).forEach(req)
      if (f.fechaNacimiento && f.fechaNacimiento > new Date().toISOString().slice(0, 10)) er.fechaNacimiento = 'La fecha no puede ser futura.'
    }
    setErrores(er)
    if (Object.keys(er).length) { requestAnimationFrame(() => document.querySelector('#contacto [aria-invalid="true"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' })); return }
    setEnviando(true); setFallo(false)
    const cita = motivo === 'cita'
    const ok = await enviarSolicitud({
      tipo: motivo, nombre: f.nombre.trim(), apellidoPaterno: f.apellidoPaterno.trim(), apellidoMaterno: f.apellidoMaterno.trim() || undefined,
      telefono: f.telefono.trim(), email: f.email.trim().toLowerCase(), especialidad: esp || undefined, idioma: f.idioma || undefined, mensaje: f.mensaje.trim() || undefined,
      ...(cita ? {
        fechaNacimiento: f.fechaNacimiento, sexo: f.sexo || undefined, nacionalidad: f.nacionalidad, pais: PAISES[f.nacionalidad] ?? 'XX',
        contactoEmergencia: { nombre: f.emNombre.trim(), parentesco: f.emParentesco, telefono: f.emTelefono.trim() },
      } : {}),
    })
    setEnviando(false)
    if (!ok) { setFallo(true); return }
    setEnviado(motivo); setF(formVacio); setAviso(false)
  }
  const inv = (k: keyof typeof formVacio) => ({ invalid: !!errores[k], 'aria-invalid': !!errores[k] })
  return (
    <section id="contacto" className="relative scroll-mt-20 overflow-hidden">
      <img src={asset('images/guanajuato.jpg')} alt="" className="absolute inset-0 size-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-r from-ink-950/95 via-ink-900/85 to-ink-900/50" />
      <div className="relative mx-auto grid max-w-7xl items-start gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:px-8 lg:py-28">
        <div className="text-white lg:sticky lg:top-28">
          <p className="text-sm font-bold uppercase tracking-wider text-brand-300">Bienvenido a Guanajuato · Welcome</p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-5xl">¿Acabas de llegar a México? Nosotros te guiamos.</h2>
          <p className="mt-5 max-w-lg text-lg text-white/70">Solicita ser paciente o pide informes. La administradora revisa cada solicitud y te contacta para guiarte.</p>
          <div className="mt-8 space-y-3 text-white/85">
            <p className="flex items-center gap-3"><Phone className="size-5 text-brand-300" /> +52 477 000 0000</p>
            <p className="flex items-center gap-3"><MessageCircle className="size-5 text-brand-300" /> WhatsApp disponible 8:00 – 20:00</p>
            <p className="flex items-center gap-3"><MapPin className="size-5 text-brand-300" /> León, Guanajuato, México</p>
          </div>
        </div>
        <Card className="p-6 sm:p-8">
          {enviado ? (
            <div className="py-10 text-center" role="status">
              <div className="mx-auto grid size-16 place-items-center rounded-full bg-brand-50 text-brand-600"><Check className="size-8" /></div>
              <h3 className="mt-5 text-xl font-bold">¡Gracias! Recibimos tu solicitud.</h3>
              <p className="mt-2 text-ink-500">{enviado === 'cita' ? 'La administradora la revisará y te escribirá al correo que nos diste. Si es aceptada, te enviaremos tu acceso al portal.' : 'La administradora te responderá pronto al correo que nos diste.'}</p>
              <Button variant="outline" className="mt-6" onClick={() => setEnviado(null)}>Enviar otra solicitud</Button>
            </div>
          ) : (
            <form onSubmit={(e) => void submit(e)} className="space-y-4" noValidate>
              <h3 className="text-xl font-bold">¿En qué te podemos ayudar?</h3>
              <div className="grid grid-cols-2 rounded-2xl bg-ink-100 p-1" role="radiogroup" aria-label="Tipo de solicitud">
                {([['cita', 'Quiero ser paciente'], ['informes', 'Solicitar informes']] as const).map(([v, l]) => (
                  <button key={v} type="button" role="radio" aria-checked={motivo === v} onClick={() => setMotivo(v)}
                    className={cx('rounded-xl py-2.5 text-sm font-bold transition', motivo === v ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-800')}>{l}</button>
                ))}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nombre(s)" required error={errores.nombre}><Input autoComplete="given-name" value={f.nombre} onChange={set('nombre')} {...inv('nombre')} /></Field>
                <Field label="Primer apellido" required error={errores.apellidoPaterno}><Input autoComplete="family-name" value={f.apellidoPaterno} onChange={set('apellidoPaterno')} {...inv('apellidoPaterno')} /></Field>
                <Field label="Segundo apellido" optional><Input value={f.apellidoMaterno} onChange={set('apellidoMaterno')} /></Field>
                <Field label="WhatsApp o teléfono" required error={errores.telefono}><Input type="tel" autoComplete="tel" value={f.telefono} onChange={set('telefono')} {...inv('telefono')} /></Field>
              </div>
              <Field label="Correo electrónico" required error={errores.email} hint="Con este correo entrarás a tu portal si te aceptamos."><Input type="email" autoComplete="email" value={f.email} onChange={set('email')} {...inv('email')} /></Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Idioma preferido" required={motivo === 'cita'} optional={motivo !== 'cita'} error={errores.idioma}>
                  <Select value={f.idioma} onChange={set('idioma')} {...inv('idioma')}><option value="">Selecciona</option>{IDIOMAS_FORM.map((l) => <option key={l}>{l}</option>)}</Select>
                </Field>
                <Field label="Especialidad" optional>
                  <Select value={esp} onChange={(e) => setEspecialidad(e.target.value)}><option value="">Si la sabes</option>{especialidades.map((x) => <option key={x}>{x}</option>)}</Select>
                </Field>
              </div>
              {motivo === 'cita' && (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Fecha de nacimiento" required error={errores.fechaNacimiento}><Input type="date" max={new Date().toISOString().slice(0, 10)} value={f.fechaNacimiento} onChange={set('fechaNacimiento')} {...inv('fechaNacimiento')} /></Field>
                    <Field label="Sexo" required error={errores.sexo}>
                      <Select value={f.sexo} onChange={set('sexo')} {...inv('sexo')}><option value="">Selecciona</option><option value="F">Femenino</option><option value="M">Masculino</option><option value="X">Prefiero no decir</option></Select>
                    </Field>
                    <Field label="Nacionalidad" required error={errores.nacionalidad} className="sm:col-span-2">
                      <Select value={f.nacionalidad} onChange={set('nacionalidad')} {...inv('nacionalidad')}><option value="">Selecciona</option>{Object.keys(PAISES).map((n) => <option key={n}>{n}</option>)}</Select>
                    </Field>
                  </div>
                  <p className="pt-1 text-sm font-bold">Contacto de emergencia</p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Nombre completo" required error={errores.emNombre}><Input value={f.emNombre} onChange={set('emNombre')} {...inv('emNombre')} /></Field>
                    <Field label="Parentesco" required error={errores.emParentesco}>
                      <Select value={f.emParentesco} onChange={set('emParentesco')} {...inv('emParentesco')}><option value="">Selecciona</option>{PARENTESCOS_FORM.map((n) => <option key={n}>{n}</option>)}</Select>
                    </Field>
                    <Field label="Teléfono" required error={errores.emTelefono} className="sm:col-span-2"><Input type="tel" value={f.emTelefono} onChange={set('emTelefono')} {...inv('emTelefono')} /></Field>
                  </div>
                </>
              )}
              <Field label={motivo === 'cita' ? 'Motivo principal de tu atención' : '¿Qué información necesitas?'} required={motivo === 'cita'} optional={motivo !== 'cita'} error={errores.mensaje}>
                <Textarea value={f.mensaje} onChange={set('mensaje')} maxLength={1000} placeholder={motivo === 'cita' ? 'Ej. Control de hipertensión, dolor lumbar…' : ''} {...inv('mensaje')} />
              </Field>
              <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden"><label>Sitio web<input tabIndex={-1} autoComplete="off" value={trampa} onChange={(e) => setTrampa(e.target.value)} /></label></div>
              <label className="flex items-start gap-2.5 text-xs text-ink-500">
                <input type="checkbox" checked={aviso} onChange={(e) => setAviso(e.target.checked)} className="mt-0.5 size-4 accent-brand-500" />
                <span>Acepto el <Link to="/privacidad" className="font-semibold text-brand-600 underline">aviso de privacidad</Link> y el tratamiento de mis datos conforme a la LFPDPPP.</span>
              </label>
              {fallo && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700">No pudimos enviar tu solicitud. Revisa tu conexión e inténtalo de nuevo.</p>}
              <Button type="submit" size="lg" className="w-full" disabled={enviando || !aviso}>{enviando ? 'Enviando…' : motivo === 'cita' ? 'Solicitar ser paciente' : 'Solicitar informes'} <ArrowRight className="size-4.5" /></Button>
              {!aviso && <p className="text-center text-xs text-ink-400">Acepta el aviso de privacidad para poder enviar.</p>}
            </form>
          )}
        </Card>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="bg-ink-950 text-white/60">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-12 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
        <div>
          <Logo light />
          <p className="mt-3 max-w-xs text-sm">Acompañamiento médico para pacientes extranjeros en México.</p>
        </div>
        <div className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
          <a href="#servicios" className="hover:text-white">Servicios</a>
          <Link to="/login?rol=paciente" className="hover:text-white">Portal del paciente</Link>
          <Link to="/privacidad" className="hover:text-white">Aviso de privacidad</Link>
        </div>
      </div>
      <div className="border-t border-white/10">
        <p className="mx-auto max-w-7xl px-4 py-5 text-xs sm:px-6 lg:px-8">© {new Date().getFullYear()} Liz Care · Desarrollado por Summit AI SA de CV · Fotografías: Unsplash · Prototipo de demostración: médicos, pacientes, hospitales y opiniones son ficticios.</p>
      </div>
    </footer>
  )
}

export default function Landing() {
  const [especialidad, setEspecialidad] = useState('')
  const irAContacto = (esp: string) => {
    setEspecialidad(esp)
    document.getElementById('contacto')?.scrollIntoView({ behavior: 'smooth' })
  }
  return (
    <div className="bg-white">
      <Navbar />
      <Hero onBuscar={irAContacto} />
      <TrustBar />
      <Servicios />
      <ComoFunciona />
      <PortalSection />
      <Privacidad />
      <Contacto especialidad={especialidad} setEspecialidad={setEspecialidad} />
      <Footer />
    </div>
  )
}
