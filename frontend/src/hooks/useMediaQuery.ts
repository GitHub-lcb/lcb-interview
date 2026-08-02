import { useEffect, useState } from 'react'

/**
 * 订阅浏览器媒体查询，返回当前是否匹配。
 *
 * SSR 或测试环境缺少 window.matchMedia 时保持初始值不变；
 * 查询字符串变化时会重新订阅。首次挂载后通过 effect 同步真实结果。
 */
export function useMediaQuery(query: string, initial = false): boolean {
  const [matches, setMatches] = useState<boolean>(initial)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return
    }
    const mql = window.matchMedia(query)
    const sync = () => setMatches(mql.matches)
    sync()
    mql.addEventListener('change', sync)
    return () => mql.removeEventListener('change', sync)
  }, [query])

  return matches
}

/** 是否为窄屏设备（手机竖屏，对应 CSS 断点 ≤ 640px）。 */
export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 640px)')
}
