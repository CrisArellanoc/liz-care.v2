// Recuperación de acceso: envía por correo un enlace para crear una contraseña nueva (Supabase Auth).
// La respuesta es la misma exista o no la cuenta, para no revelar qué correos están registrados.
import { ArrowLeft, Mail, MailCheck } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Logo } from '../../components/Logo'
import { Button, Field, Input } from '../../components/ui'
import { supabase } from '../../data/supabase'

export default function RecuperarAcceso() {
  const [email, setEmail] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [error, setError] = useState('')

  const enviar = async (ev: FormEvent) => {
    ev.preventDefault()
    setError('')
    if (!supabase) { setEnviado(true); return } // modo demostración: no hay cuentas reales
    setEnviando(true)
    const { error: e } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: `${window.location.origin}/nueva-contrasena` })
    setEnviando(false)
    // Solo se informa de fallos del servicio (límite de envíos, red); una cuenta inexistente no devuelve error.
    if (e) setError('No se pudo enviar el correo ahora. Espera unos minutos e inténtalo de nuevo.')
    else setEnviado(true)
  }

  return (
    <div className="flex min-h-dvh flex-col bg-white px-5 py-6 sm:px-10">
      <div className="flex items-center justify-between"><Logo /><Link to="/login" className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-500 hover:text-ink-900"><ArrowLeft className="size-4" /> Volver a iniciar sesión</Link></div>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
        {enviado ? (
          <div role="status">
            <MailCheck className="size-10 text-brand-500" />
            <h1 className="mt-4 text-3xl font-extrabold tracking-tight">Revisa tu correo</h1>
            <p className="mt-2 text-ink-500">Si <strong>{email}</strong> tiene una cuenta en Liz Care, te enviamos un enlace para crear una contraseña nueva. Puede tardar unos minutos; revisa también la carpeta de spam.</p>
            <Link to="/login" className="mt-6 inline-block font-semibold text-brand-600 hover:text-brand-700">Volver a iniciar sesión</Link>
          </div>
        ) : (
          <>
            <h1 className="text-3xl font-extrabold tracking-tight">Recupera tu acceso</h1>
            <p className="mt-2 text-ink-500">Escribe tu correo y te enviaremos un enlace para crear una contraseña nueva.</p>
            <form onSubmit={enviar} className="mt-6 space-y-4">
              {error && <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-700">{error}</p>}
              <Field label="Correo electrónico">
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 size-4.5 -translate-y-1/2 text-ink-400" />
                  <Input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@correo.com" className="pl-10" />
                </div>
              </Field>
              <Button type="submit" size="lg" className="w-full" disabled={enviando}>{enviando ? 'Enviando…' : 'Enviar enlace'}</Button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
