import { X, ZoomIn, ZoomOut } from 'lucide-react'
import { useEffect, useState } from 'react'

export function Lightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  const [zoom, setZoom] = useState(false)
  const [errorSrc, setErrorSrc] = useState<string | null>(null)
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', k)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', k); document.body.style.overflow = '' }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[90] flex animate-fade-up flex-col bg-ink-950/90 backdrop-blur-sm" role="dialog" aria-modal aria-label={alt} onClick={onClose}>
      <div className="flex items-center justify-between p-4 text-white" onClick={(e) => e.stopPropagation()}>
        <p className="truncate text-sm font-semibold">{alt}</p>
        <div className="flex gap-2">
          <button onClick={() => setZoom(!zoom)} className="grid size-10 place-items-center rounded-full bg-white/10 hover:bg-white/20" aria-label={zoom ? 'Alejar' : 'Acercar'}>
            {zoom ? <ZoomOut className="size-5" /> : <ZoomIn className="size-5" />}
          </button>
          <button onClick={onClose} className="grid size-10 place-items-center rounded-full bg-white/10 hover:bg-white/20" aria-label="Cerrar"><X className="size-5" /></button>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-4" onClick={(e) => e.stopPropagation()}>
        {errorSrc === src ? <p role="alert" className="p-6 text-center text-white">No se pudo previsualizar esta imagen. <a href={src} download className="underline">Descargar archivo</a></p> : <img src={src} alt={alt} onError={() => setErrorSrc(src)} onClick={() => setZoom(!zoom)}
          className={zoom ? 'mx-auto max-w-none cursor-zoom-out' : 'mx-auto max-h-full max-w-full cursor-zoom-in rounded-xl object-contain'}
          style={zoom ? { width: 'min(1400px, 200%)' } : undefined} />}
      </div>
    </div>
  )
}

