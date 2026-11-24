import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { administradores, consultasIniciales, credencialesDemo, especialistas as especialistasIniciales, pacientesIniciales } from '../data/mock'
import { insertarPaciente } from '../data/pacientesSupabase'
import { actualizarPacienteRemoto, aceptarSolicitudRemota, cargarDatos, crearCuentaPaciente, insertarSolicitud, rechazarSolicitudRemota, guardarAtencionRemota, insertarEspecialista, insertarHistorial, type EntradaSolicitud, type ModoCuenta, type ResultadoCuenta, type ResultadoResolucion } from '../data/datosSupabase'
import { supabase } from '../data/supabase'
import type { Consulta, Especialista, HistorialInicial, Paciente, Rol, Sesion, Solicitud } from '../data/types'
import { registrarAtencion, type DatosAtencion, type NuevaConsulta, type ResultadoAtencion } from '../modules/citas/atenciones'
import { registrarEspecialista, type DatosEspecialista, type NuevoEspecialista, type ResultadoEspecialista } from '../modules/especialistas/catalogo'
import type { NuevoPaciente } from '../modules/pacientes/registro'
import { enviarHistorial, type RespuestasHistorial, type ResultadoHistorial } from '../modules/historial-inicial/historial'
import { iniciarSesionEnMemoria, sesionVigente } from '../modules/identidad/autenticacion'
import { registrarIncidente } from '../modules/privacidad/inventario'

interface Toast { id: number; msg: string; tipo: 'ok' | 'error' }

interface Store {
  pacientes: Paciente[]
  consultas: Consulta[]
  especialistas: Especialista[]
  /** Solicitudes del sitio público; solo la administración las recibe. */
  solicitudes: Solicitud[]
  sesion: Sesion | null
  toasts: Toast[]
  /** Con Supabase: true mientras se leen los datos tras iniciar sesión (o al recargar la página). */
  cargando: boolean
  login: (email: string, password: string, rol: Rol) => Promise<boolean>
  logout: () => void
  agregarPaciente: (p: Omit<Paciente, 'id' | 'altaEl' | 'color'>) => Promise<Paciente>
  /** M02: corrige los datos de un paciente (el correo se sincroniza con su cuenta de acceso). */
  actualizarPaciente: (id: string, datos: NuevoPaciente) => Promise<Paciente>
  /** Administración: crea la cuenta de acceso del paciente en Supabase Auth (invitación por correo o contraseña temporal). */
  crearCuenta: (pacienteId: string, modo: ModoCuenta) => Promise<ResultadoCuenta>
  /** Sitio público (sin sesión): envía una solicitud. Devuelve false si no se pudo guardar. */
  enviarSolicitud: (s: EntradaSolicitud) => Promise<boolean>
  /** ✓ Administración: acepta la solicitud y crea al paciente con sus datos. */
  aceptarSolicitud: (id: string) => Promise<ResultadoResolucion>
  /** ✗ Administración: rechaza la solicitud; no se integra como paciente. */
  rechazarSolicitud: (id: string) => Promise<ResultadoResolucion>
  /** Vuelve a leer los datos desde Supabase (reintento tras un error de carga). */
  recargar: () => Promise<void>
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
  // Con Supabase la app arranca vacía y lee todo de la base; sin Supabase usa los datos de demostración.
  const [pacientes, setPacientes] = useState<Paciente[]>(supabase ? [] : pacientesIniciales)
  const [consultas, setConsultas] = useState<Consulta[]>(supabase ? [] : consultasIniciales)
  const [especialistas, setEspecialistas] = useState<Especialista[]>(supabase ? [] : especialistasIniciales)
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([])
  const [sesion, setSesion] = useState<Sesion | null>(leerSesion)
  const [cargando, setCargando] = useState(() => Boolean(supabase && leerSesion()))
  const [toasts, setToasts] = useState<Toast[]>([])

  const notify = useCallback((msg: string, tipo: Toast['tipo'] = 'ok') => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, msg, tipo }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3800)
  }, [])

  const vaciarDatos = useCallback(() => {
    if (!supabase) return // en memoria se conservan (por ejemplo, un historial ya enviado)
    setPacientes([]); setConsultas([]); setEspecialistas([]); setSolicitudes([])
  }, [])

  // M01: la sesión expira; al vencer se cierra y se pide iniciar sesión de nuevo.
  useEffect(() => {
    if (!sesion) return
    const id = setInterval(() => {
      if (!sesionVigente(sesion)) {
        void supabase?.auth.signOut()
        vaciarDatos()
        setSesion(null)
        try { sessionStorage.removeItem(SESSION_KEY) } catch { /* modo privado */ }
        notify('Tu sesión expiró. Inicia sesión de nuevo.', 'error')
      }
    }, 60_000)
    return () => clearInterval(id)
  }, [sesion, notify, vaciarDatos])

  // Con Supabase todo se lee de la base según el rol de la sesión (RLS decide qué llega al navegador).
  const recargar = useCallback(async () => {
    if (!supabase) return
    setCargando(true)
    try {
      const d = await cargarDatos(supabase)
      setPacientes(d.pacientes); setEspecialistas(d.especialistas); setConsultas(d.consultas); setSolicitudes(d.solicitudes)
    } catch {
      notify('No se pudieron cargar los datos guardados. Intenta de nuevo.', 'error')
    } finally {
      setCargando(false)
    }
  }, [notify])

  useEffect(() => {
    if (!supabase || !sesion) return
    // Una sesión guardada en el navegador solo vale si Supabase Auth todavía la reconoce.
    void supabase.auth.getSession().then(({ data }) => {
      if (!data.session) { setSesion(null); setCargando(false); try { sessionStorage.removeItem(SESSION_KEY) } catch { /* modo privado */ } return }
      void recargar()
    })
  }, [sesion?.email, sesion?.rol, recargar]) // eslint-disable-line react-hooks/exhaustive-deps

  const login = useCallback(async (email: string, password: string, rol: Rol) => {
    let s: Sesion | null = null
    if (supabase) {
      // M01: ambos roles entran con Supabase Auth; el rol sale de public.perfil y debe coincidir con la zona elegida.
      const e = email.trim().toLowerCase()
      if (!e || !password) return false
      const { data, error } = await supabase.auth.signInWithPassword({ email: e, password })
      if (error || !data.user) return false
      const { data: perfil } = await supabase.from('perfil').select('nombre, rol').eq('usuario_id', data.user.id).maybeSingle()
      const rolReal: Rol | null = perfil?.rol === 'administrador' ? 'admin' : perfil?.rol === 'paciente' ? 'paciente' : null
      if (!perfil || rolReal !== rol) { await supabase.auth.signOut(); return false }
      let pacienteId: string | undefined
      if (rol === 'paciente') {
        const { data: p } = await supabase.from('paciente').select('id').eq('usuario_id', data.user.id).maybeSingle()
        if (!p) { await supabase.auth.signOut(); return false }
        pacienteId = p.id
        await supabase.rpc('activar_portal') // primer acceso: el portal pasa de «invitado» a «activo»
      }
      s = { rol, nombre: perfil.nombre, email: e, pacienteId, iniciadaEl: new Date().toISOString() }
    } else {
      // Prototipo en memoria: la regla de acceso vive en M01 (campos vacíos y credenciales inválidas se niegan igual).
      const r = iniciarSesionEnMemoria({
        email, password, rol, administradores, pacientes,
        passwordDemo: { admin: credencialesDemo.admin.password, paciente: credencialesDemo.paciente.password },
      })
      if (r.ok) s = r.sesion
    }
    if (!s) return false
    if (supabase) setCargando(true) // evita mostrar un «sin datos» antes de que lleguen
    setSesion(s)
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(s)) } catch { /* modo privado */ }
    return true
  }, [pacientes])

  const logout = useCallback(() => {
    void supabase?.auth.signOut()
    vaciarDatos()
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

  const crearCuenta = useCallback(async (pacienteId: string, modo: ModoCuenta): Promise<ResultadoCuenta> => {
    if (!supabase || sesion?.rol !== 'admin') return { ok: false, error: 'solo-administracion' }
    const r = await crearCuentaPaciente(supabase, pacienteId, modo)
    if (r.ok) setPacientes((ps) => ps.map((p) => (p.id === pacienteId ? { ...p, portal: modo === 'temporal' ? 'activo' : 'invitado' } : p)))
    return r
  }, [sesion?.rol])

  const actualizarPaciente = useCallback(async (id: string, datos: NuevoPaciente) => {
    const actual = pacientes.find((p) => p.id === id)
    if (!actual) throw new Error('no-existe')
    const guardado: Paciente = supabase ? await actualizarPacienteRemoto(supabase, id, datos, actual.email) : { ...actual, ...datos }
    // Se conservan el historial, el color y el estado del portal del expediente existente.
    const nuevo: Paciente = { ...guardado, historialInicial: actual.historialInicial, color: actual.color, activo: actual.activo, portal: actual.portal, altaEl: actual.altaEl }
    setPacientes((ps) => ps.map((p) => (p.id === id ? nuevo : p)))
    return nuevo
  }, [pacientes])

  const enviarSolicitud = useCallback(async (e: EntradaSolicitud) => {
    try {
      if (supabase) await insertarSolicitud(supabase, e)
      else setSolicitudes((ss) => [{ ...e, id: `s-${crypto.randomUUID()}`, creadaEl: new Date().toISOString(), estado: 'nueva' }, ...ss])
      return true
    } catch {
      return false
    }
  }, [])

  const aceptarSolicitud = useCallback(async (id: string): Promise<ResultadoResolucion> => {
    if (sesion?.rol !== 'admin') return { ok: false, error: 'error' }
    const sol = solicitudes.find((x) => x.id === id)
    if (!sol || sol.estado !== 'nueva') return { ok: false, error: 'ya-resuelta' }
    let paciente: Paciente
    if (supabase) {
      const r = await aceptarSolicitudRemota(supabase, id)
      if (!r.ok) return r
      if (!r.paciente) { // informes: solo se marca atendida
        setSolicitudes((ss) => ss.map((x) => (x.id === id ? { ...x, estado: 'aceptada', resueltaEl: new Date().toISOString() } : x)))
        return { ok: true }
      }
      paciente = r.paciente
    } else {
      if (sol.tipo === 'informes') {
        setSolicitudes((ss) => ss.map((x) => (x.id === id ? { ...x, estado: 'aceptada', resueltaEl: new Date().toISOString() } : x)))
        return { ok: true }
      }
      if (sol.tipo !== 'cita' || !sol.fechaNacimiento || !sol.sexo || !sol.contactoEmergencia) return { ok: false, error: 'sin-datos' }
      if (pacientes.some((p) => p.email.toLowerCase() === sol.email.toLowerCase())) return { ok: false, error: 'correo-duplicado' }
      paciente = {
        id: `p-${crypto.randomUUID()}`, nombre: sol.nombre, apellidoPaterno: sol.apellidoPaterno, apellidoMaterno: sol.apellidoMaterno,
        fechaNacimiento: sol.fechaNacimiento, sexo: sol.sexo, nacionalidad: sol.nacionalidad ?? '', pais: sol.pais ?? 'XX', idioma: sol.idioma ?? '',
        telefono: sol.telefono, email: sol.email.toLowerCase(), padecimientoPrincipal: sol.mensaje ?? '', contactoEmergencia: sol.contactoEmergencia,
        altaEl: new Date().toISOString(), activo: true, portal: 'sin acceso', color: COLORES[Math.floor(Math.random() * COLORES.length)],
      }
    }
    setPacientes((ps) => [paciente, ...ps])
    setSolicitudes((ss) => ss.map((x) => (x.id === id ? { ...x, estado: 'aceptada', pacienteId: paciente.id, resueltaEl: new Date().toISOString() } : x)))
    return { ok: true, paciente }
  }, [sesion?.rol, solicitudes, pacientes])

  const rechazarSolicitud = useCallback(async (id: string): Promise<ResultadoResolucion> => {
    if (sesion?.rol !== 'admin') return { ok: false, error: 'error' }
    if (supabase) {
      const r = await rechazarSolicitudRemota(supabase, id)
      if (!r.ok) return r
    }
    setSolicitudes((ss) => ss.map((x) => (x.id === id && x.estado === 'nueva' ? { ...x, estado: 'rechazada', resueltaEl: new Date().toISOString() } : x)))
    return { ok: true }
  }, [sesion?.rol])

  const reportarFallo = useCallback((contexto: string) => registrarIncidente('guardado sin confirmar', contexto).id, [])

  const guardarEspecialista = useCallback((d: DatosEspecialista) => registrarEspecialista(d, {
    sesion,
    guardar: async (e: NuevoEspecialista) => {
      const nuevo: Especialista = supabase ? await insertarEspecialista(supabase, e) : { ...e, id: `e-${crypto.randomUUID()}` }
      setEspecialistas((es) => [...es, nuevo])
      return nuevo
    },
  }), [sesion])

  const guardarAtencion = useCallback((d: DatosAtencion, existente?: Consulta) => registrarAtencion(d, {
    sesion, pacientes, especialistas, existente,
    guardar: async (c: NuevaConsulta, id?: string) => {
      if (supabase) {
        const guardada = await guardarAtencionRemota(supabase, c, id ? existente : undefined)
        setConsultas((cs) => (id ? cs.map((x) => (x.id === id ? guardada : x)) : [...cs, guardada]))
        return guardada
      }
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
    guardar: async (id: string, h: HistorialInicial) => {
      if (supabase) await insertarHistorial(supabase, id, h)
      setPacientes((ps) => ps.map((p) => (p.id === id && !p.historialInicial ? { ...p, historialInicial: h } : p)))
    },
  }), [sesion, pacientes])

  const value = useMemo<Store>(() => ({
    pacientes, consultas, especialistas, solicitudes, sesion, toasts, cargando,
    login, logout, agregarPaciente, actualizarPaciente, crearCuenta, enviarSolicitud, aceptarSolicitud, rechazarSolicitud, recargar, guardarEspecialista, guardarAtencion, enviarHistorialInicial, reportarFallo, notify,
  }), [pacientes, consultas, especialistas, solicitudes, sesion, toasts, cargando, login, logout, agregarPaciente, actualizarPaciente, crearCuenta, enviarSolicitud, aceptarSolicitud, rechazarSolicitud, recargar, guardarEspecialista, guardarAtencion, enviarHistorialInicial, reportarFallo, notify])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStore() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useStore debe usarse dentro de StoreProvider')
  return ctx
}

