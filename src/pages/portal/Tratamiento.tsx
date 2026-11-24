import { AlertCircle, CalendarDays, Clock, Expand, Lock, Pill, Timer } from 'lucide-react'
import { useState } from 'react'
import { useEnlaceReceta } from '../../lib/useEnlaceReceta'
import { Lightbox } from '../../components/Lightbox'
import { Avatar, Badge, Card, cx } from '../../components/ui'
import type { Medicamento } from '../../data/types'
import { fechaLarga, hora } from '../../lib/format'
import { entregarReceta } from '../../modules/recetas/archivo'
import { useI18n } from '../../lib/i18n'
import { usePaciente } from '../../lib/usePaciente'
import { HorarioChips, horarioMeta } from './Inicio'

export default function Tratamiento() {
  const { t, lang } = useI18n()
  const { ultima, esp, sesion } = usePaciente()
  const [zoom, setZoom] = useState(false)
  const urlReceta = useEnlaceReceta(ultima?.receta)

  if (!ultima) {
    return <Card className="p-10 text-center text-ink-500"><Pill className="mx-auto mb-2 size-8 text-ink-300" />{t('trat.sinTrat')}</Card>
  }
  const e = esp(ultima.especialistaId)
  const tr = ultima.tratamiento
  // M06: la foto solo se entrega al paciente dueño de la consulta.
  const receta = entregarReceta(sesion, ultima)
  const fotoReceta = receta.ok ? urlReceta : undefined
  const porHorario = (h: Medicamento['horarios'][number]) => tr?.medicamentos.filter((m) => m.horarios.includes(h)) ?? []

  return (
    <div>
      <div className="mb-6 flex animate-fade-up flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{t('trat.titulo')}</h1>
          <p className="mt-1 flex items-center gap-1.5 text-ink-500"><CalendarDays className="size-4" />{fechaLarga(ultima.fecha, lang)} · {hora(ultima.fecha, lang)}</p>
        </div>
        <Badge tone="gray" icon={<Lock className="size-3" />} className="self-start py-1 sm:self-auto">{t('trat.soloLectura')}</Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <Card className="flex items-center gap-4 p-5">
            <Avatar name={e.nombre} src={e.foto} size={56} />
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wider text-ink-400">{t('trat.recetadoPor')}</p>
              <p className="truncate font-bold">{e.nombre}</p>
              <p className="truncate text-sm text-ink-500">{e.especialidad} · {e.institucion}</p>
            </div>
          </Card>

          {tr ? (
            <>
              {tr.sinMedicamentos && <Card className="p-6 text-center text-sm font-semibold text-ink-600"><Pill className="mx-auto mb-2 size-7 text-ink-300" />{t('trat.sinMeds')}</Card>}
              <div className="space-y-3">
                {tr.medicamentos.map((m, i) => (
                  <Card key={i} className="overflow-hidden">
                    <div className="flex items-start gap-4 p-5">
                      <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 text-white shadow-md shadow-brand-500/30"><Pill className="size-6" /></div>
                      <div className="min-w-0 flex-1">
                        <p className="text-lg font-extrabold">{m.nombre}</p>
                        <p className="text-sm font-semibold text-brand-700">{m.dosis}</p>
                        <div className="mt-2"><HorarioChips m={m} /></div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 border-t border-ink-100 bg-ink-50/60 text-sm">
                      <div className="flex items-center gap-2 border-r border-ink-100 px-5 py-3"><Clock className="size-4 text-ink-400" /><span><span className="block text-xs text-ink-400">{t('trat.frecuencia')}</span><span className="font-semibold">{m.frecuencia}</span></span></div>
                      <div className="flex items-center gap-2 px-5 py-3"><Timer className="size-4 text-ink-400" /><span><span className="block text-xs text-ink-400">{t('trat.duracion')}</span><span className="font-semibold">{m.duracion}</span></span></div>
                    </div>
                    {m.indicaciones && <p className="border-t border-ink-100 px-5 py-3 text-sm text-ink-700"><span className="font-semibold">{t('trat.cuando')}: </span>{m.indicaciones}</p>}
                  </Card>
                ))}
              </div>

              {tr.indicacionesGenerales && (
                <Card className="p-5">
                  <p className="mb-2 font-bold">{t('trat.generales')}</p>
                  <p className="text-sm leading-relaxed text-ink-700">{tr.indicacionesGenerales}</p>
                </Card>
              )}
            </>
          ) : <Card className="p-8 text-center text-sm text-ink-500">{t('trat.sinTrat')}</Card>}

          <p className="flex gap-2 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900"><AlertCircle className="size-5 shrink-0 text-amber-600" />{t('trat.aviso')}</p>
        </div>

        <div className="space-y-6">
          {tr && tr.medicamentos.length > 0 && (
            <Card className="p-5">
              <p className="mb-4 font-bold">{t('trat.horario')}</p>
              <div className="space-y-3">
                {(['mañana', 'tarde', 'noche'] as const).map((h) => {
                  const { icon: Icon, cls } = horarioMeta[h]
                  const ms = porHorario(h)
                  return (
                    <div key={h} className="flex items-start gap-3">
                      <div className={cx('grid size-10 shrink-0 place-items-center rounded-xl ring-1', cls)}><Icon className="size-5" /></div>
                      <div className="min-w-0 flex-1 border-b border-ink-100 pb-3">
                        <p className="text-sm font-bold">{t(`trat.${h}`)}</p>
                        {ms.length ? ms.map((m) => <p key={m.nombre} className="text-sm text-ink-600">{m.nombre} {m.dosis}</p>) : <p className="text-sm text-ink-300">—</p>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </Card>
          )}

          {fotoReceta && (
            <Card className="overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4">
                <p className="font-bold">{t('trat.receta')}</p>
                <span className="text-xs text-ink-400">{t('trat.ampliar')}</span>
              </div>
              <button onClick={() => setZoom(true)} className="group relative block w-full">
                <img src={fotoReceta} alt={t('trat.receta')} className="h-80 w-full object-cover object-top transition duration-300 group-hover:scale-[1.02]" />
                <span className="absolute bottom-3 right-3 grid size-10 place-items-center rounded-full bg-ink-900/70 text-white backdrop-blur"><Expand className="size-4.5" /></span>
              </button>
            </Card>
          )}
        </div>
      </div>

      {zoom && fotoReceta && <Lightbox src={fotoReceta} alt={t('trat.receta')} onClose={() => setZoom(false)} />}
    </div>
  )
}
