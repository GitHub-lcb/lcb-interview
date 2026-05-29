import React from 'react'

const icons: Record<string, React.ReactNode> = {
  'icon-java': (
    <svg viewBox="0 0 64 64" fill="none" width={48} height={48}>
      <rect width="64" height="64" rx="12" fill="#E76F00" />
      <text x="32" y="42" textAnchor="middle" fill="white" fontSize="22" fontWeight="bold" fontFamily="Arial">J</text>
    </svg>
  ),
  'icon-mysql': (
    <svg viewBox="0 0 64 64" fill="none" width={48} height={48}>
      <rect width="64" height="64" rx="12" fill="#4479A1" />
      <text x="32" y="42" textAnchor="middle" fill="white" fontSize="18" fontWeight="bold" fontFamily="Arial">SQL</text>
    </svg>
  ),
  'icon-redis': (
    <svg viewBox="0 0 64 64" fill="none" width={48} height={48}>
      <rect width="64" height="64" rx="12" fill="#DC382D" />
      <text x="32" y="42" textAnchor="middle" fill="white" fontSize="16" fontWeight="bold" fontFamily="Arial">Redis</text>
    </svg>
  ),
  'icon-spring': (
    <svg viewBox="0 0 64 64" fill="none" width={48} height={48}>
      <rect width="64" height="64" rx="12" fill="#6DB33F" />
      <text x="32" y="42" textAnchor="middle" fill="white" fontSize="14" fontWeight="bold" fontFamily="Arial">Spring</text>
    </svg>
  ),
}

export function getCategoryIcon(iconKey: string | undefined): React.ReactNode {
  if (iconKey && icons[iconKey]) {
    return icons[iconKey]
  }
  return (
    <svg viewBox="0 0 64 64" fill="none" width={48} height={48}>
      <rect width="64" height="64" rx="12" fill="#1677ff" />
      <text x="32" y="42" textAnchor="middle" fill="white" fontSize="20" fontWeight="bold" fontFamily="Arial">?</text>
    </svg>
  )
}
