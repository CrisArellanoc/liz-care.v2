import { asset } from '../../lib/asset'
import { AlertCircle, ArrowLeft, Eye, EyeOff, HeartPulse, Lock, Mail, ShieldCheck, UserRound } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Logo } from '../../components/Logo'
import { Button, Field, Input, cx } from '../../components/ui'
import { credencialesDemo } from '../../data/mock'
import type { Rol } from '../../data/types'
import { supabase } from '../../data/supabase'
import { useStore } from '../../lib/store'

export default function Login() {
  const [params, setParams] = useSearchParams()
  const rol: Rol = params.get('rol') === 'admin' ? 'admin' : 'paciente'
  const { login } = useStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [ver, setVer] = useState(false)
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)
  const aviso = (location.state as { aviso?: string } | null)?.aviso

  const cambiarRol = (r: Rol) => { setParams({ rol: r }, { replace: true }); setError('') }

  const entrar = (e: string, p: string) => {
    setCargando(true)
    setError('')
    setTimeout(async () => {
      const ok = await login(e, p, rol)
      setCargando(false)
      if (!ok) { setError('Correo o contraseña incorrectos. Revisa tus datos e inténtalo de nuevo.'); return }
      const from = (location.state as { from?: string } | null)?.from
      navigate(from && from.startsWith(rol === 'admin' ? '/admin' : '/portal') ? from : rol === 'admin' ? '/admin' : '/portal', { replace: true })
    }, 450)
  }

  const submit = (ev: FormEvent) => { ev.preventDefault(); entrar(email, password) }

  const demo = (cred: { email: string; password: string }) => { setEmail(cred.email); setPassword(cred.password); entrar(cred.email, cred.password) }

  return (
    <div className="grid min-h-dvh bg-white lg:grid-cols-2">
      <div className="relative hidden overflow-hidden lg:block">
        <img src={asset('images/login.jpg')} alt="Médica conversando con una paciente" className="absolute inset-0 size-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink-950/90 via-ink-900/40 to-brand-900/20" />
        <div className="absolute left-10 top-10"><Logo light /></div>
        <div className="absolute inset-x-10 bottom-12 text-white">
          <HeartPulse className="size-10 text-brand-300" />
          <p className="mt-4 max-w-md text-3xl font-extrabold leading-tight">Toda tu información médica, ordenada y segura en un solo lugar.</p>
          <p className="mt-3 max-w-md text-white/70">Citas, consultas, tratamientos y recetas, disponibles desde tu celular o computadora.</p>
          <div className="mt-8 flex items-center gap-3 rounded-2xl bg-white/10 p-4 backdrop-blur-md">
            <ShieldCheck className="size-6 shrink-0 text-brand-300" />
            <p className="text-sm text-white/85">Cada usuario solo ve la información que le corresponde. Protegido conforme a la LFPDPPP.</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col px-5 py-6 sm:px-10">
        <div className="flex items-center justify-between">
          <div className="lg:hidden"><Logo /></div>
          <Link to="/" className="ml-auto inline-flex items-center gap-1.5 text-sm font-semibold text-ink-500 hover:text-ink-900"><ArrowLeft className="size-4" /> Volver al inicio</Link>
        </div>

        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
          <h1 className="text-3xl font-extrabold tracking-tight">Bienvenido de nuevo</h1>
          <p className="mt-2 text-ink-500">Inicia sesión para continuar · <span className="italic">Sign in to continue</span></p>

          <div className="mt-8 grid grid-cols-2 rounded-2xl bg-ink-100 p-1" role="tablist">
            {([['paciente', 'Soy paciente', UserRound], ['admin', 'Administradora', ShieldCheck]] as const).map(([r, l, Icon]) => (
              <button key={r} role="tab" aria-selected={rol === r} onClick={() => cambiarRol(r)}
                className={cx('flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition', rol === r ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-800')}>
                <Icon className="size-4.5" /> {l}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="mt-6 space-y-4">
            {aviso && !error && <p role="status" className="rounded-2xl border border-brand-200 bg-brand-50 p-3.5 text-sm font-medium text-brand-800">{aviso}</p>}
            {error && (
              <div className="flex animate-fade-up gap-3 rounded-2xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-700" role="alert">
                <AlertCircle className="size-5 shrink-0" /> {error}
              </div>
            )}
            <Field label="Correo electrónico">
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 size-4.5 -translate-y-1/2 text-ink-400" />
                <Input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={rol === 'admin' ? 'liz@lizcare.mx' : 'tu@correo.com'} className="pl-10" invalid={!!error} />
              </div>
            </Field>
            <Field label="Contraseña">
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 size-4.5 -translate-y-1/2 text-ink-400" />
                <Input type={ver ? 'text' : 'password'} required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="px-10" invalid={!!error} />
                <button type="button" onClick={() => setVer(!ver)} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-700" aria-label={ver ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
                  {ver ? <EyeOff className="size-4.5" /> : <Eye className="size-4.5" />}
                </button>
              </div>
            </Field>
            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-ink-600"><input type="checkbox" className="size-4 accent-brand-500" /> Recordarme</label>
              <Link to="/recuperar" className="font-semibold text-brand-600 hover:text-brand-700">¿Olvidaste tu contraseña?</Link>
            </div>
            <Button type="submit" size="lg" className="w-full" disabled={cargando}>
              {cargando ? <span className="size-5 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : 'Iniciar sesión'}
            </Button>
          </form>

          {rol === 'paciente' && (
            <p className="mt-5 text-center text-sm text-ink-500">¿Aún no tienes cuenta? Liz te enviará tu acceso al registrarte.</p>
          )}

          {!supabase && <div className="mt-8 rounded-2xl border border-dashed border-ink-200 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-ink-400">Cuentas de demostración</p>
            <div className="mt-3 grid gap-2">
              {rol === 'admin' ? (
                ([['Liz Hernández', credencialesDemo.admin], ['Daniela Ríos', credencialesDemo.admin2]] as const).map(([nombre, cred]) => (
                  <button key={cred.email} onClick={() => demo(cred)} className="flex items-center justify-between rounded-xl bg-ink-50 px-3 py-2.5 text-left text-sm hover:bg-brand-50">
                    <span><span className="font-semibold">{nombre}</span><span className="block text-xs text-ink-500">{cred.email} · admin123</span></span>
                    <span className="text-xs font-bold text-brand-600">Entrar →</span>
                  </button>
                ))
              ) : (
                <>
                  <button onClick={() => demo(credencialesDemo.paciente)} className="flex items-center justify-between rounded-xl bg-ink-50 px-3 py-2.5 text-left text-sm hover:bg-brand-50">
                    <span><span className="font-semibold">Emily Carter</span><span className="block text-xs text-ink-500">Paciente con historial y tratamiento</span></span>
                    <span className="text-xs font-bold text-brand-600">Entrar →</span>
                  </button>
                  <button onClick={() => demo(credencialesDemo.pacienteNuevo)} className="flex items-center justify-between rounded-xl bg-ink-50 px-3 py-2.5 text-left text-sm hover:bg-brand-50">
                    <span><span className="font-semibold">Hans Müller</span><span className="block text-xs text-ink-500">Paciente nuevo · historial pendiente</span></span>
                    <span className="text-xs font-bold text-brand-600">Entrar →</span>
                  </button>
                </>
              )}
            </div>
          </div>}
        </div>
      </div>
    </div>
  )
}
