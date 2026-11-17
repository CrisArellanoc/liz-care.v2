# Trazabilidad v4 → código y pruebas

Estado al 17 de noviembre de 2026. Fuente de IDs: *Requerimientos y matriz de trazabilidad v4* (8 de octubre de 2026) y *Diseño modular*.

**Alcance de este avance:** toda la lógica de los módulos M01 a M11 está implementada y probada con datos en memoria. **Supabase (persistencia, Auth, Storage y RLS) queda para el final**; sigue activable con `VITE_SUPABASE_ACTIVO=true` (ver README).
Un RF solo se considera aceptado cuando tenga también su prueba contra la persistencia real; hasta entonces su estado es «lógica probada».

| RF / RNF | HU | Módulo | Código | Pruebas (`npm test`) | Estado |
|---|---|---|---|---|---|
| RF-01 | HU-01 | M02, M10 | `src/modules/pacientes/` | PT01 · `pacientes.test.ts` (22) | Lógica probada |
| RF-02 | HU-02.1, HU-02.2 | M04, M11 | `src/modules/citas/atenciones.ts` | PT02 · `citas.test.ts` (22) | Lógica probada |
| RF-03 | HU-03 | M07, M09 | `src/modules/expedientes/`, `citas/` | PT03 · `citas.test.ts`, `expedientes.test.ts` (11) | Lógica probada; error de carga reproducible con `?simularError=1` |
| RF-04 | HU-04.1 | M01 | `src/modules/identidad/autenticacion.ts` | PT04 · `identidad.test.ts` (19) | Lógica probada con cuentas de demostración; Auth real pendiente |
| RF-05 | HU-04.2 | M04, M08 | `citas/atenciones.ts` (`proximasDelPaciente`) | PT05 · `citas.test.ts` | Lógica probada |
| RF-06 | HU-04.3 | M07, M08 | `expedientes/expediente.ts` | PT06 · `expedientes.test.ts` | Lógica probada |
| RF-07 | HU-05.2 | M06, M01 | `src/modules/recetas/archivo.ts` | PT07 · `recetas.test.ts` (12) | Lógica probada; Storage privado pendiente |
| RF-08 | HU-05.1 | M05 | `src/modules/tratamientos/tratamiento.ts` | PT08 · `tratamientos.test.ts` (13) | Lógica probada |
| RF-09 | HU-06 | M05, M06, M08 | `tratamientos/`, `recetas/` | PT09 · `tratamientos.test.ts`, `recetas.test.ts` | Lógica probada |
| RF-10 | HU-07 | M03, M07 | `src/modules/historial-inicial/` | PT10 · `historial.test.ts` (13) | Lógica probada |
| RF-11 | HU-08 | M11, M04 | `src/modules/especialistas/` | PT14 · `especialistas.test.ts` (12) | Lógica probada |
| RNF-01 | HU-01 a HU-08 | M09 | `src/index.css`, `tools/auditoria-responsiva.mjs` | PT11 · `docs/evidencias/pt11-responsivo/informe.json` | 42 revisiones (14 pantallas × 360, 390, 1440 px), 0 desbordes. Revisión visual de 360 px con nombres largos: pendiente del equipo |
| RNF-02 | HU-04.1 a HU-04.3, HU-06, HU-07 | M01 | `identidad/permisos.ts` | PT12 · `identidad.test.ts`, `flujo-integrado.test.ts` | Reglas probadas en la aplicación; RLS real pendiente |
| RNF-03 | HU-01, HU-04.1, HU-07 | M01, M06, M10 | `src/modules/privacidad/`, `/privacidad` | PT13 · `privacidad.test.ts` (10) | Inventario de finalidades verificado; aviso legal pendiente de validar |

Recorrido completo con dos pacientes: `tests/flujo-integrado.test.ts`.

## Decisiones que tomó la implementación (revisar con el equipo)

1. **Medicamento completo:** v4 pide dosis, frecuencia, duración e indicaciones (RF-08, CA-05) y el diccionario de datos pide nombre, dosis, duración y frecuencia. Se exigen los cinco campos (nombre incluido).
2. **«Sin medicamentos» explícito:** una consulta realizada necesita medicamentos o la marca; una lista vacía no equivale a «ninguno».
3. **Historial inicial:** cada apartado tiene su propio «No tengo» (padecimientos, alergias, tratamientos). Cirugías y notas son opcionales.
4. **Hora local de León** (CA-11): «próxima» se decide por el día en `America/Mexico_City`; las citas de hoy cuentan aunque su hora ya pasara.
5. **Estados de atención:** solo programada y completada (se retiró «cancelada», que el modelo v4 no incluye). Una consulta realizada no vuelve a cita.
6. **Orden:** consultas realizadas de la más reciente a la más antigua; próximas citas de la más cercana a la más lejana; empates por id.
7. **Sesión:** expira a las 8 horas (propuesta del diseño modular, sin valor confirmado).
8. **Receta:** JPG, PNG y HEIC hasta 10 MB inclusive; un `.heic` sin tipo informado por el navegador se acepta por extensión.
9. **Notas internas:** nunca se envían a la vista del paciente (la propiedad no existe en el objeto), no solo se ocultan.

## Pendiente
- Supabase: Auth del paciente, tablas `especialista`, `atencion`, `historial_medico`, `medicamento_prescrito`, `archivo_receta` con RLS, Storage privado con enlaces firmados y pruebas contra la base real.
- Decisiones abiertas de v4: corrección del historial por la administradora (CA-07, supuesto), cuenta del paciente (cómo se crea y entrega), qué pasa al terminar el servicio.
- Validar con Liz Care los supuestos de v4 y las decisiones de arriba.


## Correcciones de lógica del 17 de noviembre

- El alta informa acceso pendiente, sin afirmar que se envió correo. La prueba integrada verifica el estado invitado y documenta su fixture de activación.
- La restauración de sesión rechaza fechas futuras, inválidas o ausentes y pacientes sin identificador.
- Se rechazan estados y sectores fuera del contrato, cambios de paciente al editar una atención y tamaños de archivo no válidos.
- El portal presenta un mensaje recuperable si falta el expediente o su acceso está inactivo; el visor ofrece descarga si el navegador no puede previsualizar una imagen.
- El script PT11 busca Chrome en Windows, macOS y Linux y agrega el historial inicial. Se debe volver a ejecutar para obtener evidencia de sus 45 revisiones.
- Ocho casos adicionales en `tests/regresiones-logica.casos.ts`, incorporados a Vitest por `regresiones-logica.test.ts`. Los ocho se ejecutaron directamente con Node 24 sobre los módulos TypeScript. La suite completa de Vitest y la compilación quedan pendientes de reproducir en un entorno con dependencias instaladas.

Estas correcciones mantienen la persistencia y la configuración de despliegue existentes.
