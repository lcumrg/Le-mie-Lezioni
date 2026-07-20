import { describe, it, expect } from 'vitest'
import { isAnnoValido, annoSuccessivo, annoPrecedente, classeSuccessiva } from './anni'

describe('isAnnoValido', () => {
  it('accetta anni consecutivi', () => {
    expect(isAnnoValido('2026-2027')).toBe(true)
  })
  it('rifiuta anni non consecutivi, formati errati e vuoti', () => {
    expect(isAnnoValido('2026-2030')).toBe(false)
    expect(isAnnoValido('2026/2027')).toBe(false)
    expect(isAnnoValido('26-27')).toBe(false)
    expect(isAnnoValido('')).toBe(false)
    expect(isAnnoValido(null)).toBe(false)
  })
})

describe('annoSuccessivo / annoPrecedente', () => {
  it('calcola il successivo e il precedente', () => {
    expect(annoSuccessivo('2025-2026')).toBe('2026-2027')
    expect(annoPrecedente('2026-2027')).toBe('2025-2026')
  })
  it('null su input non validi', () => {
    expect(annoSuccessivo('boh')).toBeNull()
    expect(annoPrecedente(null)).toBeNull()
  })
})

describe('classeSuccessiva', () => {
  it('avanza le classi intermedie', () => {
    expect(classeSuccessiva('1A')).toBe('2A')
    expect(classeSuccessiva('4B INF')).toBe('5B INF')
  })
  it('null per ultimo anno o nomi non standard', () => {
    expect(classeSuccessiva('5A')).toBeNull()
    expect(classeSuccessiva('PRIMA')).toBeNull()
    expect(classeSuccessiva('')).toBeNull()
  })
})
