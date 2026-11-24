// Administración: crea el acceso de un paciente al portal desde la web (Supabase Auth, vía función del servidor).
import { Check, Copy, KeyRound, Mail, ShieldCheck, X } from 'lucide-react'
import { useState } from 'react'
import { Button } from '../../components/ui'
import type { Paciente } from '../../data/types'
import { cx } from '../../components/ui'
import { useStore } from '../../lib/store'
import type { ModoCuenta, ResultadoCuenta } from '../../data/datosSupabase'

const ERRORES: Record<string, string> = {
  'ya-tiene-cuenta': 'Este paciente ya tiene una cuenta de acceso.',
  'correo-en-uso': 'Ese correo ya pertenece a otra cuenta de acceso.',
  'limite-correos': 'Se alcanzó el límite de correos por hora. Usa una contraseña temporal o espera un poco.',
  'solo-administracion': 'Solo la administración puede crear accesos.',
  'sin-sesion': 'Tu sesión terminó. Inicia sesión de nuevo.',
  'paciente-no-existe': 'No se encontró al paciente.',
  error: 'No se pudo crear el acceso. Inténtalo de nuevo.',
}

export function AccesoPortalModal({ paciente, onCerrar }: { paciente: Paciente; onCerrar: () => void }) {
  const { crearCuenta, notify } = useStore()
  const [modo, setModo] = useState<ModoCuenta>('invitar')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const [hecho, setHecho] = useState<Extract<ResultadoCuenta, { ok: true }> | null>(null)
  const [copiado, setCopiado] = useState(false)

  const crear = async () => {
    setEnviando(true); setError('')
    const r = await crearCuenta(paciente.id, modo)
    setEnviando(false)
    if (!r.ok) { setError(ERRORES[r.error] ?? ERRORES.error); return }
    setHecho(r)
    if (r.modo === 'invitar') notify(`Invitación enviada a ${r.correo}`)
  }

  const copiar = async () => {
    if (!hecho?.passwordTemporal) return
    try { await navigator.clipboard.writeText(hecho.passwordTemporal); setCopiado(true); setTimeout(() => setCopiado(false), 2000) } catch { notify('Copia la contraseña manualmente.', 'error') }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-ink-950/50 p-0 sm:place-items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Crear acceso al portal" onClick={onCerrar}>
      <div className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 shadow-float sm:rounded-3xl sm:p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-extrabold tracking-tight">Crear acceso al portal</h2>
            <p className="mt-1 text-sm text-ink-500">Para {paciente.nombre} {paciente.apellidoPaterno} · {paciente.email}</p>
          </div>
          <button onClick={onCerrar} className="grid size-9 shrink-0 place-items-center rounded-full text-ink-400 hover:bg-ink-50 hover:text-ink-800" aria-label="Cerrar"><X className="size-5" /></button>
        </div>

        {!hecho ? (
          <>
            <div className="mt-5 grid gap-3" role="radiogroup" aria-label="Forma de entrega">
              {([
                ['invitar', 'Invitación por correo', 'El paciente recibe un enlace y crea su propia contraseña.', Mail],
                ['temporal', 'Contraseña temporal', 'Se crea ya activa y la ves una sola vez para dársela al paciente.', KeyRound],
              ] as const).map(([v, titulo, texto, Icono]) => (
                <button key={v} type="button" role="radio" aria-checked={modo === v} onClick={() => setModo(v)}
                  className={cx('flex gap-3 rounded-2xl border p-4 text-left transition', modo === v ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-500/20' : 'border-ink-100 hover:border-ink-200')}>
                  <Icono className="mt-0.5 size-5 shrink-0 text-brand-600" />
                  <span><span className="block font-bold">{titulo}</span><span className="block text-sm text-ink-500">{texto}</span></span>
                </button>
              ))}
            </div>
            <p className="mt-4 flex gap-2 text-xs text-ink-500"><ShieldCheck className="size-4 shrink-0 text-brand-600" /> El paciente solo verá su propia información; su cuenta no tiene permisos de administración.</p>
            {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700">{error}</p>}
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={onCerrar}>Cancelar</Button>
              <Button onClick={crear} disabled={enviando}>{enviando ? 'Creando…' : 'Crear acceso'}</Button>
            </div>
          </>
        ) : (
          <div className="mt-5">
            <div className="flex items-center gap-2 rounded-2xl bg-brand-50 p-4 text-sm font-semibold text-brand-800"><Check className="size-5" /> Acceso creado para {hecho.correo}</div>
            {hecho.passwordTemporal ? (
              <div className="mt-4">
                <p className="text-sm text-ink-600">Entrégale estos datos al paciente. <strong>La contraseña no se vuelve a mostrar</strong>; si la pierde, usa «Enviar enlace de acceso».</p>
                <div className="mt-3 flex items-center gap-2 rounded-2xl border border-ink-100 bg-ink-50 p-3">
                  <code className="min-w-0 flex-1 break-all font-mono text-base font-bold">{hecho.passwordTemporal}</code>
                  <Button variant="outline" size="sm" onClick={copiar}>{copiado ? <Check className="size-4" /> : <Copy className="size-4" />} {copiado ? 'Copiada' : 'Copiar'}</Button>
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm text-ink-600">Le enviamos un correo con el enlace para crear su contraseña. El portal quedará como «Invitación pendiente» hasta que entre por primera vez.</p>
            )}
            <div className="mt-6 flex justify-end"><Button onClick={onCerrar}>Listo</Button></div>
          </div>
        )}
      </div>
    </div>
  )
}
