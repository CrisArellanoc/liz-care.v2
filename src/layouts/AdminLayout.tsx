import { Bell, CalendarDays, Inbox, LayoutDashboard, LogOut, Plus, Search, ShieldCheck, Stethoscope, UserPlus, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Logo } from '../components/Logo'
import { Avatar, ButtonLink, cx } from '../components/ui'
import { nombreCompleto, normalizar } from '../lib/format'
import { PantallaCarga } from '../components/PantallaCarga'
import { useStore } from '../lib/store'

const nav = [
  { to: '/admin', label: 'Inicio', icon: LayoutDashboard, end: true },
  { to: '/admin/solicitudes', label: 'Solicitudes', icon: Inbox },
  { to: '/admin/pacientes', label: 'Pacientes', icon: Users },
  { to: '/admin/agenda', label: 'Agenda', icon: CalendarDays },
  { to: '/admin/especialistas', label: 'Especialistas', icon: Stethoscope },
]

function BuscadorGlobal() {
  const { pacientes } = useStore()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const nav = useNavigate()
  const res = useMemo(() => {
    const n = normalizar(q)
    if (!n) return []
    return pacientes.filter((p) => normalizar(`${nombreCompleto(p)} ${p.email} ${p.padecimientoPrincipal}`).includes(n)).slice(0, 6)
  }, [q, pacientes])

  return (
    <div className="relative w-full max-w-md">
      <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4.5 -translate-y-1/2 text-ink-400" />
      <input
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Buscar paciente por nombre, correo o padecimiento…"
        className="h-11 w-full rounded-full border border-ink-100 bg-ink-50 pl-10 pr-4 text-sm placeholder:text-ink-400 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-500/15"
      />
      {open && q && (
        <div className="absolute inset-x-0 top-13 z-30 overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-float">
          {res.length === 0 && <p className="px-4 py-3 text-sm text-ink-500">Sin resultados para “{q}”.</p>}
          {res.map((p) => (
            <button key={p.id} onMouseDown={() => { nav(`/admin/pacientes/${p.id}`); setQ('') }}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-ink-50">
              <Avatar name={nombreCompleto(p)} color={p.color} size={34} />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{nombreCompleto(p)}</span>
                <span className="block truncate text-xs text-ink-500">{p.padecimientoPrincipal}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function AdminLayout() {
  const { sesion, logout, cargando, solicitudes } = useStore()
  const nuevas = solicitudes.filter((x) => x.estado === 'nueva').length
  const contador = (to: string) => (to === '/admin/solicitudes' && nuevas > 0 ? nuevas : 0)
  const navigate = useNavigate()
  const salir = () => { logout(); navigate('/login') }

  return (
    <div className="min-h-dvh">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col border-r border-ink-100 bg-white lg:flex">
        <div className="px-6 pb-6 pt-6"><Logo to="/admin" sub="Panel administrativo" /></div>
        <nav className="flex-1 space-y-1 px-3">
          {nav.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => cx(
              'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition',
              isActive ? 'bg-brand-50 text-brand-700' : 'text-ink-600 hover:bg-ink-50 hover:text-ink-900',
            )}>
              <Icon className="size-5" /> {label}
              {contador(to) > 0 && <span className="ml-auto grid min-w-6 place-items-center rounded-full bg-brand-500 px-1.5 text-xs font-bold text-white" aria-label={`${contador(to)} nuevas`}>{contador(to)}</span>}
            </NavLink>
          ))}
          <div className="px-3 pb-2 pt-6 text-[11px] font-bold uppercase tracking-wider text-ink-400">Acciones rápidas</div>
          <Link to="/admin/pacientes/nuevo" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-ink-600 hover:bg-ink-50 hover:text-ink-900">
            <UserPlus className="size-5" /> Registrar paciente
          </Link>
          <Link to="/admin/consultas/nueva" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-ink-600 hover:bg-ink-50 hover:text-ink-900">
            <Plus className="size-5" /> Registrar consulta
          </Link>
        </nav>
        <div className="m-3 rounded-2xl bg-gradient-to-br from-ink-900 to-ink-800 p-4 text-white">
          <ShieldCheck className="mb-2 size-6 text-brand-300" />
          <p className="text-sm font-bold">Datos protegidos</p>
          <p className="mt-1 text-xs leading-relaxed text-white/70">Acceso por roles y expedientes protegidos conforme a la LFPDPPP.</p>
        </div>
        <div className="flex items-center gap-3 border-t border-ink-100 p-4">
          <Avatar name={sesion?.nombre ?? 'Liz'} color="#00a58c" size={38} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">{sesion?.nombre}</p>
            <p className="truncate text-xs text-ink-500">Administradora</p>
          </div>
          <button onClick={salir} className="grid size-9 place-items-center rounded-full text-ink-500 hover:bg-ink-100 hover:text-ink-900" title="Cerrar sesión" aria-label="Cerrar sesión">
            <LogOut className="size-4.5" />
          </button>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-10 border-b border-ink-100 bg-white/85 backdrop-blur-md">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
            <div className="lg:hidden"><Logo to="/admin" /></div>
            <div className="hidden flex-1 md:block"><BuscadorGlobal /></div>
            <div className="ml-auto flex items-center gap-2">
              <div className="hidden sm:block"><ButtonLink to="/admin/consultas/nueva" size="sm"><Plus className="size-4" /> Nueva consulta</ButtonLink></div>
              <button className="relative grid size-10 place-items-center rounded-full text-ink-600 hover:bg-ink-100" aria-label="Notificaciones">
                <Bell className="size-5" />
                <span className="absolute right-2.5 top-2.5 size-2 rounded-full bg-red-500 ring-2 ring-white" />
              </button>
              <button onClick={salir} className="grid size-10 place-items-center rounded-full text-ink-600 hover:bg-ink-100 lg:hidden" aria-label="Cerrar sesión">
                <LogOut className="size-5" />
              </button>
            </div>
          </div>
          <div className="px-4 pb-3 md:hidden"><BuscadorGlobal /></div>
        </header>

        <main className="mx-auto max-w-7xl px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-12">
          {cargando ? <PantallaCarga /> : <Outlet />}
        </main>
      </div>

      <nav className="pb-safe fixed inset-x-0 bottom-0 z-20 border-t border-ink-100 bg-white/95 backdrop-blur-md lg:hidden">
        <div className="grid grid-cols-6 items-end px-1 pt-2">
          {nav.slice(0, 2).map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => cx('flex flex-col items-center gap-1 py-1 text-[10px] font-semibold', isActive ? 'text-brand-600' : 'text-ink-400')}>
              <span className="relative"><Icon className="size-5.5" />{contador(to) > 0 && <span className="absolute -right-2 -top-1 grid min-w-4 place-items-center rounded-full bg-brand-500 px-1 text-[10px] font-bold leading-4 text-white">{contador(to)}</span>}</span>{label}
            </NavLink>
          ))}
          <Link to="/admin/consultas/nueva" className="mx-auto -mt-6 grid size-14 place-items-center rounded-full bg-brand-500 text-white shadow-lg shadow-brand-500/40" aria-label="Nueva consulta">
            <Plus className="size-6" />
          </Link>
          {nav.slice(2).map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => cx('flex flex-col items-center gap-1 py-1 text-[10px] font-semibold', isActive ? 'text-brand-600' : 'text-ink-400')}>
              <span className="relative"><Icon className="size-5.5" />{contador(to) > 0 && <span className="absolute -right-2 -top-1 grid min-w-4 place-items-center rounded-full bg-brand-500 px-1 text-[10px] font-bold leading-4 text-white">{contador(to)}</span>}</span>{label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
