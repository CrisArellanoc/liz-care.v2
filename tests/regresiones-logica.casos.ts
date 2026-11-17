import assert from 'node:assert/strict'
import { sesionVigente, iniciarSesionEnMemoria, DURACION_SESION_MS } from '../src/modules/identidad/autenticacion'
import { aNuevoPaciente } from '../src/modules/pacientes/registro'
import { validarAtencion } from '../src/modules/citas/atenciones'
import type { DatosAtencion } from '../src/modules/citas/atenciones'
import { validarEspecialista } from '../src/modules/especialistas/catalogo'
import type { DatosEspecialista } from '../src/modules/especialistas/catalogo'
import { validarArchivoReceta, LIMITE_BYTES } from '../src/modules/recetas/archivo'
import { AHORA, pacienteA, pacienteB, catalogo, consulta, sesionA } from './datos'

const atencion: DatosAtencion = { pacienteId: 'pA', especialistaId: 'e1', fecha: AHORA.toISOString(), motivo: 'Prueba', estado: 'programada', overview: '', acompanamiento: false, traduccion: false }
const contexto = { pacientes: [pacienteA, pacienteB], especialistas: catalogo, ahora: AHORA }
const sesion = { ...sesionA, iniciadaEl: AHORA.toISOString() }

export const casos: [string, () => void][] = [
  ['una invitación pendiente no habilita el acceso ni acredita una activación', () => {
    const nuevo = aNuevoPaciente({ nombre: 'Prueba', apellidoPaterno: 'Paciente', apellidoMaterno: '', fechaNacimiento: '1990-01-01', sexo: 'X', nacionalidad: 'Mexicana', idioma: 'Español', telefono: '000', email: 'prueba@example.com', padecimientoPrincipal: 'Ficticio', emNombre: 'Contacto', emParentesco: 'Familiar', emTelefono: '000' }, true)
    assert.equal(nuevo.portal, 'invitado')
    const p = { ...pacienteA, ...nuevo }
    assert.equal(iniciarSesionEnMemoria({ email: p.email, password: 'demo', rol: 'paciente', administradores: [], pacientes: [p], passwordDemo: { admin: 'admin', paciente: 'demo' }, ahora: AHORA }).ok, false)
  }],
  ['una sesión no puede omitir el momento de inicio ni usar una fecha inválida o futura', () => {
    for (const iniciadaEl of [undefined, 'fecha inválida', new Date(AHORA.getTime() + 1).toISOString()]) assert.equal(sesionVigente({ ...sesion, iniciadaEl }, AHORA), false)
  }],
  ['la sesión vence exactamente en el límite y una sesión recién iniciada sigue vigente', () => {
    assert.equal(sesionVigente(sesion, AHORA), true)
    assert.equal(sesionVigente(sesion, new Date(AHORA.getTime() + DURACION_SESION_MS - 1)), true)
    assert.equal(sesionVigente(sesion, new Date(AHORA.getTime() + DURACION_SESION_MS)), false)
  }],
  ['una sesión de paciente sin identificador no se restaura', () => {
    assert.equal(sesionVigente({ ...sesion, pacienteId: undefined }, AHORA), false)
  }],
  ['un estado de atención ajeno al contrato se rechaza en tiempo de ejecución', () => {
    assert.ok(validarAtencion({ ...atencion, estado: 'cancelada' as DatosAtencion['estado'] }, contexto).estado)
  }],
  ['una edición no puede mover la atención al expediente de otro paciente', () => {
    const existente = consulta('c1', 'pA', AHORA.toISOString(), { estado: 'programada' })
    assert.ok(validarAtencion({ ...atencion, pacienteId: 'pB' }, { ...contexto, existente }).paciente)
    assert.equal(validarAtencion(atencion, { ...contexto, existente }).paciente, undefined)
  }],
  ['un sector desconocido no entra al catálogo de especialistas', () => {
    const d = { nombre: 'Doctora', especialidad: 'General', institucion: 'Clínica', sector: 'desconocido', direccion: '', telefono: '000', idiomas: 'Español' } as DatosEspecialista
    assert.ok(validarEspecialista(d).sector)
    assert.equal(validarEspecialista({ ...d, sector: 'Privado' }).sector, undefined)
  }],
  ['se rechazan tamaños no finitos o fraccionarios y se conserva el límite de receta', () => {
    const d = { nombre: 'receta.png', tipo: 'image/png', tamano: 1 }
    for (const tamano of [NaN, Infinity, -1, 0, 0.5, LIMITE_BYTES + 1]) assert.equal(validarArchivoReceta({ ...d, tamano }).ok, false)
    assert.equal(validarArchivoReceta({ ...d, tamano: LIMITE_BYTES }).ok, true)
  }],
]
