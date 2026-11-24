// Activación de cuenta (enlace de invitación) y recuperación de acceso: el paciente crea su contraseña.
// Supabase lee el enlace (#access_token…) y abre una sesión temporal; aquí solo se pide la contraseña nueva.
import { AlertCircle, Check, Eye, EyeOff, Lock } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Logo } from '../../components/Logo'
import { Button, Field, Input } from '../../components/ui'
import { supabase } from '../../data/supabase'

/** Mínimo 10 caracteres con letra y número. */
export function validarContrasenaNueva(p: string, confirmacion: string): string {
  if (p.length < 10) return 'Usa al menos 10 caracteres.'
  if (!/[A-Za-z]/.test(p) || !/\d/.test(p)) return 'Incluye al menos una letra y un número.'
  if (p !== confirmacion) return 'Las contraseñas no coinciden.'
  return ''
}

export default function NuevaContrasena() {
  const navigate = useNavigate()
  const [estado, setEstado] = useState<'esperando' | 'listo' | 'invalido'>('esperando')
  const [password, setPassword] = useState('')
  const [confirma, setConfirma] = useState('')
  const [ver, setVer] = useState(false)
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!supabase) { setEstado('invalido'); return }
    let vivo = true
    const { data: sub } = supabase.auth.onAuthStateChange((evento, sesion) => {
      if (vivo && sesion && (evento === 'PASSWORD_RECOVERY' || evento === 'SIGNED_IN' || evento === 'INITIAL_SESSION')) setEstado('listo')
    })
    // Si en unos segundos no hay sesión, el enlace no sirve (vencido, ya usado o abierto sin el enlace).
    const t = setTimeout(() => { void supabase!.auth.getSession().then(({ data }) => { if (vivo) setEstado(data.session ? 'listo' : 'invalido') }) }, 2500)
    return () => { vivo = false; sub.subscription.unsubscribe(); clearTimeout(t) }
  }, [])

  const guardar = async (ev: FormEvent) => {
    ev.preventDefault()
    if (!supabase) return
    const msg = validarContrasenaNueva(password, confirma)
    if (msg) { setError(msg); return }
    setGuardando(true); setError('')
    const { error: e } = await supabase.auth.updateUser({ password })
    if (e) { setGuardando(false); setError(/same|different/i.test(e.message) ? 'Usa una contraseña distinta a la anterior.' : 'No se pudo guardar la contraseña. Pide un enlace nuevo.'); return }
    await supabase.rpc('activar_portal') // si es un paciente invitado, su portal pasa a «activo»
    const { data: u } = await supabase.auth.getUser()
    const { data: perfil } = u.user ? await supabase.from('perfil').select('rol').eq('usuario_id', u.user.id).maybeSingle() : { data: null }
    await supabase.auth.signOut() // se entra de nuevo con la contraseña nueva, por el flujo normal
    navigate(`/login?rol=${perfil?.rol === 'administrador' ? 'admin' : 'paciente'}`, { replace: true, state: { aviso: 'Contraseña guardada. Ya puedes iniciar sesión.' } })
  }

  return (
    <div className="flex min-h-dvh flex-col bg-white px-5 py-6 sm:px-10">
      <div><Logo /></div>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
        {estado === 'esperando' && <div role="status" className="flex items-center gap-3 text-ink-500"><span className="size-6 animate-spin rounded-full border-4 border-brand-100 border-t-brand-500" /> Verificando tu enlace…</div>}
        {estado === 'invalido' && (
          <div role="alert">
            <AlertCircle className="size-10 text-red-500" />
            <h1 className="mt-4 text-3xl font-extrabold tracking-tight">Este enlace ya no es válido</h1>
            <p className="mt-2 text-ink-500">Los enlaces vencen y solo se pueden usar una vez. Pide uno nuevo para crear tu contraseña.</p>
            <Link to="/recuperar" className="mt-6 inline-block font-semibold text-brand-600 hover:text-brand-700">Pedir un enlace nuevo</Link>
          </div>
        )}
        {estado === 'listo' && (
          <>
            <h1 className="text-3xl font-extrabold tracking-tight">Crea tu contraseña</h1>
            <p className="mt-2 text-ink-500">Con ella entrarás a tu portal de Liz Care. Mínimo 10 caracteres, con letras y números.</p>
            <form onSubmit={guardar} className="mt-6 space-y-4">
              {error && <p role="alert" className="flex gap-2 rounded-2xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-700"><AlertCircle className="size-5 shrink-0" /> {error}</p>}
              <Field label="Contraseña nueva">
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 size-4.5 -translate-y-1/2 text-ink-400" />
                  <Input type={ver ? 'text' : 'password'} required autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className="px-10" />
                  <button type="button" onClick={() => setVer(!ver)} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-700" aria-label={ver ? 'Ocultar contraseña' : 'Mostrar contraseña'}>{ver ? <EyeOff className="size-4.5" /> : <Eye className="size-4.5" />}</button>
                </div>
              </Field>
              <Field label="Repite la contraseña">
                <Input type={ver ? 'text' : 'password'} required autoComplete="new-password" value={confirma} onChange={(e) => setConfirma(e.target.value)} />
              </Field>
              <Button type="submit" size="lg" className="w-full" disabled={guardando}>{guardando ? 'Guardando…' : <><Check className="size-5" /> Guardar contraseña</>}</Button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
