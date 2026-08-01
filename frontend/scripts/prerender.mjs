#!/usr/bin/env node
/**
 * SEO 预渲染生成器（build 后执行）：
 * 把题库数据渲染成纯静态 HTML，供搜索引擎爬虫直接索引。
 * - 首页 /                     → dist/prerender/index.html
 * - 分类页 /bank/{id}/         → dist/prerender/bank/{id}/index.html
 * - 题目详情 /question/{id}/   → dist/prerender/question/{id}/index.html
 * - sitemap.xml + robots.txt
 *
 * 用法：node scripts/prerender.mjs [--base http://106.12.166.113] [--out dist/prerender]
 * 说明：列表接口已返回题目完整字段，遍历分页即可一次拿全库，无需逐个请求详情。
 */

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const args = process.argv.slice(2)
const pick = (name, fallback) => {
  const idx = args.indexOf(name)
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : fallback
}
const BASE = pick('--base', 'http://106.12.166.113').replace(/\/$/, '')
const OUT = path.resolve(pick('--out', 'dist/prerender'))
const PAGE_SIZE = 100
const REQUEST_TIMEOUT = 30000

const difficultyLabel = { EASY: '简单', MEDIUM: '中等', HARD: '困难' }

function escapeHtml(text) {
  return String(text ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

/** 极简 markdown → HTML：标题/代码块/列表/粗斜体/行内代码/链接/表格降级为文本。 */
function mdToHtml(md) {
  const lines = String(md ?? '').split('\n')
  const out = []
  let inCode = false
  let codeBuf = []
  let inList = false
  for (let line of lines) {
    const codeMatch = line.match(/^```(\w*)/)
    if (codeMatch) {
      if (inCode) {
        out.push(`<pre><code>${escapeHtml(codeBuf.join('\n'))}</code></pre>`)
        codeBuf = []
        inCode = false
      } else {
        inCode = true
      }
      continue
    }
    if (inCode) {
      codeBuf.push(line)
      continue
    }
    const h = line.match(/^(#{1,4})\s+(.*)$/)
    if (h) {
      if (inList) { out.push('</ul>'); inList = false }
      const level = Math.min(h[1].length + 1, 4)
      out.push(`<h${level}>${inlineHtml(h[2])}</h${level}>`)
      continue
    }
    if (/^\s*[-*+]\s+/.test(line)) {
      if (!inList) { out.push('<ul>'); inList = true }
      out.push(`<li>${inlineHtml(line.replace(/^\s*[-*+]\s+/, ''))}</li>`)
      continue
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      if (!inList) { out.push('<ol>'); inList = true }
      out.push(`<li>${inlineHtml(line.replace(/^\s*\d+\.\s+/, ''))}</li>`)
      continue
    }
    if (inList) { out.push('</ul>'); inList = false }
    if (!line.trim()) {
      out.push('')
    } else {
      out.push(`<p>${inlineHtml(line)}</p>`)
    }
  }
  if (inCode) { out.push(`<pre><code>${escapeHtml(codeBuf.join('\n'))}</code></pre>`) }
  if (inList) { out.push('</ul>') }
  return out.join('\n')
}

function inlineHtml(text) {
  let s = escapeHtml(text)
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>')
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>')
  return s
}

async function fetchJson(url) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT)
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'LCB-Prerender/1.0' } })
    if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`)
    return await res.json()
  } finally {
    clearTimeout(timer)
  }
}

const pageShell = (title, description, bodyHtml, canonical, extraLd = '') => `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description.slice(0, 160))}">
<meta name="robots" content="index,follow">
<link rel="canonical" href="${canonical}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="LCB Interview">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description.slice(0, 200))}">
<meta property="og:url" content="${canonical}">
<meta property="og:locale" content="zh_CN">
${extraLd ? `<script type="application/ld+json">${extraLd}</script>` : ''}
<style>
  body{margin:0;background:#EEF1F4;color:#1A1E23;font-family:"HarmonyOS Sans SC","PingFang SC","Microsoft YaHei",sans-serif;line-height:1.8}
  .wrap{max-width:860px;margin:0 auto;padding:28px 20px 60px}
  a{color:#0F8A8F;text-decoration:none}
  .crumb{font-size:13px;color:#586069;margin-bottom:18px}
  h1{font-size:26px;line-height:1.5;margin:0 0 10px}
  .meta{font-size:13px;color:#586069;margin-bottom:22px;display:flex;gap:14px;flex-wrap:wrap}
  .meta span{border:1px solid #D3D9DF;border-radius:999px;padding:2px 10px;background:#fff}
  .card{background:#fff;border:1px solid #D3D9DF;border-radius:12px;padding:22px 26px}
  .card h2,.card h3,.card h4{line-height:1.4;margin:22px 0 10px}
  .card pre{background:#F4F7F8;border:1px solid #E4E9ED;border-radius:8px;padding:14px;overflow-x:auto;font-size:13px}
  .card code{background:#E7F3EC;border-radius:4px;padding:1px 5px;font-size:13px}
  .card pre code{background:none;padding:0}
  .card ul,.card ol{padding-left:22px}
  .card p{margin:10px 0}
  .list-item{background:#fff;border:1px solid #D3D9DF;border-radius:10px;padding:12px 16px;margin-bottom:10px}
  .list-item h3{margin:0 0 4px;font-size:16px}
  .list-item p{margin:0;font-size:13px;color:#586069}
  .footer{margin-top:34px;font-size:12px;color:#586069;text-align:center}
</style>
</head>
<body>
<div class="wrap">
${bodyHtml}
<div class="footer">LCB Interview · Java 面试题库与备考训练系统 · <a href="/">返回首页</a></div>
</div>
</body>
</html>`

async function main() {
  console.log(`[prerender] base=${BASE} out=${OUT}`)

  const catRes = await fetchJson(`${BASE}/api/categories`)
  const categories = catRes.data ?? []
  console.log(`[prerender] categories=${categories.length}`)

  // 遍历分页一次拿全库（列表接口含完整 content 字段）
  const allQuestions = []
  let page = 0
  let total = Infinity
  while (page * PAGE_SIZE < total) {
    const res = await fetchJson(`${BASE}/api/questions?page=${page}&size=${PAGE_SIZE}`)
    const data = res.data ?? {}
    const content = data.content ?? []
    allQuestions.push(...content)
    total = Number(data.total ?? allQuestions.length)
    page++
    console.log(`[prerender] fetched page ${page - 1}, total=${allQuestions.length}/${total}`)
    if (content.length === 0) break
  }
  console.log(`[prerender] questions loaded=${allQuestions.length}`)

  fs.rmSync(OUT, { recursive: true, force: true })

  // ---------- 首页 ----------
  const homeBody = `
<h1>LCB Interview · Java 面试题库与备考训练系统</h1>
<p>覆盖 <strong>${categories.length} 个技术方向</strong>、<strong>${total} 道结构化面试题</strong>，含 30 秒口述版、标准答案、面试官评分点、高频追问与代码示例。免费刷题，无需登录。</p>
<h2>技术方向（${categories.length} 个学习模块）</h2>
<div>
${categories.map(c => `<a class="list-item" style="display:block" href="/bank/${c.id}/"><h3>${escapeHtml(c.name)}</h3><p>${escapeHtml(c.description)}</p></a>`).join('\n')}
</div>`
  fs.mkdirSync(OUT, { recursive: true })
  fs.writeFileSync(path.join(OUT, 'index.html'), pageShell(
    'LCB Interview - Java 面试题库与备考训练系统',
    `覆盖 ${categories.length} 个技术方向、${total} 道结构化 Java 面试题与深度解析，免费刷题，无需登录。`,
    homeBody,
    `${BASE}/`,
  ), 'utf8')

  // ---------- 分类页 ----------
  const byCategory = new Map()
  for (const q of allQuestions) {
    if (!byCategory.has(q.categoryId)) byCategory.set(q.categoryId, [])
    byCategory.get(q.categoryId).push(q)
  }
  for (const cat of categories) {
    const questions = (byCategory.get(cat.id) ?? []).slice(0, 20)
    const body = `
<p class="crumb"><a href="/">首页</a> › ${escapeHtml(cat.name)}</p>
<h1>${escapeHtml(cat.name)}面试题</h1>
<p>${escapeHtml(cat.description)}</p>
<h2>热门题目（前 ${questions.length} 题）</h2>
<div>
${questions.map(q => `<a class="list-item" style="display:block" href="/question/${q.id}/"><h3>${escapeHtml(q.title)}</h3><p>${escapeHtml((q.summary || '').slice(0, 80))}</p></a>`).join('\n')}
</div>
<p><a href="/bank/${cat.id}">打开完整题库（SPA 交互版）</a></p>`
    fs.mkdirSync(path.join(OUT, 'bank', String(cat.id)), { recursive: true })
    fs.writeFileSync(path.join(OUT, 'bank', String(cat.id), 'index.html'), pageShell(
      `${cat.name}面试题 - LCB Interview`,
      `${cat.description}，共 ${(byCategory.get(cat.id) ?? []).length} 道题。`,
      body,
      `${BASE}/bank/${cat.id}/`,
    ), 'utf8')
  }
  console.log(`[prerender] bank pages=${categories.length}`)

  // ---------- 题目详情页 ----------
  const escapeJsonLd = s => String(s ?? '').replaceAll('\\', '\\\\').replaceAll('"', '\\"')
  let written = 0
  const batchSize = 100
  for (let i = 0; i < allQuestions.length; i += batchSize) {
    const batch = allQuestions.slice(i, i + batchSize)
    await Promise.all(batch.map(async q => {
      const contentHtml = mdToHtml(q.content || q.answer || '暂无答案')
      const tags = [...(q.tags || []), q.categoryName, '面试题'].filter(Boolean).join('，')
      const ld = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'QAPage',
        mainEntity: {
          '@type': 'Question',
          name: q.title,
          text: q.summary || q.title,
          answerCount: 1,
          author: { '@type': 'Organization', name: 'LCB Interview' },
          acceptedAnswer: {
            '@type': 'Answer',
            text: (q.summary || '') + '\n' + (q.content || q.answer || ''),
            upvoteCount: q.viewCount || 0,
          },
        },
      })
      const body = `
<p class="crumb"><a href="/">首页</a> › <a href="/bank/${q.categoryId}/">${escapeHtml(q.categoryName)}</a> › ${escapeHtml(q.title)}</p>
<h1>${escapeHtml(q.title)}</h1>
<div class="meta">
<span>难度：${escapeHtml(difficultyLabel[q.difficulty] || q.difficulty)}</span>
<span>分类：${escapeHtml(q.categoryName)}</span>
${(q.tags || []).slice(0, 4).map(t => `<span>${escapeHtml(t)}</span>`).join('')}
</div>
<div class="card">
${contentHtml}
</div>`
      const dir = path.join(OUT, 'question', String(q.id))
      fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(path.join(dir, 'index.html'), pageShell(
        `${q.title} - LCB Interview`,
        q.summary || q.title,
        body,
        `${BASE}/question/${q.id}/`,
        ld,
      ), 'utf8')
      written++
    }))
    console.log(`[prerender] question pages=${written}/${allQuestions.length}`)
  }

  // ---------- sitemap.xml + robots.txt ----------
  const now = new Date().toISOString().slice(0, 10)
  const urls = [
    { loc: `${BASE}/`, priority: '1.0' },
    ...categories.map(c => ({ loc: `${BASE}/bank/${c.id}/`, priority: '0.8' })),
    ...allQuestions.map(q => ({ loc: `${BASE}/question/${q.id}/`, priority: '0.6' })),
  ]
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${u.loc}</loc><lastmod>${now}</lastmod><priority>${u.priority}</priority></url>`).join('\n')}
</urlset>`
  fs.writeFileSync(path.join(OUT, 'sitemap.xml'), sitemap, 'utf8')
  fs.writeFileSync(path.join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${BASE}/sitemap.xml\n`, 'utf8')

  console.log(`[prerender] done: urls=${urls.length}, sitemap written`)
}

main().catch(err => {
  console.error('[prerender] FAILED:', err)
  process.exit(1)
})
