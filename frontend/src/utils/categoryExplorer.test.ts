import { describe, expect, it } from 'vitest'
import { categoryGroupForRole, resolveCategoryGroup } from './categoryExplorer'

describe('categoryExplorer', () => {
  it('keeps interview categories in stable product-facing groups', () => {
    expect(resolveCategoryGroup({ name: 'Java 并发' })).toBe('backend')
    expect(resolveCategoryGroup({ name: 'React' })).toBe('frontend')
    expect(resolveCategoryGroup({ name: 'AI 大模型' })).toBe('ai')
    expect(resolveCategoryGroup({ name: 'Docker 与 K8s' })).toBe('ops')
    expect(resolveCategoryGroup({ name: 'HR 面试' })).toBe('general')
  })

  it('opens the most relevant category group for the selected role', () => {
    expect(categoryGroupForRole('architecture')).toBe('ops')
    expect(categoryGroupForRole('frontend')).toBe('frontend')
    expect(categoryGroupForRole('general')).toBe('backend')
  })
})
