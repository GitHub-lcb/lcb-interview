const DIGITS = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九']

/**
 * 把 1-99 的整数转换为中文数字（一、十二、二十、四十六……），
 * 用于首页「墨纸实验室」风格的分类编号 Tab。
 *
 * @param value 1-99 的整数
 * @returns 中文数字字符串
 */
export function toChineseNumeral(value: number): string {
  if (!Number.isInteger(value) || value < 1 || value > 99) {
    throw new RangeError('toChineseNumeral 仅支持 1-99 的整数')
  }
  if (value < 10) {
    return DIGITS[value]
  }
  const tens = Math.floor(value / 10)
  const ones = value % 10
  // 10-19 读作「十X」而非「一十X」，贴合中文计数习惯
  const tensPart = tens === 1 ? '十' : `${DIGITS[tens]}十`
  return ones === 0 ? tensPart : `${tensPart}${DIGITS[ones]}`
}
