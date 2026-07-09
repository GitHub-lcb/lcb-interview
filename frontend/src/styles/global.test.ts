import { describe, expect, it } from 'vitest'
import css from './global.css?raw'

describe('global responsive styles', () => {
  it('keeps the single lottery recommendation numbers visible on mobile', () => {
    expect(css).toMatch(/@media\s*\(max-width:\s*760px\)[\s\S]*\.lottery-group-grid\.is-single\s+\.lottery-number-row\s*{[\s\S]*display:\s*grid/)
    expect(css).toMatch(/@media\s*\(max-width:\s*760px\)[\s\S]*\.lottery-group-grid\.is-single\s+\.lottery-number-row\s*{[\s\S]*grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(42px,\s*1fr\)\)/)
    expect(css).toMatch(/@media\s*\(max-width:\s*760px\)[\s\S]*\.lottery-group-grid\.is-single\s+\.lottery-number-row\s+em\s*{[\s\S]*width:\s*100%/)
    expect(css).toMatch(/@media\s*\(max-width:\s*760px\)[\s\S]*\.lottery-group-grid\.is-single\s+\.lottery-number-row\s+em\s*{[\s\S]*max-width:\s*48px/)
  })
})
