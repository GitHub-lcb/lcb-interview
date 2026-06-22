import { describe, expect, it } from 'vitest'
import { experienceSets, freePromiseItems, prepRoutes } from './freeSuperiority'

describe('freeSuperiority data', () => {
  it('keeps public learning promises free and ungated', () => {
    const combinedText = freePromiseItems
      .flatMap(item => [item.title, item.description])
      .join(' ')

    expect(combinedText).toContain('免费')
    expect(combinedText).not.toMatch(/VIP|会员专属|付费解锁|购买/)
  })

  it('defines actionable preparation routes and experience sets', () => {
    expect(prepRoutes.length).toBeGreaterThanOrEqual(4)
    expect(experienceSets.length).toBeGreaterThanOrEqual(4)
    expect(prepRoutes.every(route => route.actions.length > 0)).toBe(true)
    expect(experienceSets.every(set => set.actions.length > 0)).toBe(true)
  })
})
