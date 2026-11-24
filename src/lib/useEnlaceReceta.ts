// Enlace de visualización de una receta. Con Supabase la foto está en un bucket privado: el enlace se firma al
// mostrarla y se renueva solo mientras la pantalla siga abierta, así la receta se puede ver siempre, sin ventana que se agote.
import { useEffect, useState } from 'react'
import { firmarReceta } from '../data/datosSupabase'
import { supabase } from '../data/supabase'
import type { ArchivoReceta } from '../data/types'

/** Cada enlace vive 10 minutos y se renueva cada 4, de modo que nunca vence con la pantalla abierta. */
const VIGENCIA_SEG = 600
const RENOVAR_MS = 4 * 60_000

export function useEnlaceReceta(receta: ArchivoReceta | undefined): string | undefined {
  const ruta = receta?.ruta
  const [firmado, setFirmado] = useState<{ ruta: string; url: string } | null>(null)

  useEffect(() => {
    if (!ruta || !supabase) return
    let vivo = true
    const firmar = () => { void firmarReceta(supabase!, ruta, VIGENCIA_SEG).then((url) => { if (vivo && url) setFirmado({ ruta, url }) }).catch(() => { /* se reintenta en la siguiente renovación */ }) }
    firmar()
    const id = setInterval(firmar, RENOVAR_MS)
    return () => { vivo = false; clearInterval(id) }
  }, [ruta])

  if (!receta) return undefined
  if (!ruta || !supabase) return receta.url // demostración o archivo recién elegido (vista previa local)
  return firmado?.ruta === ruta ? firmado.url : undefined
}
