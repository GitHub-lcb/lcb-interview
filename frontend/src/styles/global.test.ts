import { describe, expect, it } from 'vitest'
import css from './global.css?raw'

const mobileCss = css.slice(
  css.indexOf('@media (max-width: 760px)'),
  css.indexOf('@media (max-width: 640px)'),
)

// 640px 断点到 480px 断点之间的导航触控样式。
const navCss = css.slice(
  css.indexOf('@media (max-width: 640px)'),
  css.indexOf('@media (max-width: 480px)'),
)

// 480px 断点之后的小屏头部样式。
const phoneCss = css.slice(css.indexOf('@media (max-width: 480px)'))

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

  it('shrinks main content padding on tablet width', () => {
    expect(mobileCss).toMatch(/\.main-content\s*{[\s\S]*padding:\s*20px\s+16px\s+!important/)
  })

  it('keeps comfortable touch targets on small screens', () => {
    expect(navCss).toMatch(/\.app-nav-item\s*{[\s\S]*width:\s*36px/)
    expect(navCss).toMatch(/\.app-nav-item\s*{[\s\S]*min-height:\s*36px/)
    expect(navCss).toMatch(/\.app-nav\s*{[\s\S]*scrollbar-width:\s*none/)
  })

  it('keeps long code blocks scrollable inside the card on phones', () => {
    expect(css).toMatch(/\.prose\s*{[\s\S]*min-width:\s*0/)
    expect(css).toMatch(/\.prose\s+pre\s*{[\s\S]*max-width:\s*100%/)
    expect(css).toMatch(/\.content-card\s*{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)/)
  })

  it('simplifies the header on phones and hides the search box', () => {
    expect(phoneCss).toMatch(/\.app-header\s*{[\s\S]*grid-template-columns:\s*30px\s+minmax\(0,\s*1fr\)\s+auto/)
    expect(phoneCss).toMatch(/\.app-brand-version\s*{[\s\S]*display:\s*none/)
    expect(phoneCss).toMatch(/\.app-header-search\s*{[\s\S]*display:\s*none/)
    expect(phoneCss).toMatch(/\.app-header-mobile-search\s*{[\s\S]*display:\s*inline-flex/)
  })
})
