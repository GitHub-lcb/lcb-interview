/**
 * ai-generate-answers.js
 *
 * AI 答案生成辅助工具。
 * 读取 data/{slug}.json 中的题目，为每道题生成带结构化答案的 UPDATE SQL。
 *
 * 用法:
 *   1. 指定分类: node ai-generate-answers.js java-basics
 *   2. 处理所有:  node ai-generate-answers.js --all
 *
 * 工作流:
 *   1. 从 data/{slug}.json 读取题目
 *   2. AI 逐题生成答案（调用 LLM 或由 AI 助手填充）
 *   3. 输出 UPDATE SQL 到 sql/ai-update-answers.sql
 *
 * 注: 当前脚本提供一个框架，实际答案生成由 AI 完成。
 *     运行前请确保已执行 fetch-questions.js 生成了 data 文件。
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, 'data');
const SQL_DIR = path.join(__dirname, 'sql');
const OUTPUT_FILE = path.join(SQL_DIR, 'ai-update-answers.sql');

const ALL_SLUGS = [
  'java-basics', 'java-collections', 'java-concurrency', 'jvm',
  'mysql', 'redis', 'mongodb', 'spring', 'spring-boot', 'spring-cloud',
  'mybatis', 'netty', 'computer-network', 'os',
  'algorithm-data-structure', 'design-patterns',
  'message-queue', 'rabbitmq', 'kafka', 'nginx',
  'docker-k8s', 'git', 'linux',
  'system-design', 'backend-scenario',
  'dubbo', 'elasticsearch', 'devops', 'hr',
  'go', 'python', 'c-plus-plus', 'c-sharp', 'php',
  'javascript', 'typescript', 'vue', 'react',
  'frontend-handwrite', 'frontend-code-analysis', 'frontend-engineering',
  'ai-llm', 'ai-project',
  'system-ops', 'it-ops', 'openclaw',
];

function escapeSql(val) {
  if (val === null || val === undefined) return 'NULL';
  return `'${String(val).replace(/'/g, "''").replace(/\\/g, '\\\\')}'`;
}

function loadQuestions(slug) {
  const filePath = path.join(DATA_DIR, `${slug}.json`);
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    return null;
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function generateUpdateSQL(catName, question, index, total) {
  const lines = [
    `-- =============================================`,
    `-- ${catName} — 第 ${index}/${total} 题`,
    `-- 题目: ${question.title}`,
    `-- 来源: ${question.sourceUrl}`,
    `-- =============================================`,
    `UPDATE question SET`,
    `  summary = ${escapeSql(question.summary || '')},`,
    `  content = ${escapeSql(question.content || '')},`,
    `  principle = ${escapeSql(question.principle || null)},`,
    `  comparison = ${escapeSql(question.comparison || null)},`,
    `  scenario = ${escapeSql(question.scenario || null)},`,
    `  risk = ${escapeSql(question.risk || null)},`,
    `  project_exp = ${escapeSql(question.projectExp || null)},`,
    `  code_examples = ${escapeSql(question.codeExamples || null)}`,
    `WHERE id = (SELECT id FROM question WHERE title = ${escapeSql(question.title)} AND category_id = (SELECT id FROM category WHERE name = ${escapeSql(catName)}) LIMIT 1);`,
    ``,
  ];
  return lines.join('\n');
}

function processCategory(slug) {
  const data = loadQuestions(slug);
  if (!data) return '';

  const { categoryName, questions } = data;
  console.log(`\n=== ${categoryName} (${questions.length} questions) ===`);

  const sqlLines = [
    `-- =============================================`,
    `-- ${categoryName} — ${questions.length} 道题答案更新`,
    `-- =============================================`,
    ``,
  ];

  for (let i = 0; i < questions.length; i++) {
    sqlLines.push(generateUpdateSQL(categoryName, questions[i], i + 1, questions.length));
  }

  return sqlLines.join('\n');
}

function main() {
  const args = process.argv.slice(2);
  const isAll = args.includes('--all');
  const specificSlugs = args.filter(a => !a.startsWith('--'));

  let slugs = [];
  if (isAll) {
    slugs = ALL_SLUGS;
  } else if (specificSlugs.length > 0) {
    slugs = specificSlugs;
  } else {
    console.log('用法:');
    console.log('  node ai-generate-answers.js <slug> [slug2 ...]');
    console.log('  node ai-generate-answers.js --all');
    console.log('\n可用分类:');
    ALL_SLUGS.forEach(s => {
      const data = loadQuestions(s);
      if (data) console.log(`  ${s} — ${data.categoryName} (${data.totalQuestions} 题)`);
    });
    return;
  }

  const allOutput = [
    `-- =============================================`,
    `-- AI 生成答案 — UPDATE SQL`,
    `-- 生成时间: ${new Date().toISOString()}`,
    `-- =============================================`,
    ``,
  ];

  for (const slug of slugs) {
    if (!ALL_SLUGS.includes(slug)) {
      console.warn(`Unknown slug: ${slug}, skipping`);
      continue;
    }
    const sql = processCategory(slug);
    allOutput.push(sql);

    const data = loadQuestions(slug);
    if (data) {
      console.log(`  Generated update SQL for ${data.questions.length} questions`);
    }
  }

  fs.writeFileSync(OUTPUT_FILE, allOutput.join('\n'), 'utf-8');
  console.log(`\n=== Done! Output: ${OUTPUT_FILE} ===`);
}

main();
