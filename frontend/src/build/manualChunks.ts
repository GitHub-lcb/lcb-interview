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

  // mermaid 体积较大（含众多图表渲染依赖），单独分包并配合懒加载避免拖慢首屏。
  if (normalizedId.includes('/node_modules/mermaid/')
      || normalizedId.includes('/node_modules/cytoscape/')
      || normalizedId.includes('/node_modules/d3/')
      || normalizedId.includes('/node_modules/dagre/')
      || normalizedId.includes('/node_modules/elkjs/')
      || normalizedId.includes('/node_modules/khroma/')
      || normalizedId.includes('/node_modules/lodash-es/')
      || normalizedId.includes('/node_modules/d3-array/')) {
    return 'diagram-vendor'
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
