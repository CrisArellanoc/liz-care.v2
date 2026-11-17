import { describe, it } from 'vitest'
import { casos } from './regresiones-logica.casos'

describe('Regresiones de lógica del prototipo', () => {
  it.each(casos)('%s', (_nombre, comprobar) => comprobar())
})
