/**
 * fetch-questions.js
 *
 * 从 mianshiya.com API 抓取各后端分类的面试题目，
 * 生成以下输出：
 *   1. data/{category-slug}.json — 每分类的题目数据（供 AI 阅读并生成答案）
 *   2. sql/insert-draft.sql      — INSERT INTO question DRAFT 语句
 *
 * 用法: node fetch-questions.js
 *
 * 抓取完成后，AI 的工作流程：
 *   1. 读取 data/{slug}.json 中的题目列表
 *   2. 为每题生成结构化答案（summary, principle, comparison 等字段）
 *   3. 输出 UPDATE SQL 并将结果追加到 sql/insert-draft.sql 中
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_BASE = 'https://api.mianshiya.com';
const PAGE_SIZE = 50;
const REQUEST_DELAY = 600;

const DATA_DIR = path.join(__dirname, 'data');
const SQL_DIR = path.join(__dirname, 'sql');

const CATEGORIES = [
  { id: 1,  name: 'Java 基础',        slug: 'java-basics',                 bankId: '1787463103423897602',
    extraBankIds: ['1983888023644901377', '1776477775448772610', '1828639330652094465'] },
  { id: 2,  name: 'Java 集合',        slug: 'java-collections',            bankId: '1788408712975282177' },
  { id: 3,  name: 'Java 并发',        slug: 'java-concurrency',            bankId: '1789249312885223425' },
  { id: 4,  name: 'JVM',              slug: 'jvm',                         bankId: '1789931432793948162' },
  { id: 5,  name: 'MySQL',            slug: 'mysql',                       bankId: '1791003439968264194' },
  { id: 6,  name: 'Redis',            slug: 'redis',                       bankId: '1791375592078610434' },
  { id: 7,  name: 'MongoDB',          slug: 'mongodb',                     bankId: '1837028071614509057' },
  { id: 8,  name: 'Spring',           slug: 'spring',                      bankId: '1790683494127804418' },
  { id: 9,  name: 'SpringBoot',       slug: 'spring-boot',                 bankId: '1797452903309508610' },
  { id: 10, name: 'SpringCloud',      slug: 'spring-cloud',                bankId: '1797453053310402561' },
  { id: 11, name: 'MyBatis',          slug: 'mybatis',                     bankId: '1801424748099739650' },
  { id: 12, name: 'Netty',            slug: 'netty',                       bankId: '1804354610222800897' },
  { id: 13, name: '计算机网络',         slug: 'computer-network',            bankId: '1790948499480616961',
    extraBankIds: ['1812069526632792065', '1812069585160110082', '1812069636204789761', '1812070025851437058', '1811358473925091330'] },
  { id: 14, name: '操作系统',           slug: 'os',                          bankId: '1790684063773007874' },
  { id: 15, name: '算法与数据结构',     slug: 'algorithm-data-structure',    bankId: '1824727406021644290',
    extraBankIds: ['1824727630718898177', '1814979506750275585'] },
  { id: 16, name: '设计模式',          slug: 'design-patterns',             bankId: '1801559627969929217' },
  { id: 17, name: '消息队列',          slug: 'message-queue',               bankId: '1801255316257841153' },
  { id: 18, name: 'RabbitMQ',         slug: 'rabbitmq',                    bankId: '1850081848441466881' },
  { id: 19, name: 'Kafka',            slug: 'kafka',                       bankId: '1837027669393338369' },
  { id: 20, name: 'Nginx',            slug: 'nginx',                       bankId: '1824363422328864769',
    extraBankIds: ['1824363578297618433', '1824363701287194625', '1824363814546620417'] },
  { id: 21, name: 'Docker 与 K8s',    slug: 'docker-k8s',                  bankId: '1812067352871829505',
    extraBankIds: ['1812067408974839809'] },
  { id: 22, name: 'Git',              slug: 'git',                         bankId: '1815649049726590977',
    extraBankIds: ['1815649098609254402', '1815649161437683714', '1815649222576103426', '1815649344208674817'] },
  { id: 23, name: 'Linux',            slug: 'linux',                       bankId: '1812067560819048449' },
  { id: 24, name: '后端系统设计',       slug: 'system-design',               bankId: '1795650093939204097',
    extraBankIds: ['1991433644421414913', '1991433816622759937', '1804410872994144257'] },
  { id: 25, name: '后端场景题',         slug: 'backend-scenario',            bankId: '1795650132375805954',
    extraBankIds: ['1813047072704741378', '1813047122807881729', '1772565012490067970'] },
  { id: 26, name: 'Dubbo',            slug: 'dubbo',                       bankId: '1801127500832907266',
    extraBankIds: ['1831276420742844418', '1831276505543282689', '1831276585243447297'] },
  { id: 27, name: 'Elasticsearch',    slug: 'elasticsearch',               bankId: '1805423815382736897',
    extraBankIds: ['1827358190473416705', '1827358467955986434', '1827358734998933505', '1827358816850776065', '1827358930059235329', '1827359213040537602'] },
  { id: 28, name: 'DevOps',           slug: 'devops',                      bankId: '1811358596541374466' },
  { id: 29, name: 'HR 面试',          slug: 'hr',                          bankId: '1818997293283516418' },
  { id: 30, name: 'Go',               slug: 'go',                          bankId: '1810641215871569922',
    extraBankIds: ['1810641327017295873','1810641428422983682','1810641622782836737','1810641794832322562','1810641870157828097','1810641945379340290','1810642333381820417','1983892313021190145'] },
  { id: 31, name: 'Python',           slug: 'python',                      bankId: '1810643768400019458',
    extraBankIds: ['1810643851299573761','1810644002890973185'] },
  { id: 32, name: 'C++',              slug: 'c-plus-plus',                 bankId: '1810642495797854209',
    extraBankIds: ['1810642593306169346','1810642987101847554','1810643066633375745','1810643546626195457','1810643648765886466','1983888665591517186'] },
  { id: 33, name: 'C#',               slug: 'c-sharp',                     bankId: '1838761134207819778',
    extraBankIds: ['1838761146933338114','1838761163509227522','1838761177052635138','1838761191313268737','1838761213920567298','1838761230756503554','1838761258828980226','1984092061342732290'] },
  { id: 34, name: 'PHP',              slug: 'php',                         bankId: '1833391473610956801',
    extraBankIds: ['1833391596592144385','1833391687243636737','1833391787562999810','1984087789024677889'] },
  { id: 35, name: 'JavaScript',       slug: 'javascript',                  bankId: '1810644471159848962',
    extraBankIds: ['1810644667913785345','1810644716832817154','1991430519371333634'] },
  { id: 36, name: 'TypeScript',       slug: 'typescript',                  bankId: '1810644420521152513' },
  { id: 37, name: 'Vue',              slug: 'vue',                         bankId: '1817900864917000193',
    extraBankIds: ['1817900926871064578','1817900981241827329','1817901056433115138','1817901329041903618','1818115209181564929'] },
  { id: 38, name: 'React',            slug: 'react',                       bankId: '1817900465338241026',
    extraBankIds: ['1817900573026996225','1817900635140444161','1817900696662495234','1817900752874557442','1991432024413437953'] },
  { id: 39, name: '前端手写代码',       slug: 'frontend-handwrite',          bankId: '1820434920244424705' },
  { id: 40, name: '前端代码分析',       slug: 'frontend-code-analysis',      bankId: '1810644905160396801' },
  { id: 41, name: '前端工程化',         slug: 'frontend-engineering',        bankId: '1810644197003362306',
    extraBankIds: ['1810644318667538433','1824748170947006466','1824748303969992706','1831174767836995585','1831174878121283585','1831175125723631618'] },
  { id: 42, name: 'AI 大模型',         slug: 'ai-llm',                      bankId: '1906189461556076546',
    extraBankIds: ['1991427331415080961','1991427562177298434','1991427961462456322','2052284728362414082','2052284728559546369','2052284728718929922','2052284729973026817'] },
  { id: 43, name: 'AI 项目实战',       slug: 'ai-project',                  bankId: '1929747035048828930',
    extraBankIds: ['1802628413930151938','1958777633583927297','2039960248470528002','2039961551066161154','2039962142177812481','2039962686950793217','2039963182063214593'] },
  { id: 44, name: '系统运维',          slug: 'system-ops',                  bankId: '1811358545672855553' },
  { id: 45, name: 'IT 运维',          slug: 'it-ops',                      bankId: '1811358325988474882' },
  { id: 46, name: 'OpenClaw',         slug: 'openclaw',                    bankId: '2031640554575519745' },
];

const TAG_MAP = {
  'Java': 1, '集合': 2, '多线程': 3, 'JVM': 4, '索引': 5, '事务': 6, '缓存': 7,
  'IoC': 8, 'AOP': 9, '分布式': 10, '数据结构': 11, '算法': 12, 'Spring': 13,
  'SpringBoot': 14, 'SpringCloud': 15, '微服务': 16, 'MySQL': 17, 'Redis': 18,
  'MongoDB': 19, 'MyBatis': 20, 'Netty': 21, '网络': 22, 'TCP': 23, 'HTTP': 24,
  '操作系统': 25, '进程': 26, '设计模式': 27, '消息队列': 28, 'Kafka': 29,
  'RabbitMQ': 30, 'Nginx': 31, 'Docker': 32, 'Kubernetes': 33, 'Git': 34,
  'Linux': 35, '系统设计': 36, '高并发': 37, 'Dubbo': 38, 'Elasticsearch': 39,
  'CI/CD': 40, 'Go': 51, 'Python': 52, 'C++': 53, 'C#': 54, 'PHP': 55,
  'JavaScript': 56, 'TypeScript': 57, 'Vue': 58, 'React': 59, 'Node.js': 60,
  'Webpack': 61, 'CSS': 62, 'HTML': 63, 'AI': 64, '大模型': 65, 'LLM': 66,
  'RAG': 67, 'Agent': 68, 'Prompt': 69, 'LangChain': 70, 'OpenClaw': 71,
  '运维': 72, '监控': 73, '锁': 43, '线程池': 44, '垃圾回收': 45, '内存模型': 46,
  '分库分表': 47, 'RPC': 48, 'REST': 49, '安全': 50,
};

function mapDifficulty(d) {
  if (d === 1) return 'EASY';
  if (d === 3) return 'MEDIUM';
  if (d === 5) return 'HARD';
  return 'MEDIUM';
}

function mapTags(tagList) {
  const ids = [];
  for (const t of (tagList || [])) {
    if (TAG_MAP[t] !== undefined) {
      ids.push(TAG_MAP[t]);
    }
  }
  return [...new Set(ids)];
}

function escapeSql(val) {
  if (val === null || val === undefined) return 'NULL';
  return `'${String(val).replace(/'/g, "''").replace(/\\/g, '\\\\')}'`;
}

async function postJSON(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }
  return res.json();
}

async function fetchBank(bankId, label) {
  const allRecords = [];
  let current = 1;
  let totalPages = 1;

  while (current <= totalPages) {
    const data = await postJSON('/api/question_bank/list_question', {
      questionBankId: bankId,
      current,
      pageSize: PAGE_SIZE,
    });

    if (data.code !== 0) {
      console.error(`  API error: ${data.message}`);
      break;
    }

    const page = data.data;
    totalPages = Math.ceil(page.total / PAGE_SIZE);
    allRecords.push(...page.records);
    console.log(`  ${label} Page ${current}/${totalPages} (${page.records.length} records, total: ${page.total})`);

    current++;
    if (current <= totalPages) {
      await new Promise(r => setTimeout(r, REQUEST_DELAY));
    }
  }

  return allRecords;
}

function formatQuestions(cat, records) {
  return records.map((r, idx) => ({
    title: r.title,
    difficulty: mapDifficulty(r.difficulty),
    tags: r.tagList || [],
    tagIds: mapTags(r.tagList),
    sourceUrl: `https://www.mianshiya.com/question/${r.id}`,
    sourceId: r.id,
    viewNum: r.viewNum,
    needVip: r.needVip === 1,
    hasAnswer: r.hasAnswer,
  }));
}

function generateInsertSQL(cat, questions, startId = 1) {
  const lines = [
    `-- =============================================`,
    `-- ${cat.name} — ${questions.length} 道题目（DRAFT）`,
    `-- 生成时间: ${new Date().toISOString()}`,
    `-- =============================================`,
    `INSERT INTO question (category_id, title, summary, content, difficulty, status, source, create_time, update_time) VALUES`,
  ];

  const valueLines = questions.map((q, idx) => {
    return `(${cat.id}, ${escapeSql(q.title)}, NULL, '', ${escapeSql(q.difficulty)}, 'DRAFT', 'AI_GENERATED', NOW(), NOW())`;
  });

  lines.push(valueLines.join(',\n') + ';');
  lines.push('');

  // Generate question_tag associations
  const tagLines = [];
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const qId = startId + i;
    for (const tagId of q.tagIds) {
      tagLines.push(`(${qId}, ${tagId})`);
    }
  }

  if (tagLines.length > 0) {
    lines.push(`-- 题目-标签关联`);
    lines.push(`INSERT INTO question_tag (question_id, tag_id) VALUES`);
    lines.push(tagLines.join(',\n') + ';');
  }

  return lines.join('\n');
}

async function main() {
  console.log('=== lcb-interview: 从 mianshiya.com 抓取全部面试题目（含子题库）===\n');

  let totalQuestions = 0;
  const allInsertSQL = [
    'SET NAMES utf8mb4;',
    '',
    '-- =============================================',
    '-- DRAFT 题目插入 SQL（全量：含所有子题库）',
    `-- 生成时间: ${new Date().toISOString()}`,
    '-- 共 ' + CATEGORIES.length + ' 个分类',
    '-- =============================================',
    '',
  ];

  for (const cat of CATEGORIES) {
    try {
      const bankIds = [cat.bankId, ...(cat.extraBankIds || [])];
      const nameMap = { [cat.bankId]: cat.name };
      if (cat.extraBankIds) {
        cat.extraBankIds.forEach((id, i) => { nameMap[id] = `${cat.name} 子题库${i + 1}`; });
      }

      // Fetch all banks for this category
      let allRecords = [];
      for (const bid of bankIds) {
        console.log(`\n=== ${cat.name} (bank: ${bid}) ===`);
        const records = await fetchBank(bid, nameMap[bid]);
        allRecords.push(...records);
      }

      // Deduplicate by source ID
      const seen = new Set();
      const deduped = [];
      for (const r of allRecords) {
        if (!seen.has(r.id)) {
          seen.add(r.id);
          deduped.push(r);
        }
      }

      const questions = formatQuestions(cat, deduped);
      const dedupCount = allRecords.length - deduped.length;
      console.log(`  => 原始 ${allRecords.length} 条，去重 ${dedupCount} 条，有效 ${questions.length} 题`);

      // Save JSON data file
      const jsonPath = path.join(DATA_DIR, `${cat.slug}.json`);
      const jsonData = {
        categoryId: cat.id,
        categoryName: cat.name,
        bankIds,
        totalQuestions: questions.length,
        questions,
      };
      fs.writeFileSync(jsonPath, JSON.stringify(jsonData, null, 2), 'utf-8');
      console.log(`  => Saved ${cat.slug}.json (${questions.length} questions)`);

      // Generate INSERT SQL with correct starting ID
      const sqlBlock = generateInsertSQL(cat, questions, totalQuestions + 1);
      allInsertSQL.push(sqlBlock);

      totalQuestions += questions.length;
    } catch (err) {
      console.error(`  ERROR: ${err.message}`);
    }
  }

  // Write combined SQL
  allInsertSQL.push(`-- 共 ${totalQuestions} 道题目`);
  const sqlPath = path.join(SQL_DIR, 'insert-draft.sql');
  fs.writeFileSync(sqlPath, allInsertSQL.join('\n'), 'utf-8');
  console.log(`\n=== 完成! 共 ${totalQuestions} 道题目 ===`);
  console.log(`JSON 数据文件: ${DATA_DIR}/`);
  console.log(`SQL 文件: ${sqlPath}`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
