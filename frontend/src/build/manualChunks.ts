export function manualChunks(id: string): string | undefined {
  const normalizedId = id.replace(/\\/g, '/')

  if (!normalizedId.includes('/node_modules/')) {
    return undefined
  }

  if (isReactRuntime(normalizedId)) {
    return 'react-vendor'
  }

  if (isAntDesignRuntime(normalizedId)) {
    return undefined
  }

  if (isMarkdownRuntime(normalizedId)) {
    return 'markdown-vendor'
  }

  if (isRouterRuntime(normalizedId)) {
    return 'router-vendor'
  }

  if (normalizedId.includes('/node_modules/axios/')) {
    return 'http-vendor'
  }

  return 'vendor'
}

function isReactRuntime(id: string) {
  return id.includes('/node_modules/react/')
    || id.includes('/node_modules/react-dom/')
    || id.includes('/node_modules/scheduler/')
}

function isAntDesignRuntime(id: string) {
  return id.includes('/node_modules/antd/')
    || id.includes('/node_modules/@ant-design/')
    || id.includes('/node_modules/rc-')
    || id.includes('/node_modules/@rc-component/')
}

function isMarkdownRuntime(id: string) {
  return id.includes('/node_modules/react-markdown/')
    || id.includes('/node_modules/remark-')
    || id.includes('/node_modules/rehype-')
    || id.includes('/node_modules/retext-')
    || id.includes('/node_modules/unified/')
    || id.includes('/node_modules/vfile')
    || id.includes('/node_modules/micromark')
    || id.includes('/node_modules/mdast-')
    || id.includes('/node_modules/hast-')
    || id.includes('/node_modules/unist-')
    || id.includes('/node_modules/lowlight/')
    || id.includes('/node_modules/highlight.js/')
    || id.includes('/node_modules/@uiw/')
    || id.includes('/node_modules/@codemirror/')
}

function isRouterRuntime(id: string) {
  return id.includes('/node_modules/react-router/')
    || id.includes('/node_modules/react-router-dom/')
    || id.includes('/node_modules/@remix-run/')
}
