import { asset } from '../../lib/asset'
import { ArrowLeft, Camera, Check, ClipboardList, Eye, FileImage, ImagePlus, Lock, Moon, Pill, Plus, Save, Search, Stethoscope, Sun, Sunset, Trash2, UploadCloud, X } from 'lucide-react'
import { useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Avatar, Badge, Button, ButtonLink, Card, Field, Input, PageHeader, Select, Textarea, Toggle, cx } from '../../components/ui'
import type { ArchivoReceta, EstadoConsulta, Medicamento } from '../../data/types'
import { fechaLarga, nombreCompleto, normalizar } from '../../lib/format'
import { useStore } from '../../lib/store'
import type { ErroresAtencion } from '../../modules/citas/atenciones'
import { useEnlaceReceta } from '../../lib/useEnlaceReceta'
import { aArchivoReceta, validarArchivoReceta } from '../../modules/recetas/archivo'
import { medicamentoVacio } from '../../modules/tratamientos/tratamiento'

type Horario = Medicamento['horarios'][number]
const medVacio = medicamentoVacio
const frecuencias = ['Cada 8 horas', 'Cada 12 horas', 'Cada 24 horas', 'Cada semana', 'Según necesidad']
const horarioIcon: Record<Horario, ReactNode> = { mañana: <Sun className="size-3.5" />, tarde: <Sunset className="size-3.5" />, noche: <Moon className="size-3.5" /> }

function Paso({ n, title, desc, children, right }: { n: number; title: string; desc?: string; children: ReactNode; right?: ReactNode }) {
  return (
    <Card className="p-5 sm:p-6">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-ink-900 text-sm font-bold text-white">{n}</span>
          <div><h2 className="font-bold">{title}</h2>{desc && <p className="text-sm text-ink-500">{desc}</p>}</div>
        </div>
        {right}
      </div>
      {children}
    </Card>
  )
}

export default function NuevaConsulta() {
  const [params] = useSearchParams()
  const { pacientes, especialistas, consultas, guardarAtencion, reportarFallo, notify } = useStore()
  const navigate = useNavigate()
  // ?cita=id registra el resultado de una cita; ?consulta=id completa tratamiento, receta o notas de una consulta ya realizada.
  const citaPrevia = consultas.find((c) => c.id === (params.get('cita') ?? params.get('consulta')))
  const editando = citaPrevia?.estado === 'completada'
  const fileRef = useRef<HTMLInputElement>(null)

  const [pacienteId, setPacienteId] = useState(citaPrevia?.pacienteId ?? params.get('paciente') ?? '')
  const [buscarP, setBuscarP] = useState('')
  const [fecha, setFecha] = useState(() => (citaPrevia ? new Date(citaPrevia.fecha) : new Date()).toLocaleDateString('sv-SE'))
  const [horaV, setHoraV] = useState(() => new Date(citaPrevia?.fecha ?? Date.now()).toTimeString().slice(0, 5))
  const [especialistaId, setEspecialistaId] = useState(citaPrevia?.especialistaId ?? '')
  const [estado, setEstado] = useState<EstadoConsulta>('completada')
  const [motivo, setMotivo] = useState(citaPrevia?.motivo ?? '')
  const [overview, setOverview] = useState(citaPrevia?.overview ?? '')
  const [acomp, setAcomp] = useState(citaPrevia?.acompanamiento ?? true)
  const [trad, setTrad] = useState(() => citaPrevia?.traduccion ?? pacientes.find((p) => p.id === params.get('paciente'))?.idioma !== 'Español')
  const [meds, setMeds] = useState<Medicamento[]>(() => citaPrevia?.tratamiento?.medicamentos.length ? citaPrevia.tratamiento.medicamentos.map((m) => ({ ...m, horarios: [...m.horarios] })) : [medVacio()])
  const [sinMeds, setSinMeds] = useState(citaPrevia?.tratamiento?.sinMedicamentos ?? false)
  const [indGen, setIndGen] = useState(citaPrevia?.tratamiento?.indicacionesGenerales ?? '')
  const [receta, setReceta] = useState<ArchivoReceta | null>(citaPrevia?.receta ?? null)
  const urlReceta = useEnlaceReceta(receta ?? undefined)
  const [arrastrando, setArrastrando] = useState(false)
  const [notaVisible, setNotaVisible] = useState(citaPrevia?.notaVisible ?? '')
  const [notaInterna, setNotaInterna] = useState(citaPrevia?.notaInterna ?? '')
  const [err, setErr] = useState<ErroresAtencion>({})
  const [errArchivo, setErrArchivo] = useState('')
  const [guardando, setGuardando] = useState(false)

  const paciente = pacientes.find((p) => p.id === pacienteId)
  const especialista = especialistas.find((e) => e.id === especialistaId)
  const completada = estado === 'completada'
  const errMed = (i: number) => err.tratamiento?.medicamentos[i] ?? {}

  const candidatos = useMemo(() => {
    const n = normalizar(buscarP)
    return pacientes.filter((p) => p.activo && (!n || normalizar(nombreCompleto(p)).includes(n))).slice(0, 6)
  }, [buscarP, pacientes])

  const setMed = (i: number, patch: Partial<Medicamento>) => setMeds((m) => m.map((x, j) => (j === i ? { ...x, ...patch } : x)))
  const toggleHorario = (i: number, h: Horario) => setMed(i, { horarios: meds[i].horarios.includes(h) ? meds[i].horarios.filter((x) => x !== h) : [...meds[i].horarios, h] })
  const quitarError = (k: keyof ErroresAtencion) => setErr((x) => ({ ...x, [k]: undefined }))

  // M06 decide si el archivo es válido (JPG, PNG o HEIC, hasta 10 MB).
  const cargarArchivo = (f?: File) => {
    if (!f) return
    const v = validarArchivoReceta({ nombre: f.name, tipo: f.type, tamano: f.size })
    if (!v.ok) { setErrArchivo(v.mensaje); notify(v.mensaje, 'error'); return }
    setErrArchivo('')
    const a = aArchivoReceta({ nombre: f.name, tipo: f.type, tamano: f.size }, URL.createObjectURL(f))
    // El archivo se conserva para subirlo al almacenamiento privado al guardar la consulta.
    setReceta(a ? { ...a, archivo: f } : null)
  }

  // M04 valida y guarda: paciente y especialista existentes, resumen en la consulta realizada, tratamiento y receta válidos.
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (guardando) return
    const instante = new Date(`${fecha}T${horaV}`)
    setGuardando(true)
    const r = await guardarAtencion({
      pacienteId, especialistaId, fecha: Number.isNaN(instante.getTime()) ? '' : instante.toISOString(), motivo, estado, overview,
      acompanamiento: acomp, traduccion: trad, notaVisible, notaInterna,
      tratamiento: completada ? { medicamentos: meds, sinMedicamentos: sinMeds, indicacionesGenerales: indGen } : undefined,
      receta: completada ? receta ?? undefined : undefined,
    }, citaPrevia)
    setGuardando(false)
    if (r.ok) {
      notify(completada ? 'Consulta registrada. El paciente ya puede verla en su portal.' : 'Cita agendada correctamente.')
      navigate(`/admin/pacientes/${pacienteId}?tab=consultas`)
      return
    }
    if (r.motivo === 'datos-invalidos') { setErr(r.errores); notify('Faltan datos por completar.', 'error'); return }
    if (r.motivo === 'sin-permiso') { notify('Tu sesión no tiene permiso para registrar consultas.', 'error'); return }
    notify(`No se pudo guardar. Código ${reportarFallo('guardar atención')}. Inténtalo de nuevo.`, 'error')
  }

  return (
    <form onSubmit={submit} noValidate>
      <PageHeader
        back={<Link to={paciente ? `/admin/pacientes/${paciente.id}` : '/admin'} className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-500 hover:text-ink-900"><ArrowLeft className="size-4" /> {paciente ? nombreCompleto(paciente) : 'Inicio'}</Link>}
        title={editando ? 'Completar la consulta' : citaPrevia ? 'Registrar resultado de la consulta' : 'Registrar consulta'}
        subtitle="Captura el resumen, el tratamiento y la foto de la receta."
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Paso n={1} title="Paciente y cita">
            <div className="grid gap-2 sm:grid-cols-2">
              {([['completada', 'Consulta realizada', 'Registrar resumen y tratamiento', ClipboardList], ['programada', 'Agendar cita futura', 'El paciente la verá en sus próximas citas', Stethoscope]] as const).map(([v, t, d, Icon]) => (
                <button type="button" key={v} onClick={() => setEstado(v)} disabled={!!citaPrevia && v === 'programada'}
                  className={cx('flex items-start gap-3 rounded-2xl border-2 p-4 text-left transition disabled:opacity-40', estado === v ? 'border-brand-500 bg-brand-50/50' : 'border-ink-100 hover:border-ink-200')}>
                  <Icon className={cx('mt-0.5 size-5', estado === v ? 'text-brand-600' : 'text-ink-400')} />
                  <span><span className="block font-bold">{t}</span><span className="block text-xs text-ink-500">{d}</span></span>
                </button>
              ))}
            </div>

            <div className="mt-5">
              <p className="mb-1.5 text-sm font-semibold text-ink-800">Paciente <span className="text-brand-600">*</span></p>
              {paciente ? (
                <div className="flex items-center gap-3 rounded-2xl border border-ink-200 p-3">
                  <Avatar name={nombreCompleto(paciente)} color={paciente.color} size={42} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{nombreCompleto(paciente)}</p>
                    <p className="truncate text-sm text-ink-500">{paciente.padecimientoPrincipal} · {paciente.idioma}</p>
                  </div>
                  {!citaPrevia && <Button type="button" variant="ghost" size="sm" onClick={() => setPacienteId('')}>Cambiar</Button>}
                </div>
              ) : (
                <div className={cx('rounded-2xl border p-2', err.paciente ? 'border-red-400' : 'border-ink-200')}>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
                    <input autoFocus value={buscarP} onChange={(e) => setBuscarP(e.target.value)} placeholder="Buscar paciente…" className="h-10 w-full rounded-xl bg-ink-50 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30" />
                  </div>
                  <div className="mt-2 grid gap-1 sm:grid-cols-2">
                    {candidatos.map((p) => (
                      <button type="button" key={p.id} onClick={() => { setPacienteId(p.id); setTrad(p.idioma !== 'Español'); setErr((x) => ({ ...x, paciente: '' })) }} className="flex items-center gap-2.5 rounded-xl p-2 text-left hover:bg-ink-50">
                        <Avatar name={nombreCompleto(p)} color={p.color} size={32} />
                        <span className="min-w-0"><span className="block truncate text-sm font-semibold">{nombreCompleto(p)}</span><span className="block truncate text-xs text-ink-500">{p.padecimientoPrincipal}</span></span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {err.paciente && <p className="mt-1.5 text-xs font-medium text-red-600">{err.paciente}</p>}
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field label="Fecha" required error={err.fecha}><Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} invalid={!!err.fecha} /></Field>
              <Field label="Hora" required><Input type="time" value={horaV} onChange={(e) => setHoraV(e.target.value)} invalid={!!err.fecha} /></Field>
            </div>

            <div className="mt-5">
              <p className="mb-1.5 text-sm font-semibold text-ink-800">Especialista <span className="text-brand-600">*</span></p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {especialistas.map((e) => (
                  <button type="button" key={e.id} onClick={() => { setEspecialistaId(e.id); setErr((x) => ({ ...x, especialista: '' })) }}
                    className={cx('relative flex items-center gap-3 rounded-2xl border-2 p-2.5 text-left transition', especialistaId === e.id ? 'border-brand-500 bg-brand-50/50' : err.especialista ? 'border-red-200' : 'border-ink-100 hover:border-ink-200')}>
                    <Avatar name={e.nombre} src={e.foto} size={38} />
                    <span className="min-w-0"><span className="block truncate text-sm font-semibold">{e.nombre}</span><span className="block truncate text-xs text-ink-500">{e.especialidad}</span></span>
                    {especialistaId === e.id && <Check className="absolute right-2 top-2 size-4 text-brand-600" />}
                  </button>
                ))}
              </div>
              {err.especialista && <p className="mt-1.5 text-xs font-medium text-red-600">{err.especialista}</p>}
            </div>
          </Paso>

          <Paso n={2} title="Detalles de la consulta">
            <div className="space-y-4">
              <Field label="Motivo" required error={err.motivo}><Input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej. Seguimiento de hipertensión" invalid={!!err.motivo} /></Field>
              <Field label={completada ? 'Resumen general' : 'Indicaciones previas para el paciente'} required={completada} error={err.overview}
                hint={completada ? 'Diagnóstico, hallazgos y próximos pasos, en lenguaje sencillo.' : 'Ej. Llegar en ayunas, llevar estudios previos.'}>
                <Textarea value={overview} onChange={(e) => setOverview(e.target.value)} rows={4} invalid={!!err.overview} />
              </Field>
              <div className="grid gap-4 rounded-2xl bg-ink-50 p-4 sm:grid-cols-2">
                <Toggle checked={acomp} onChange={setAcomp} label="Acompañamiento" description="Liz asiste a la consulta" />
                <Toggle checked={trad} onChange={setTrad} label="Traducción" description={paciente ? `Idioma: ${paciente.idioma}` : 'Según idioma del paciente'} />
              </div>
            </div>
          </Paso>

          {completada && (
            <>
              <Paso n={3} title="Tratamiento" desc="Medicamentos y forma de tomarlos, o indica que no hubo."
                right={!sinMeds && <Button type="button" variant="secondary" size="sm" onClick={() => setMeds((m) => [...m, medVacio()])}><Plus className="size-4" /> Medicamento</Button>}>
                <div className="space-y-3">
                  <Toggle checked={sinMeds} onChange={(v) => { setSinMeds(v); quitarError('tratamiento') }} label="Sin medicamentos" description="La consulta no tuvo medicamentos; el paciente lo verá indicado" />
                  {err.tratamiento?.general && <p role="alert" className="text-sm font-medium text-red-600">{err.tratamiento.general}</p>}
                  {!sinMeds && meds.map((m, i) => (
                    <div key={i} className="rounded-2xl border border-ink-100 bg-ink-50/50 p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <p className="flex items-center gap-2 text-sm font-bold"><span className="grid size-6 place-items-center rounded-lg bg-white text-brand-600 shadow-sm"><Pill className="size-3.5" /></span>Medicamento {i + 1}</p>
                        {meds.length > 1 && <button type="button" onClick={() => setMeds((x) => x.filter((_, j) => j !== i))} className="grid size-8 place-items-center rounded-full text-ink-400 hover:bg-red-50 hover:text-red-600" aria-label="Quitar medicamento"><Trash2 className="size-4" /></button>}
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <Field label="Nombre" required error={errMed(i).nombre} className="lg:col-span-2"><Input value={m.nombre} onChange={(e) => setMed(i, { nombre: e.target.value })} placeholder="Ej. Losartán" invalid={!!errMed(i).nombre} /></Field>
                        <Field label="Dosis" required error={errMed(i).dosis}><Input value={m.dosis} onChange={(e) => setMed(i, { dosis: e.target.value })} placeholder="50 mg" invalid={!!errMed(i).dosis} /></Field>
                        <Field label="Duración" required error={errMed(i).duracion}><Input value={m.duracion} onChange={(e) => setMed(i, { duracion: e.target.value })} placeholder="30 días" invalid={!!errMed(i).duracion} /></Field>
                        <Field label="Frecuencia" required error={errMed(i).frecuencia}>
                          <Select value={m.frecuencia} onChange={(e) => setMed(i, { frecuencia: e.target.value })} invalid={!!errMed(i).frecuencia}>
                            <option value="">Selecciona</option>{frecuencias.map((f) => <option key={f}>{f}</option>)}
                          </Select>
                        </Field>
                        <div className="sm:col-span-1 lg:col-span-1">
                          <p className="mb-1.5 text-sm font-semibold text-ink-800">Horario</p>
                          <div className="flex gap-1.5">
                            {(['mañana', 'tarde', 'noche'] as Horario[]).map((h) => (
                              <button type="button" key={h} onClick={() => toggleHorario(i, h)} aria-pressed={m.horarios.includes(h)}
                                className={cx('flex h-11 flex-1 items-center justify-center gap-1 rounded-xl border text-xs font-semibold capitalize transition', m.horarios.includes(h) ? 'border-brand-500 bg-brand-500 text-white' : 'border-ink-200 bg-white text-ink-600')}>
                                {horarioIcon[h]}<span className="hidden sm:inline lg:hidden 2xl:inline">{h}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                        <Field label="Indicaciones" required error={errMed(i).indicaciones} className="sm:col-span-2"><Input value={m.indicaciones} onChange={(e) => setMed(i, { indicaciones: e.target.value })} placeholder="Ej. Tomar con alimentos" invalid={!!errMed(i).indicaciones} /></Field>
                      </div>
                    </div>
                  ))}
                  <Field label="Indicaciones generales" hint="Dieta, actividad física, señales de alarma…"><Textarea value={indGen} onChange={(e) => setIndGen(e.target.value)} rows={3} /></Field>
                </div>
              </Paso>

              <Paso n={4} title="Foto de la receta" desc="Toma una foto o súbela desde tu galería. El paciente podrá verla en su portal.">
                <input ref={fileRef} type="file" accept=".jpg,.jpeg,.png,.heic,image/jpeg,image/png,image/heic" capture="environment" className="hidden" onChange={(e) => { cargarArchivo(e.target.files?.[0]); e.target.value = '' }} />
                {receta ? (
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                    <div className="relative h-56 w-full overflow-hidden rounded-2xl border border-ink-100 sm:w-44">
                      {receta.tipoMime === 'image/heic'
                        ? <div className="grid size-full place-items-center bg-ink-50 p-3 text-center text-xs text-ink-500"><span><FileImage className="mx-auto mb-1 size-8 text-ink-400" />{receta.nombreOriginal}<br />(HEIC: la vista previa depende del navegador)</span></div>
                        : <img src={urlReceta} alt="Vista previa de la receta" className="size-full object-cover object-top" />}
                      <button type="button" onClick={() => setReceta(null)} className="absolute right-2 top-2 grid size-8 place-items-center rounded-full bg-ink-900/70 text-white hover:bg-ink-900" aria-label="Quitar foto"><X className="size-4" /></button>
                    </div>
                    <div>
                      <Badge tone="brand" icon={<Check className="size-3" />}>Receta lista para guardar</Badge>
                      <p className="mt-2 text-sm text-ink-500">Verifica que la foto sea legible antes de guardar.</p>
                      <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => fileRef.current?.click()}><ImagePlus className="size-4" /> Cambiar foto</Button>
                    </div>
                  </div>
                ) : (
                  <div
                    onDragOver={(e) => { e.preventDefault(); setArrastrando(true) }}
                    onDragLeave={() => setArrastrando(false)}
                    onDrop={(e) => { e.preventDefault(); setArrastrando(false); cargarArchivo(e.dataTransfer.files[0]) }}
                    className={cx('flex flex-col items-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition', arrastrando ? 'border-brand-500 bg-brand-50' : 'border-ink-200 bg-ink-50/50')}>
                    <div className="grid size-14 place-items-center rounded-2xl bg-white text-brand-600 shadow-card"><UploadCloud className="size-7" /></div>
                    <p className="mt-4 font-bold">Arrastra la foto aquí</p>
                    <p className="text-sm text-ink-500">JPG, PNG o HEIC · máximo 10 MB</p>
                    <div className="mt-5 flex flex-wrap justify-center gap-2">
                      <Button type="button" size="sm" onClick={() => fileRef.current?.click()}><Camera className="size-4" /> Tomar o elegir foto</Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => { setReceta({ url: asset('images/receta-ejemplo.png'), nombreOriginal: 'receta-ejemplo.png', tipoMime: 'image/png', tamanoBytes: 629556 }); notify('Se cargó una receta de ejemplo.') }}>Usar receta de ejemplo</Button>
                    </div>
                  </div>
                )}
                {(errArchivo || err.receta) && <p role="alert" className="mt-3 text-sm font-medium text-red-600">{errArchivo || err.receta}</p>}
              </Paso>
            </>
          )}

          <Paso n={completada ? 5 : 3} title="Notas" desc="Decide qué ve el paciente y qué queda solo para ti.">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-brand-100 bg-brand-50/40 p-4">
                <p className="mb-2 flex items-center gap-1.5 text-sm font-bold text-brand-700"><Eye className="size-4" /> Nota visible para el paciente</p>
                <Textarea value={notaVisible} onChange={(e) => setNotaVisible(e.target.value)} rows={3} placeholder="Ej. Llevar los resultados a la siguiente cita." />
              </div>
              <div className="rounded-2xl border border-amber-100 bg-amber-50/40 p-4">
                <p className="mb-2 flex items-center gap-1.5 text-sm font-bold text-amber-700"><Lock className="size-4" /> Nota interna (solo tú)</p>
                <Textarea value={notaInterna} onChange={(e) => setNotaInterna(e.target.value)} rows={3} placeholder="Observaciones privadas, pendientes, recordatorios…" />
              </div>
            </div>
          </Paso>
        </div>

        <div className="xl:sticky xl:top-24 xl:self-start">
          <Card className="overflow-hidden">
            <div className="flex items-center gap-2 border-b border-ink-100 bg-ink-50 px-5 py-3 text-sm font-bold"><Eye className="size-4 text-brand-600" /> Así lo verá el paciente</div>
            <div className="space-y-4 p-5">
              {especialista ? (
                <div className="flex items-center gap-3">
                  <Avatar name={especialista.nombre} src={especialista.foto} size={44} />
                  <div className="min-w-0"><p className="truncate font-bold">{especialista.nombre}</p><p className="text-sm text-ink-500">{especialista.especialidad}</p></div>
                </div>
              ) : <p className="text-sm text-ink-400">Selecciona un especialista…</p>}
              <p className="text-sm font-semibold text-ink-700">{fecha && horaV ? `${fechaLarga(new Date(`${fecha}T${horaV}`).toISOString())} · ${horaV}` : '—'}</p>
              {motivo && <p className="text-sm"><span className="text-ink-500">Motivo: </span>{motivo}</p>}
              {completada && sinMeds && <p className="rounded-xl bg-ink-50 px-3 py-2 text-sm text-ink-600">Sin medicamentos en esta consulta.</p>}
              {completada && !sinMeds && meds.some((m) => m.nombre) && (
                <div className="space-y-2">
                  {meds.filter((m) => m.nombre).map((m, i) => (
                    <div key={i} className="flex items-center gap-2 rounded-xl bg-ink-50 px-3 py-2 text-sm">
                      <Pill className="size-4 shrink-0 text-brand-500" />
                      <span className="min-w-0 flex-1 truncate font-semibold">{m.nombre} {m.dosis}</span>
                      <span className="flex gap-0.5 text-ink-400">{m.horarios.map((h) => <span key={h}>{horarioIcon[h]}</span>)}</span>
                    </div>
                  ))}
                </div>
              )}
              {notaVisible && <p className="rounded-xl bg-brand-50 p-3 text-sm text-ink-700">{notaVisible}</p>}
              {receta && receta.tipoMime !== 'image/heic' && <img src={urlReceta} alt="" className="h-28 w-full rounded-xl object-cover object-top" />}
              <p className="flex items-center gap-1.5 text-xs text-ink-400"><Lock className="size-3.5" /> Las notas internas nunca se muestran al paciente.</p>
            </div>
            <div className="grid gap-2 border-t border-ink-100 p-4">
              <Button type="submit" size="lg"><Save className="size-4.5" /> {completada ? 'Guardar consulta' : 'Agendar cita'}</Button>
              <ButtonLink to={paciente ? `/admin/pacientes/${paciente.id}` : '/admin'} variant="ghost">Cancelar</ButtonLink>
            </div>
          </Card>
        </div>
      </div>
    </form>
  )
}
