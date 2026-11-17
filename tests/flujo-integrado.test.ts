// Recorrido completo del plan (I4): alta → especialista → cita → consulta con tratamiento y receta → historial inicial → portal,
// con dos pacientes que no deben mezclarse. Usa los módulos tal como los usa la aplicación, con persistencia en memoria.
import { describe, expect, it } from 'vitest'
import type { Consulta, Especialista, Paciente } from '../src/data/types'
import { proximasDelPaciente, realizadasDelPaciente, registrarAtencion, type NuevaConsulta } from '../src/modules/citas/atenciones'
import { buscarEspecialistas, registrarEspecialista, type NuevoEspecialista } from '../src/modules/especialistas/catalogo'
import { enviarHistorial } from '../src/modules/historial-inicial/historial'
import { iniciarSesionEnMemoria } from '../src/modules/identidad/autenticacion'
import { obtenerExpediente } from '../src/modules/expedientes/expediente'
import { registrarPaciente, type NuevoPaciente } from '../src/modules/pacientes/registro'
import type { DatosAlta } from '../src/modules/pacientes/validacion'
import { aArchivoReceta, entregarReceta } from '../src/modules/recetas/archivo'
import { ultimoTratamiento } from '../src/modules/tratamientos/tratamiento'
import { AHORA, admin } from './datos'

const alta = (nombre: string, email: string): DatosAlta => ({
  nombre, apellidoPaterno: 'Prueba', apellidoMaterno: '', fechaNacimiento: '1985-05-05', sexo: 'X', nacionalidad: 'Canadiense', idioma: 'Inglés',
  telefono: '4770000000', email, padecimientoPrincipal: 'Dato de prueba', emNombre: 'Contacto', emParentesco: 'Hermano(a)', emTelefono: '4770000001',
})

describe('Recorrido integrado con dos pacientes', () => {
  it('cada paciente solo ve lo suyo de punta a punta', async () => {
    const pacientes: Paciente[] = []
    const especialistas: Especialista[] = []
    const consultas: Consulta[] = []

    // M02: alta de dos pacientes, pendientes de activación del portal.
    const guardarPaciente = (p: NuevoPaciente) => { const n: Paciente = { ...p, id: `p${pacientes.length + 1}`, altaEl: AHORA.toISOString(), color: '#00a58c' }; pacientes.push(n); return n }
    for (const [n, e] of [['Ana', 'ana@example.com'], ['Beto', 'beto@example.com']]) {
      const r = await registrarPaciente(alta(n, e), { sesion: admin, pacientes, guardar: guardarPaciente, invitarAlPortal: true, hoy: AHORA })
      expect(r.ok).toBe(true)
    }
    expect(pacientes).toHaveLength(2)
    expect(pacientes.every((p) => p.portal === 'invitado')).toBe(true)
    expect(iniciarSesionEnMemoria({ email: 'ana@example.com', password: 'demo123', rol: 'paciente', administradores: [], pacientes, passwordDemo: { admin: 'x', paciente: 'demo123' }, ahora: AHORA }).ok).toBe(false)
    // Fixture explícita: el resto del recorrido parte de cuentas ya activadas.
    // La activación no está implementada por el prototipo y no se acredita aquí.
    pacientes.forEach((p) => { p.portal = 'activo' })

    // M11: catálogo y búsqueda.
    const guardarEsp = (e: NuevoEspecialista) => { const n = { ...e, id: `e${especialistas.length + 1}` }; especialistas.push(n); return n }
    await registrarEspecialista({ nombre: 'Dra. Demo', especialidad: 'Cardiología', institucion: 'Clínica demo', sector: 'Privado', direccion: '', telefono: '477 000 0000', idiomas: 'Español, Inglés' }, { sesion: admin, guardar: guardarEsp })
    expect(buscarEspecialistas(especialistas, { especialidad: 'cardio', idioma: 'inglés' })).toHaveLength(1)

    // M04 / M05 / M06: cita para Ana, consulta realizada con tratamiento y receta para Ana, consulta sin medicamentos para Beto.
    const guardarConsulta = (c: NuevaConsulta, id?: string) => { const n: Consulta = { ...c, id: id ?? `c${consultas.length + 1}` }; if (id) consultas.splice(consultas.findIndex((x) => x.id === id), 1, n); else consultas.push(n); return n }
    const ctx = { sesion: admin, pacientes, especialistas, guardar: guardarConsulta, ahora: AHORA }
    const base = { especialistaId: 'e1', motivo: 'Control', acompanamiento: true, traduccion: false }
    const receta = aArchivoReceta({ nombre: 'receta.png', tipo: 'image/png', tamano: 1_000_000 }, 'blob:receta-de-ana')!

    expect((await registrarAtencion({ ...base, pacienteId: 'p1', estado: 'programada', fecha: '2026-11-25T16:00:00.000Z', overview: 'Llegar en ayunas', },
      ctx)).ok).toBe(true)
    expect((await registrarAtencion({ ...base, pacienteId: 'p1', estado: 'completada', fecha: '2026-11-10T16:00:00.000Z', overview: 'Presión estable', notaVisible: 'Caminar a diario', notaInterna: 'Solo administración',
      tratamiento: { medicamentos: [{ nombre: 'Medicamento de Ana', dosis: '10 mg', frecuencia: 'Cada 24 horas', duracion: '30 días', indicaciones: 'Con agua', horarios: ['mañana'] }], sinMedicamentos: false, indicacionesGenerales: '' }, receta }, ctx)).ok).toBe(true)
    expect((await registrarAtencion({ ...base, pacienteId: 'p2', estado: 'completada', fecha: '2026-11-12T16:00:00.000Z', overview: 'Revisión sin cambios',
      tratamiento: { medicamentos: [], sinMedicamentos: true, indicacionesGenerales: 'Reposo' } }, ctx)).ok).toBe(true)

    // M01: cada paciente entra con su cuenta.
    const entrar = (email: string) => iniciarSesionEnMemoria({ email, password: 'demo123', rol: 'paciente', administradores: [], pacientes, passwordDemo: { admin: 'x', paciente: 'demo123' }, ahora: AHORA })
    const a = entrar('ana@example.com'); const b = entrar('beto@example.com')
    if (!a.ok || !b.ok) throw new Error('los pacientes deberían entrar')

    // M03: Ana envía su historial; no puede enviar el de Beto.
    const guardarHist = (id: string, h: NonNullable<Paciente['historialInicial']>) => { pacientes.find((p) => p.id === id)!.historialInicial = h }
    const respuestas = { padecimientos: [], sinPadecimientos: true, alergias: ['Penicilina'], sinAlergias: false, tratamientos: [], sinTratamientos: true }
    expect((await enviarHistorial(respuestas, { sesion: a.sesion, paciente: pacientes[1], guardar: guardarHist })).ok).toBe(false)
    expect((await enviarHistorial(respuestas, { sesion: a.sesion, paciente: pacientes[0], guardar: guardarHist, ahora: AHORA })).ok).toBe(true)

    // M08: lo que ve cada paciente.
    expect(proximasDelPaciente(consultas, 'p1', AHORA)).toHaveLength(1)
    expect(proximasDelPaciente(consultas, 'p2', AHORA)).toHaveLength(0)
    expect(realizadasDelPaciente(consultas, 'p1')).toHaveLength(1)
    const tA = ultimoTratamiento(consultas, 'p1'); const tB = ultimoTratamiento(consultas, 'p2')
    expect(tA.estado === 'con-tratamiento' && tA.tratamiento.medicamentos[0].nombre).toBe('Medicamento de Ana')
    expect(tB.estado === 'con-tratamiento' && tB.tratamiento.sinMedicamentos).toBe(true)

    const expA = obtenerExpediente(a.sesion, 'p1', { pacientes, consultas })
    expect(expA.ok).toBe(true)
    expect(JSON.stringify(expA)).not.toContain('Solo administración')
    expect(obtenerExpediente(a.sesion, 'p2', { pacientes, consultas })).toEqual({ ok: false, motivo: 'recurso-ajeno' })
    expect(obtenerExpediente(b.sesion, 'p1', { pacientes, consultas })).toEqual({ ok: false, motivo: 'recurso-ajeno' })

    // M06: la receta de Ana la ve Ana y la administración, no Beto.
    const consultaConReceta = consultas.find((c) => c.receta)
    expect(entregarReceta(a.sesion, consultaConReceta).ok).toBe(true)
    expect(entregarReceta(admin, consultaConReceta).ok).toBe(true)
    expect(entregarReceta(b.sesion, consultaConReceta)).toEqual({ ok: false, motivo: 'recurso-ajeno' })

    // La administración sí ve las notas internas.
    const expAdmin = obtenerExpediente(admin, 'p1', { pacientes, consultas })
    expect(JSON.stringify(expAdmin)).toContain('Solo administración')
  })
})

