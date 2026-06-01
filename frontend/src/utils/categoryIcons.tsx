import React from 'react'

const icon = (fill: string, label: string, fontSize = 16, size = 40) => (
  <svg viewBox="0 0 64 64" fill="none" width={size} height={size}>
    <rect width="64" height="64" rx="12" fill={fill} opacity="0.9" />
    <text x="32" y="42" textAnchor="middle" fill="white" fontSize={fontSize} fontWeight="bold" fontFamily="'Inter', Arial, sans-serif">{label}</text>
  </svg>
)

const icons: Record<string, React.ReactNode> = {
  'icon-java': icon('#E76F00', 'J', 22),
  'icon-jvm': icon('#F89820', 'JVM', 13),
  'icon-mysql': icon('#4479A1', 'SQL', 18),
  'icon-redis': icon('#DC382D', 'Redis', 14),
  'icon-mongodb': icon('#47A248', 'Mongo', 12),
  'icon-spring': icon('#6DB33F', 'Spring', 13),
  'icon-mybatis': icon('#B31B1B', 'MB', 20),
  'icon-netty': icon('#2C3E50', 'Netty', 14),
  'icon-network': icon('#1A73E8', 'Net', 16),
  'icon-os': icon('#0078D6', 'OS', 20),
  'icon-algorithm': icon('#9B59B6', 'Algo', 14),
  'icon-design': icon('#E91E63', 'DP', 20),
  'icon-mq': icon('#FF6B35', 'MQ', 20),
  'icon-rabbitmq': icon('#FF6600', 'RMQ', 14),
  'icon-kafka': icon('#231F20', 'Kafka', 13),
  'icon-nginx': icon('#009639', 'Nginx', 13),
  'icon-docker': icon('#2496ED', 'Docker', 12),
  'icon-git': icon('#F05032', 'Git', 18),
  'icon-linux': icon('#E95420', 'Linux', 12),
  'icon-system': icon('#2D3748', 'Sys', 18),
  'icon-scenario': icon('#D53F8C', 'Sce', 17),
  'icon-dubbo': icon('#FF6A00', 'Dubbo', 12),
  'icon-es': icon('#00BFB3', 'ES', 20),
  'icon-devops': icon('#2496ED', 'DevOps', 11),
  'icon-hr': icon('#7C3AED', 'HR', 20),
}

export function getCategoryIcon(iconKey: string | undefined, size = 40): React.ReactNode {
  if (iconKey && icons[iconKey]) {
    const node = icons[iconKey] as React.ReactElement
    return React.cloneElement(node, { width: size, height: size } as React.SVGAttributes<SVGSVGElement>)
  }
  return (
    <svg viewBox="0 0 64 64" fill="none" width={size} height={size}>
      <rect width="64" height="64" rx="12" fill="#2563EB" />
      <text x="32" y="42" textAnchor="middle" fill="white" fontSize="20" fontWeight="bold" fontFamily="'Inter', Arial, sans-serif">?</text>
    </svg>
  )
}
