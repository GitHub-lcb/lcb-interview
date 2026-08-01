import { describe, expect, it } from 'vitest'
import { toChineseNumeral } from './chineseNumeral'

describe('toChineseNumeral', () => {
  it('converts single digits', () => {
    expect(toChineseNumeral(1)).toBe('一')
    expect(toChineseNumeral(9)).toBe('九')
  })

  it('reads 10-19 without the leading 一', () => {
    expect(toChineseNumeral(10)).toBe('十')
    expect(toChineseNumeral(12)).toBe('十二')
  })

  it('converts round tens', () => {
    expect(toChineseNumeral(20)).toBe('二十')
    expect(toChineseNumeral(40)).toBe('四十')
  })

  it('converts compound numbers used by the 46 categories', () => {
    expect(toChineseNumeral(46)).toBe('四十六')
    expect(toChineseNumeral(99)).toBe('九十九')
  })

  it('rejects out-of-range input', () => {
    expect(() => toChineseNumeral(0)).toThrow(RangeError)
    expect(() => toChineseNumeral(100)).toThrow(RangeError)
    expect(() => toChineseNumeral(1.5)).toThrow(RangeError)
  })
})
