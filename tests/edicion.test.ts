// M02 Pacientes · corrección de datos (CA-13): solo administración, validación como el alta, correo único, sin perder lo existente.
import { describe, expect, it } from 'vitest'
import type { Paciente, Sesion } from '../src/data/types'
import { aDatosAlta, editarPaciente } from '../src/modules/pacientes/edicion'
import { CorreoDuplicadoError, type NuevoPaciente } from '../src/modules/pacientes/registro'

const HOY = new Date('2026-11-23T12:00:00')
const admin: Sesion = { rol: 'admin', nombre: 'Liz', email: 'liz@lizcare.mx' }
const pac: Sesion = { rol: 'paciente', nombre: 'Emily', email: 'emily@demo.com', pacienteId: 'p1' }

const emily: Paciente = {
  id: 'p1', nombre: 'Emily', apellidoPaterno: 'Carter', fechaNacimiento: '1970-05-05', sexo: 'F', nacionalidad: 'Estadounidense', pais: 'US',
  idioma: 'Inglés', telefono: '+1 555 0100', email: 'emily@demo.com', padecimientoPrincipal: 'Hipertensión',
  contactoEmergencia: { nombre: 'Tom', parentesco: 'Esposo(a)', telefono: '+1 555 0101' }, altaEl: '2026-10-01T00:00:00Z', activo: true,
  portal: 'activo', color: '#00a58c', historialInicial: { completadoEl: '2026-10-02T00:00:00Z', padecimientos: [], sinPadecimientos: true, alergias: [], sinAlergias: true, tratamientos: [], sinTratamientos: true },
}
const hans: Paciente = { ...emily, id: 'p2', nombre: 'Hans', email: 'hans@demo.com', historialInicial: undefined }

const actualizar = (guardados: { id: string; datos: NuevoPaciente }[]) => (id: string, datos: NuevoPaciente) => {
  guardados.push({ id, datos })
  return { ...emily, ...datos, id }
}

describe('editarPaciente', () => {
  it('aDatosAlta devuelve los campos del formulario tal como están guardados', () => {
    const d = aDatosAlta(emily)
    expect(d).toMatchObject({ nombre: 'Emily', apellidoMaterno: '', email: 'emily@demo.com', emNombre: 'Tom', emParentesco: 'Esposo(a)' })
  })

  it('un paciente con sesión no puede editar (CA-13)', async () => {
    const g: { id: string; datos: NuevoPaciente }[] = []
    const r = await editarPaciente('p1', { ...aDatosAlta(emily), telefono: '1' }, { sesion: pac, pacientes: [emily], actualizar: actualizar(g), hoy: HOY })
    expect(r).toEqual({ ok: false, motivo: 'sin-permiso' })
    expect(g).toHaveLength(0)
  })

  it('sin sesión tampoco', async () => {
    const r = await editarPaciente('p1', aDatosAlta(emily), { sesion: null, pacientes: [emily], actualizar: actualizar([]), hoy: HOY })
    expect(r).toMatchObject({ ok: false, motivo: 'sin-permiso' })
  })

  it('el paciente debe existir', async () => {
    const r = await editarPaciente('zzz', aDatosAlta(emily), { sesion: admin, pacientes: [emily], actualizar: actualizar([]), hoy: HOY })
    expect(r).toEqual({ ok: false, motivo: 'no-existe' })
  })

  it('valida igual que el alta y no guarda si hay errores', async () => {
    const g: { id: string; datos: NuevoPaciente }[] = []
    const r = await editarPaciente('p1', { ...aDatosAlta(emily), telefono: '  ', email: 'no-es-correo' }, { sesion: admin, pacientes: [emily], actualizar: actualizar(g), hoy: HOY })
    expect(r.ok).toBe(false)
    if (!r.ok && r.motivo === 'datos-invalidos') expect(Object.keys(r.errores).sort()).toEqual(['email', 'telefono'])
    expect(g).toHaveLength(0)
  })

  it('guarda los cambios, normaliza el correo y avisa si cambió', async () => {
    const g: { id: string; datos: NuevoPaciente }[] = []
    const r = await editarPaciente('p1', { ...aDatosAlta(emily), telefono: ' +1 555 0199 ', email: '  EMILY.NUEVO@Demo.com ' }, { sesion: admin, pacientes: [emily, hans], actualizar: actualizar(g), hoy: HOY })
    expect(r.ok).toBe(true)
    if (r.ok) { expect(r.cambioCorreo).toBe(true); expect(r.paciente.email).toBe('emily.nuevo@demo.com'); expect(r.paciente.telefono).toBe('+1 555 0199') }
    expect(g[0].id).toBe('p1')
  })

  it('editar sin tocar el correo no marca cambioCorreo', async () => {
    const r = await editarPaciente('p1', { ...aDatosAlta(emily), idioma: 'Español' }, { sesion: admin, pacientes: [emily], actualizar: actualizar([]), hoy: HOY })
    expect(r.ok && r.cambioCorreo).toBe(false)
  })

  it('el correo de otro paciente bloquea (sin distinguir mayúsculas ni espacios)', async () => {
    const g: { id: string; datos: NuevoPaciente }[] = []
    const r = await editarPaciente('p1', { ...aDatosAlta(emily), email: ' HANS@demo.com' }, { sesion: admin, pacientes: [emily, hans], actualizar: actualizar(g), hoy: HOY })
    expect(r).toMatchObject({ ok: false, motivo: 'correo-duplicado' })
    expect(g).toHaveLength(0)
  })

  it('conservar el propio correo no cuenta como duplicado', async () => {
    const r = await editarPaciente('p1', aDatosAlta(emily), { sesion: admin, pacientes: [emily, hans], actualizar: actualizar([]), hoy: HOY })
    expect(r.ok).toBe(true)
  })

  it('un nombre repetido de otro paciente no bloquea la edición', async () => {
    const igual: Paciente = { ...hans, nombre: 'Emily', apellidoPaterno: 'Carter', fechaNacimiento: emily.fechaNacimiento }
    const r = await editarPaciente('p1', aDatosAlta(emily), { sesion: admin, pacientes: [emily, igual], actualizar: actualizar([]), hoy: HOY })
    expect(r.ok).toBe(true)
  })

  it('si la persistencia rechaza el correo por repetido (carrera), se informa como duplicado', async () => {
    const r = await editarPaciente('p1', { ...aDatosAlta(emily), email: 'otro@demo.com' }, { sesion: admin, pacientes: [emily], actualizar: () => { throw new CorreoDuplicadoError() }, hoy: HOY })
    expect(r).toEqual({ ok: false, motivo: 'correo-duplicado', existentes: [] })
  })

  it('un fallo de guardado se informa sin perder los datos', async () => {
    const r = await editarPaciente('p1', aDatosAlta(emily), { sesion: admin, pacientes: [emily], actualizar: () => { throw new Error('red') }, hoy: HOY })
    expect(r).toEqual({ ok: false, motivo: 'error-guardado' })
  })
})
