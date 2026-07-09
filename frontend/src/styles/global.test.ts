import { describe, expect, it } from 'vitest'
import css from './global.css?raw'

const mobileCss = css.slice(
  css.indexOf('@media (max-width: 760px)'),
  css.indexOf('@media (max-width: 640px)'),
)

describe('global responsive styles', () => {
  it('keeps the single lottery recommendation numbers visible on mobile', () => {
    expect(mobileCss).toMatch(/\.lottery-group-grid\.is-single\s+\.lottery-number-row\s*{[\s\S]*display:\s*grid/)
    expect(mobileCss).toMatch(/\.lottery-group-grid\.is-single\s+\.lottery-number-row\s*{[\s\S]*grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(42px,\s*1fr\)\)/)
    expect(mobileCss).toMatch(/\.lottery-group-grid\.is-single\s+\.lottery-number-row\s+em\s*{[\s\S]*width:\s*100%/)
    expect(mobileCss).toMatch(/\.lottery-group-grid\.is-single\s+\.lottery-number-row\s+em\s*{[\s\S]*max-width:\s*48px/)
  })

  it('wraps long lottery recommendation text inside the mobile card width', () => {
    expect(mobileCss).toMatch(/\.lottery-recommendation[\s\S]*{[\s\S]*min-width:\s*0/)
    expect(mobileCss).toMatch(/\.lottery-recommendation-head\s*{[\s\S]*flex-wrap:\s*wrap/)
    expect(mobileCss).toMatch(/\.lottery-recommendation-head\s+\.ant-tag\s*{[\s\S]*white-space:\s*normal/)
    expect(mobileCss).toMatch(/\.lottery-recommendation\s*>\s*p[\s\S]*{[\s\S]*overflow-wrap:\s*anywhere/)
    expect(mobileCss).toMatch(/\.lottery-group-card\s+p[\s\S]*{[\s\S]*overflow-wrap:\s*anywhere/)
  })
})
