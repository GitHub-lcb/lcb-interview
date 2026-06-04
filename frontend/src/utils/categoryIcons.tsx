import React from 'react'

const ICON_PATHS: Record<string, string> = {
  'icon-java': '/icons/java-basics.png',
  'icon-java-collection': '/icons/java-collections.png',
  'icon-java-concurrency': '/icons/java-concurrency.png',
  'icon-jvm': '/icons/jvm.png',
  'icon-mysql': '/icons/mysql.png',
  'icon-redis': '/icons/redis.png',
  'icon-mongodb': '/icons/mongodb.png',
  'icon-spring': '/icons/spring.png',
  'icon-springboot': '/icons/spring-boot.png',
  'icon-springcloud': '/icons/spring-cloud.png',
  'icon-mybatis': '/icons/mybatis.png',
  'icon-netty': '/icons/netty.png',
  'icon-network': '/icons/computer-network.png',
  'icon-os': '/icons/os.png',
  'icon-algorithm': '/icons/algorithm-data-structure.png',
  'icon-design': '/icons/design-patterns.png',
  'icon-mq': '/icons/message-queue.png',
  'icon-rabbitmq': '/icons/rabbitmq.png',
  'icon-kafka': '/icons/kafka.png',
  'icon-nginx': '/icons/nginx.png',
  'icon-docker': '/icons/docker-k8s.png',
  'icon-git': '/icons/git.png',
  'icon-linux': '/icons/linux.png',
  'icon-system': '/icons/system-design.png',
  'icon-scenario': '/icons/backend-scenario.png',
  'icon-dubbo': '/icons/dubbo.png',
  'icon-es': '/icons/elasticsearch.png',
  'icon-devops': '/icons/devops.png',
  'icon-hr': '/icons/hr.png',
  'icon-go': '/icons/go.png',
  'icon-python': '/icons/python.png',
  'icon-cpp': '/icons/c-plus-plus.png',
  'icon-csharp': '/icons/c-sharp.png',
  'icon-php': '/icons/php.png',
  'icon-javascript': '/icons/javascript.png',
  'icon-typescript': '/icons/typescript.png',
  'icon-vue': '/icons/vue.png',
  'icon-react': '/icons/react.png',
  'icon-frontend-handwrite': '/icons/frontend-handwrite.png',
  'icon-frontend-code-analysis': '/icons/frontend-code-analysis.png',
  'icon-frontend-engineering': '/icons/frontend-engineering.png',
  'icon-ai-llm': '/icons/ai-llm.jpeg',
  'icon-ai-project': '/icons/ai-project.png',
  'icon-system-ops': '/icons/system-ops.png',
  'icon-it-ops': '/icons/it-ops.png',
  'icon-openclaw': '/icons/openclaw.png',
}

const FALLBACK_COLORS: Record<string, string> = {
  'icon-java': '#E76F00', 'icon-java-collection': '#E76F00', 'icon-java-concurrency': '#E76F00',
  'icon-jvm': '#F89820', 'icon-mysql': '#4479A1', 'icon-redis': '#DC382D',
  'icon-mongodb': '#47A248', 'icon-spring': '#6DB33F', 'icon-springboot': '#6DB33F',
  'icon-springcloud': '#6DB33F', 'icon-mybatis': '#B31B1B', 'icon-netty': '#2C3E50',
  'icon-network': '#1A73E8', 'icon-os': '#0078D6', 'icon-algorithm': '#9B59B6',
  'icon-design': '#E91E63', 'icon-mq': '#FF6B35', 'icon-rabbitmq': '#FF6600',
  'icon-kafka': '#231F20', 'icon-nginx': '#009639', 'icon-docker': '#2496ED',
  'icon-git': '#F05032', 'icon-linux': '#E95420', 'icon-system': '#2D3748',
  'icon-scenario': '#D53F8C', 'icon-dubbo': '#FF6A00', 'icon-es': '#00BFB3',
  'icon-devops': '#2496ED', 'icon-hr': '#7C3AED',
  'icon-go': '#00ADD8', 'icon-python': '#3776AB', 'icon-cpp': '#00599C',
  'icon-csharp': '#239120', 'icon-php': '#777BB4', 'icon-javascript': '#F7DF1E',
  'icon-typescript': '#3178C6', 'icon-vue': '#4FC08D', 'icon-react': '#61DAFB',
  'icon-frontend-handwrite': '#FF6B6B', 'icon-frontend-code-analysis': '#845EC2',
  'icon-frontend-engineering': '#FFC75F', 'icon-ai-llm': '#00C9A7', 'icon-ai-project': '#FF9671',
  'icon-system-ops': '#4B4453', 'icon-it-ops': '#B0A8B9', 'icon-openclaw': '#FF6F00',
}

const FALLBACK_LABELS: Record<string, [string, number]> = {
  'icon-java': ['J', 22], 'icon-java-collection': ['JC', 16], 'icon-java-concurrency': ['JUC', 14],
  'icon-jvm': ['JVM', 13], 'icon-mysql': ['SQL', 18], 'icon-redis': ['Redis', 14],
  'icon-mongodb': ['Mongo', 12], 'icon-spring': ['Spring', 13], 'icon-springboot': ['SB', 18],
  'icon-springcloud': ['SC', 16], 'icon-mybatis': ['MB', 20], 'icon-netty': ['Netty', 14],
  'icon-network': ['Net', 16], 'icon-os': ['OS', 20], 'icon-algorithm': ['Algo', 14],
  'icon-design': ['DP', 20], 'icon-mq': ['MQ', 20], 'icon-rabbitmq': ['RMQ', 14],
  'icon-kafka': ['Kafka', 13], 'icon-nginx': ['Nginx', 13], 'icon-docker': ['Docker', 12],
  'icon-git': ['Git', 18], 'icon-linux': ['Linux', 12], 'icon-system': ['Sys', 18],
  'icon-scenario': ['Sce', 17], 'icon-dubbo': ['Dubbo', 12], 'icon-es': ['ES', 20],
  'icon-devops': ['DevOps', 11], 'icon-hr': ['HR', 20],
  'icon-go': ['Go', 20], 'icon-python': ['Py', 16], 'icon-cpp': ['C++', 14],
  'icon-csharp': ['C#', 18], 'icon-php': ['PHP', 14], 'icon-javascript': ['JS', 18],
  'icon-typescript': ['TS', 18], 'icon-vue': ['Vue', 16], 'icon-react': ['React', 14],
  'icon-frontend-handwrite': ['HW', 16], 'icon-frontend-code-analysis': ['CA', 14],
  'icon-frontend-engineering': ['FE', 16], 'icon-ai-llm': ['AI', 20],
  'icon-ai-project': ['AIP', 14], 'icon-system-ops': ['Ops', 14],
  'icon-it-ops': ['IT', 18], 'icon-openclaw': ['OC', 16],
}

export function getCategoryIcon(iconKey: string | undefined, size = 40): React.ReactNode {
  if (!iconKey) {
    return fallbackSvg('#2563EB', '?', 20, size)
  }

  const pngPath = iconKey.startsWith('/icons/') ? iconKey : ICON_PATHS[iconKey]
  if (pngPath) {
    return (
      <img
        src={pngPath}
        alt=""
        width={size}
        height={size}
        style={{ borderRadius: 12, objectFit: 'contain', background: '#f5f5f5' }}
        onError={(e) => {
          const target = e.currentTarget
          target.style.display = 'none'
        }}
      />
    )
  }

  const color = FALLBACK_COLORS[iconKey] || '#2563EB'
  const [label, fontSize] = FALLBACK_LABELS[iconKey] || ['?', 20]
  return fallbackSvg(color, label, fontSize, size)
}

function fallbackSvg(fill: string, label: string, fontSize: number, size: number) {
  return (
    <svg viewBox="0 0 64 64" fill="none" width={size} height={size}>
      <rect width="64" height="64" rx="12" fill={fill} opacity="0.9" />
      <text x="32" y="42" textAnchor="middle" fill="white" fontSize={fontSize} fontWeight="bold" fontFamily="'Inter', Arial, sans-serif">{label}</text>
    </svg>
  )
}
