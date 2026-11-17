// PT11 · RNF-01 / CA-15: recorre las pantallas principales de ambos roles a 360, 390 y 1440 px y busca desbordes
// horizontales. Uso: node tools/auditoria-responsiva.mjs <url-base> <carpeta-de-salida>
// Requiere Google Chrome instalado y la app corriendo (npm run dev).
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'

const [base = 'http://127.0.0.1:5173', salida = 'docs/evidencias/pt11-responsivo'] = process.argv.slice(2)
mkdirSync(salida, { recursive: true })
const puerto = 9300 + (process.pid % 500)
const candidatos = [process.env.CHROME_PATH, ...(process.platform === 'darwin'
  ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']
  : process.platform === 'win32'
    ? [process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA].filter(Boolean).map((p) => `${p}/Google/Chrome/Application/chrome.exe`)
    : ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'])]
const ejecutable = candidatos.find((p) => p && existsSync(p))
if (!ejecutable) throw new Error('No se encontró Chrome. Define CHROME_PATH con la ruta al ejecutable.')
const chrome = spawn(ejecutable, [
  '--headless=new', '--hide-scrollbars', `--remote-debugging-port=${puerto}`, `--user-data-dir=${salida}/.chrome`, 'about:blank',
], { stdio: 'ignore', windowsHide: true })
let falloChrome
chrome.on('error', (e) => { falloChrome = e })
process.on('exit', () => { chrome.kill() })
const dormir = (ms) => new Promise((r) => setTimeout(r, ms))

let objetivo
for (let i = 0; i < 80; i++) { try { objetivo = (await (await fetch(`http://127.0.0.1:${puerto}/json`)).json()).find((t) => t.type === 'page'); if (objetivo) break } catch { /* aún arrancando */ } await dormir(250) }
if (!objetivo || falloChrome) { chrome.kill(); throw falloChrome ?? new Error('Chrome no abrió el puerto de depuración a tiempo.') }
const ws = new WebSocket(objetivo.webSocketDebuggerUrl)
await new Promise((r) => ws.addEventListener('open', r))
let n = 0
const pendientes = new Map()
ws.addEventListener('message', (m) => { const d = JSON.parse(m.data); if (d.id && pendientes.has(d.id)) { pendientes.get(d.id)(d); pendientes.delete(d.id) } })
const cdp = (method, params = {}) => new Promise((r) => { const id = ++n; pendientes.set(id, r); ws.send(JSON.stringify({ id, method, params })) })
const evaluar = async (expresion) => (await cdp('Runtime.evaluate', { expression: expresion, awaitPromise: true, returnByValue: true })).result?.result?.value

const sesiones = {
  admin: { rol: 'admin', nombre: 'Liz Hernández', email: 'liz@lizcare.mx' },
  paciente: { rol: 'paciente', nombre: 'Emily Carter', email: 'emily@demo.com', pacienteId: 'p2' },
}
const pantallas = [
  ['publica', '/'], ['publica', '/login'], ['publica', '/privacidad'],
  ['admin', '/admin'], ['admin', '/admin/pacientes'], ['admin', '/admin/pacientes/nuevo'], ['admin', '/admin/pacientes/p1?tab=consultas'],
  ['admin', '/admin/consultas/nueva?paciente=p1'], ['admin', '/admin/agenda'], ['admin', '/admin/especialistas'],
  ['paciente', '/portal'], ['paciente', '/portal/citas'], ['paciente', '/portal/tratamiento'], ['paciente', '/portal/expediente'], ['paciente', '/portal/historial-inicial'],
]
const anchos = [360, 390, 1440]
const informe = []

await cdp('Page.enable')
for (const ancho of anchos) {
  await cdp('Emulation.setDeviceMetricsOverride', { width: ancho, height: ancho < 800 ? 800 : 900, deviceScaleFactor: 1, mobile: ancho < 800 })
  for (const [rol, ruta] of pantallas) {
    await cdp('Page.navigate', { url: base + '/login' })
    await dormir(500)
    const sesion = rol === 'publica' ? null : { ...sesiones[rol], iniciadaEl: new Date().toISOString() }
    await evaluar(`sessionStorage.clear(); ${sesion ? `sessionStorage.setItem('lizcare.sesion', ${JSON.stringify(JSON.stringify(sesion))})` : ''}; 1`)
    await cdp('Page.navigate', { url: base + ruta })
    await dormir(900)
    const r = await evaluar(`(() => {
      const w = document.documentElement.clientWidth
      const fuera = [...document.querySelectorAll('body *')].filter((e) => { const b = e.getBoundingClientRect(); return b.width > 0 && b.right > w + 1 && !e.closest('.fixed, .truncate, [data-scroll-local], .overflow-x-auto, .overflow-hidden') && !e.matches('.fixed') }).slice(0, 5).map((e) => e.tagName.toLowerCase() + '.' + String(e.className).split(' ').slice(0, 6).join('.') + ' «' + (e.textContent || '').trim().slice(0, 25) + '»')
      const chicos = [...document.querySelectorAll('a, button')].filter((e) => { const b = e.getBoundingClientRect(); return b.width > 0 && (b.height < 32 || b.width < 32) && b.top < innerHeight * 3 }).length
      return { ancho: w, scrollWidth: document.documentElement.scrollWidth, fuera, controlesPequenos: chicos, titulo: (document.querySelector('h1')?.textContent || '').trim().slice(0, 50) }
    })()`)
    const captura = (await cdp('Page.captureScreenshot', { format: 'png' })).result.data
    const nombre = `${ancho}-${ruta.replace(/[^a-z0-9]+/gi, '_')}.png`
    writeFileSync(`${salida}/${nombre}`, Buffer.from(captura, 'base64'))
    informe.push({ ancho, ruta, ...r, desborda: r.scrollWidth > r.ancho + 1 })
  }
}
ws.close(); chrome.kill()
writeFileSync(`${salida}/informe.json`, JSON.stringify(informe, null, 2))
const malas = informe.filter((x) => x.desborda || x.fuera.length)
console.log(`${informe.length} pantallas revisadas; ${malas.length} con desborde`)
for (const m of malas) console.log(` ✗ ${m.ancho}px ${m.ruta}: scrollWidth ${m.scrollWidth}/${m.ancho} ${m.fuera.join(' ')}`)
process.exit(malas.length ? 1 : 0)

