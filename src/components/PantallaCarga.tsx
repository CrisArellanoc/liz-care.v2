// Se muestra mientras se leen los datos desde Supabase, para no confundir «cargando» con «sin datos».
export function PantallaCarga() {
  return (
    <div className="grid min-h-[50dvh] place-items-center" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-3 text-ink-500">
        <span className="size-8 animate-spin rounded-full border-4 border-brand-100 border-t-brand-500" />
        <p className="text-sm font-medium">Cargando tu información…</p>
      </div>
    </div>
  )
}
