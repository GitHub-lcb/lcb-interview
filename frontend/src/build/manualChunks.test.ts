import { describe, expect, it } from 'vitest'
import { manualChunks } from './manualChunks'

describe('manualChunks', () => {
  it('keeps React runtime in a stable vendor chunk', () => {
    expect(manualChunks('E:/app/node_modules/react/index.js')).toBe('react-vendor')
    expect(manualChunks('E:/app/node_modules/react-dom/client.js')).toBe('react-vendor')
  })

  it('lets Rollup keep Ant Design ecosystem modules with their route graph', () => {
    expect(manualChunks('E:/app/node_modules/antd/es/button/index.js')).toBeUndefined()
    expect(manualChunks('E:/app/node_modules/@ant-design/icons/es/icons/SaveOutlined.js')).toBeUndefined()
    expect(manualChunks('E:/app/node_modules/rc-table/es/Table.js')).toBeUndefined()
  })

  it('isolates markdown and editor dependencies from route code', () => {
    expect(manualChunks('E:/app/node_modules/react-markdown/index.js')).toBe('markdown-vendor')
    expect(manualChunks('E:\\app\\node_modules\\@uiw\\react-md-editor\\esm\\index.js')).toBe('markdown-vendor')
    expect(manualChunks('E:/app/node_modules/@codemirror/view/dist/index.js')).toBe('markdown-vendor')
  })

  it('groups other shared runtime libraries without touching app modules', () => {
    expect(manualChunks('E:/app/node_modules/react-router-dom/dist/index.js')).toBe('router-vendor')
    expect(manualChunks('E:/app/node_modules/axios/index.js')).toBe('http-vendor')
    expect(manualChunks('E:/app/node_modules/dayjs/dayjs.min.js')).toBe('vendor')
    expect(manualChunks('E:/app/src/pages/Home/index.tsx')).toBeUndefined()
  })
})
