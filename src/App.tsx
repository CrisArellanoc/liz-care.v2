import { useEffect, type ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Toaster } from './components/ui'
import type { Rol } from './data/types'
import AdminLayout from './layouts/AdminLayout'
import PortalLayout from './layouts/PortalLayout'
import { useStore } from './lib/store'
import Agenda from './pages/admin/Agenda'
import Dashboard from './pages/admin/Dashboard'
import Especialistas from './pages/admin/Especialistas'
import NuevaConsulta from './pages/admin/NuevaConsulta'
import NuevoPaciente from './pages/admin/NuevoPaciente'
import PacienteDetalle from './pages/admin/PacienteDetalle'
import Pacientes from './pages/admin/Pacientes'
import Solicitudes from './pages/admin/Solicitudes'
import Citas from './pages/portal/Citas'
import Expediente from './pages/portal/Expediente'
import HistorialForm from './pages/portal/HistorialForm'
import Inicio from './pages/portal/Inicio'
import Tratamiento from './pages/portal/Tratamiento'
import Landing from './pages/public/Landing'
import Login from './pages/public/Login'
import NotFound from './pages/public/NotFound'
import NuevaContrasena from './pages/public/NuevaContrasena'
import RecuperarAcceso from './pages/public/RecuperarAcceso'
import Privacidad from './pages/public/Privacidad'
import { puedeAbrirRuta, rutaInicial } from './modules/identidad/permisos'

function RequireRol({ rol, children }: { rol: Rol; children: ReactNode }) {
  const { sesion } = useStore()
  const loc = useLocation()
  // M01 decide: sin sesión se pide iniciar sesión; con otro rol se vuelve a la zona propia (CA-09, CA-13).
  const d = puedeAbrirRuta(sesion, loc.pathname)
  if (!d.permitido && d.motivo === 'sin-sesion') return <Navigate to={`/login?rol=${rol}`} replace state={{ from: loc.pathname }} />
  if (!d.permitido && sesion) return <Navigate to={rutaInicial(sesion.rol)} replace />
  return <>{children}</>
}

function ScrollTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}

export default function App() {
  return (
    <>
      <ScrollTop />
      <Toaster />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/privacidad" element={<Privacidad />} />
        <Route path="/recuperar" element={<RecuperarAcceso />} />
        <Route path="/nueva-contrasena" element={<NuevaContrasena />} />
        <Route path="/admin" element={<RequireRol rol="admin"><AdminLayout /></RequireRol>}>
          <Route index element={<Dashboard />} />
          <Route path="solicitudes" element={<Solicitudes />} />
          <Route path="pacientes" element={<Pacientes />} />
          <Route path="pacientes/nuevo" element={<NuevoPaciente />} />
          <Route path="pacientes/:id/editar" element={<NuevoPaciente />} />
          <Route path="pacientes/:id" element={<PacienteDetalle />} />
          <Route path="consultas/nueva" element={<NuevaConsulta />} />
          <Route path="agenda" element={<Agenda />} />
          <Route path="especialistas" element={<Especialistas />} />
        </Route>
        <Route path="/portal" element={<RequireRol rol="paciente"><PortalLayout /></RequireRol>}>
          <Route index element={<Inicio />} />
          <Route path="citas" element={<Citas />} />
          <Route path="tratamiento" element={<Tratamiento />} />
          <Route path="expediente" element={<Expediente />} />
          <Route path="historial-inicial" element={<HistorialForm />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  )
}
