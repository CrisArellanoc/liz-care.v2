import { CalendarDays, FileHeart, House, LogOut, Pill } from 'lucide-react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { LangToggle } from '../components/LangToggle'
import { Logo } from '../components/Logo'
import { Avatar, ButtonLink, Card, cx } from '../components/ui'
import { useI18n } from '../lib/i18n'
import { useStore } from '../lib/store'

export default function PortalLayout() {
  const { sesion, logout, pacientes } = useStore()
  const { t, lang } = useI18n()
  const navigate = useNavigate()
  const p = pacientes.find((x) => x.id === sesion?.pacienteId)
  const salir = () => { logout(); navigate('/login?rol=paciente') }

  const items = [
    { to: '/portal', label: t('nav.inicio'), icon: House, end: true },
    { to: '/portal/citas', label: t('nav.citas'), icon: CalendarDays },
    { to: '/portal/tratamiento', label: t('nav.tratamiento'), icon: Pill },
    { to: '/portal/expediente', label: t('nav.expediente'), icon: FileHeart },
  ]

  if (!p || !p.activo || p.portal !== 'activo') {
    return <main className="mx-auto max-w-xl p-6"><Card className="p-6"><p role="alert" className="mb-4">{lang === 'en' ? 'Your record is unavailable or portal access is inactive. Sign in again.' : 'Tu expediente no está disponible o el acceso al portal está inactivo. Inicia sesión de nuevo.'}</p><ButtonLink to="/login?rol=paciente" onClick={logout}>{t('nav.salir')}</ButtonLink></Card></main>
  }

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-ink-100 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:gap-6 sm:px-6">
          <Logo to="/portal" sub={t('nav.portal')} />
          <nav className="hidden flex-1 items-center gap-1 md:flex">
            {items.map(({ to, label, icon: Icon, end }) => (
              <NavLink key={to} to={to} end={end} className={({ isActive }) => cx(
                'flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition',
                isActive ? 'bg-brand-50 text-brand-700' : 'text-ink-600 hover:bg-ink-50 hover:text-ink-900',
              )}>
                <Icon className="size-4.5" />{label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
            <LangToggle />
            {p && <div className="hidden sm:block"><Avatar name={sesion!.nombre} color={p.color} size={36} /></div>}
            <button onClick={salir} className="grid size-10 place-items-center rounded-full text-ink-500 hover:bg-ink-100 hover:text-ink-900" title={t('nav.salir')} aria-label={t('nav.salir')}>
              <LogOut className="size-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-28 pt-6 sm:px-6 md:pb-14">
        <Outlet />
      </main>

      <nav className="pb-safe fixed inset-x-0 bottom-0 z-20 border-t border-ink-100 bg-white/95 backdrop-blur-md md:hidden">
        <div className="grid grid-cols-4 px-2 pt-2">
          {items.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => cx('flex flex-col items-center gap-1 py-1 text-[11px] font-semibold', isActive ? 'text-brand-600' : 'text-ink-400')}>
              {({ isActive }) => (
                <>
                  <span className={cx('grid h-7 w-12 place-items-center rounded-full transition', isActive && 'bg-brand-50')}><Icon className="size-5" /></span>
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}

