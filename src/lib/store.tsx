import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { administradores, consultasIniciales, credencialesDemo, especialistas as especialistasIniciales, pacientesIniciales } from '../data/mock'
import { insertarPaciente, listarPacientes } from '../data/pacientesSupabase'
import { supabase } from '../data/supabase'
import type { Consulta, Especialista, HistorialInicial, Paciente, Rol, Sesion } from '../data/types'
import { registrarAtencion, type DatosAtencion, type NuevaConsulta, type ResultadoAtencion } from '../modules/citas/atenciones'
import { registrarEspecialista, type DatosEspecialista, type NuevoEspecialista, type ResultadoEspecialista } from '../modules/especialistas/catalogo'
import { enviarHistorial, type RespuestasHistorial, type ResultadoHistorial } from '../modules/historial-inicial/historial'
import { iniciarSesionEnMemoria, sesionVigente } from '../modules/identidad/autenticacion'
import { registrarIncidente } from '../modules/privacidad/inventario'

interface Toast { id: number; msg: string; tipo: 'ok' | 'error' }

interface Store {
  pacientes: Paciente[]
  consultas: Consulta[]
  especialistas: Especialista[]
  sesion: Sesion | null
  toasts: Toast[]
  login: (email: string, password: string, rol: Rol) => Promise<boolean>
  logout: () => void
  agregarPaciente: (p: Omit<Paciente, 'id' | 'altaEl' | 'color'>) => Promise<Paciente>
  /** M11: valida y guarda un especialista en el catálogo (solo administración). */
  guardarEspecialista: (d: DatosEspecialista) => Promise<ResultadoEspecialista>
  /** M04: registra una cita o consulta; con `existente` actualiza esa atención (p. ej. al registrar su resultado). */
  guardarAtencion: (d: DatosAtencion, existente?: Consulta) => Promise<ResultadoAtencion>
  /** M03: el paciente de la sesión envía su historial inicial, una sola vez. */
  enviarHistorialInicial: (r: RespuestasHistorial) => Promise<ResultadoHistorial>
  /** M10: registra un fallo sin datos clínicos y devuelve su identificador técnico. */
  reportarFallo: (contexto: string) => string
  notify: (msg: string, tipo?: Toast['tipo']) => void
}

const Ctx = createContext<Store | null>(null)
const SESSION_KEY = 'lizcare.sesion'
const COLORES = ['#00a58c', '#3b6fd8', '#d1497b', '#e0812b', '#7b5cd6', '#0f8fb3', '#2f9e5b']

function leerSesion(): Sesion | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    const s = raw ? (JSON.parse(raw) as Sesion) : null
    return sesionVigente(s) ? s : null
  } catch {
    return null
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [pacientes, setPacientes] = useState(pacientesIniciales)
  const [consultas, setConsultas] = useState(consultasIniciales)
  const [especialistas, setEspecialistas] = useState(especialistasIniciales)
  const [sesion, setSesion] = useState<Sesion | null>(leerSesion)
  const [toasts, setToasts] = useState<Toast[]>([])

  const notify = useCallback((msg: string, tipo: Toast['tipo'] = 'ok') => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, msg, tipo }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3800)
  }, [])

  // M01: la sesión expira; al vencer se cierra y se pide iniciar sesión de nuevo.
  useEffect(() => {
    if (!sesion) return
    const id = setInterval(() => {
      if (!sesionVigente(sesion)) {
        void supabase?.auth.signOut()
        if (supabase) setPacientes(pacientesIniciales)
        setSesion(null)
        try { sessionStorage.removeItem(SESSION_KEY) } catch { /* modo privado */ }
        notify('Tu sesión expiró. Inicia sesión de nuevo.', 'error')
      }
    }, 60_000)
    return () => clearInterval(id)
  }, [sesion, notify])

  // Con Supabase, la administración se lee de la base; los pacientes de demostración se conservan
  // porque las consultas, la agenda y el portal todavía dependen de ellos.
  useEffect(() => {
    if (!supabase || sesion?.rol !== 'admin') return
    let vigente = true
    listarPacientes(supabase)
      .then((remotos) => { if (vigente) setPacientes([...remotos, ...pacientesIniciales]) })
      .catch(() => notify('No se pudieron cargar los pacientes guardados.', 'error'))
    return () => { vigente = false }
  }, [sesion?.rol, notify])

  const login = useCallback(async (email: string, password: string, rol: Rol) => {
    let s: Sesion | null = null
    if (rol === 'admin' && supabase) {
      // M01: la administradora entra con Supabase Auth y su rol se toma de public.perfil.
      const e = email.trim().toLowerCase()
      if (!e || !password) return false
      const { data, error } = await supabase.auth.signInWithPassword({ email: e, password })
      if (error || !data.user) return false
      const { data: perfil } = await supabase.from('perfil').select('nombre, rol').eq('usuario_id', data.user.id).maybeSingle()
      if (perfil?.rol !== 'administrador') { await supabase.auth.signOut(); return false }
      s = { rol, nombre: perfil.nombre, email: e, iniciadaEl: new Date().toISOString() }
    } else {
      // Prototipo en memoria: la regla de acceso vive en M01 (campos vacíos y credenciales inválidas se niegan igual).
      const r = iniciarSesionEnMemoria({
        email, password, rol, administradores, pacientes,
        passwordDemo: { admin: credencialesDemo.admin.password, paciente: credencialesDemo.paciente.password },
      })
      if (r.ok) s = r.sesion
    }
    if (!s) return false
    setSesion(s)
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(s)) } catch { /* modo privado */ }
    return true
  }, [pacientes])

  const logout = useCallback(() => {
    void supabase?.auth.signOut()
    // Con Supabase los pacientes se vuelven a leer en el próximo acceso; en memoria se conservan (por ejemplo, un historial ya enviado).
    if (supabase) setPacientes(pacientesIniciales)
    setSesion(null)
    try { sessionStorage.removeItem(SESSION_KEY) } catch { /* modo privado */ }
  }, [])

  const agregarPaciente = useCallback(async (p: Omit<Paciente, 'id' | 'altaEl' | 'color'>) => {
    if (supabase && sesion?.rol === 'admin') {
      const guardado = await insertarPaciente(supabase, p)
      setPacientes((ps) => [guardado, ...ps])
      return guardado
    }
    const nuevo: Paciente = {
      ...p,
      id: `p-${crypto.randomUUID()}`,
      altaEl: new Date().toISOString(),
      color: COLORES[Math.floor(Math.random() * COLORES.length)],
    }
    setPacientes((ps) => [nuevo, ...ps])
    return nuevo
  }, [sesion?.rol])

  const reportarFallo = useCallback((contexto: string) => registrarIncidente('guardado sin confirmar', contexto).id, [])

  const guardarEspecialista = useCallback((d: DatosEspecialista) => registrarEspecialista(d, {
    sesion,
    guardar: (e: NuevoEspecialista) => {
      const nuevo: Especialista = { ...e, id: `e-${crypto.randomUUID()}` }
      setEspecialistas((es) => [...es, nuevo])
      return nuevo
    },
  }), [sesion])

  const guardarAtencion = useCallback((d: DatosAtencion, existente?: Consulta) => registrarAtencion(d, {
    sesion, pacientes, especialistas, existente,
    guardar: (c: NuevaConsulta, id?: string) => {
      if (id) {
        const actualizada: Consulta = { ...c, id }
        setConsultas((cs) => cs.map((x) => (x.id === id ? actualizada : x)))
        return actualizada
      }
      const nueva: Consulta = { ...c, id: `c-${crypto.randomUUID()}` }
      setConsultas((cs) => [...cs, nueva])
      return nueva
    },
  }), [sesion, pacientes, especialistas])

  const enviarHistorialInicial = useCallback((r: RespuestasHistorial) => enviarHistorial(r, {
    sesion,
    paciente: pacientes.find((p) => p.id === sesion?.pacienteId),
    guardar: (id: string, h: HistorialInicial) => {
      setPacientes((ps) => ps.map((p) => (p.id === id && !p.historialInicial ? { ...p, historialInicial: h } : p)))
    },
  }), [sesion, pacientes])

  const value = useMemo<Store>(() => ({
    pacientes, consultas, especialistas, sesion, toasts,
    login, logout, agregarPaciente, guardarEspecialista, guardarAtencion, enviarHistorialInicial, reportarFallo, notify,
  }), [pacientes, consultas, especialistas, sesion, toasts, login, logout, agregarPaciente, guardarEspecialista, guardarAtencion, enviarHistorialInicial, reportarFallo, notify])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStore() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useStore debe usarse dentro de StoreProvider')
  return ctx
}

