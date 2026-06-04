/**
 * download-icons.js
 *
 * 从 mianshiya.com 下载 29 个分类的图标到前端 public/icons 目录。
 *
 * 用法: node download-icons.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ICON_DIR = path.resolve(__dirname, '../../frontend/public/icons');

const BANKS = [
  {
    "name": "Java 基础",
    "slug": "java-basics",
    "id": "1787463103423897602"
  },
  {
    "name": "Java 集合",
    "slug": "java-collections",
    "id": "1788408712975282177"
  },
  {
    "name": "Java 并发",
    "slug": "java-concurrency",
    "id": "1789249312885223425"
  },
  {
    "name": "JVM",
    "slug": "jvm",
    "id": "1789931432793948162"
  },
  {
    "name": "MySQL",
    "slug": "mysql",
    "id": "1791003439968264194"
  },
  {
    "name": "Redis",
    "slug": "redis",
    "id": "1791375592078610434"
  },
  {
    "name": "MongoDB",
    "slug": "mongodb",
    "id": "1837028071614509057"
  },
  {
    "name": "Spring",
    "slug": "spring",
    "id": "1790683494127804418"
  },
  {
    "name": "SpringBoot",
    "slug": "spring-boot",
    "id": "1797452903309508610"
  },
  {
    "name": "SpringCloud",
    "slug": "spring-cloud",
    "id": "1797453053310402561"
  },
  {
    "name": "MyBatis",
    "slug": "mybatis",
    "id": "1801424748099739650"
  },
  {
    "name": "Netty",
    "slug": "netty",
    "id": "1804354610222800897"
  },
  {
    "name": "计算机网络",
    "slug": "computer-network",
    "id": "1790948499480616961"
  },
  {
    "name": "操作系统",
    "slug": "os",
    "id": "1790684063773007874"
  },
  {
    "name": "算法与数据结构",
    "slug": "algorithm-data-structure",
    "id": "1824727406021644290"
  },
  {
    "name": "设计模式",
    "slug": "design-patterns",
    "id": "1801559627969929217"
  },
  {
    "name": "消息队列",
    "slug": "message-queue",
    "id": "1801255316257841153"
  },
  {
    "name": "RabbitMQ",
    "slug": "rabbitmq",
    "id": "1850081848441466881"
  },
  {
    "name": "Kafka",
    "slug": "kafka",
    "id": "1837027669393338369"
  },
  {
    "name": "Nginx",
    "slug": "nginx",
    "id": "1824363422328864769"
  },
  {
    "name": "Docker 与 K8s",
    "slug": "docker-k8s",
    "id": "1812067352871829505"
  },
  {
    "name": "Git",
    "slug": "git",
    "id": "1815649049726590977"
  },
  {
    "name": "Linux",
    "slug": "linux",
    "id": "1812067560819048449"
  },
  {
    "name": "后端系统设计",
    "slug": "system-design",
    "id": "1795650093939204097"
  },
  {
    "name": "后端场景题",
    "slug": "backend-scenario",
    "id": "1795650132375805954"
  },
  {
    "name": "Dubbo",
    "slug": "dubbo",
    "id": "1801127500832907266"
  },
  {
    "name": "Elasticsearch",
    "slug": "elasticsearch",
    "id": "1805423815382736897"
  },
  {
    "name": "DevOps",
    "slug": "devops",
    "id": "1811358596541374466"
  },
  {
    "name": "HR 面试",
    "slug": "hr",
    "id": "1818997293283516418"
  },
  {
    "name": "Go",
    "slug": "go",
    "id": "1810641215871569922"
  },
  {
    "name": "Python",
    "slug": "python",
    "id": "1810643768400019458"
  },
  {
    "name": "C++",
    "slug": "c-plus-plus",
    "id": "1810642495797854209"
  },
  {
    "name": "C#",
    "slug": "c-sharp",
    "id": "1838761134207819778"
  },
  {
    "name": "PHP",
    "slug": "php",
    "id": "1833391473610956801"
  },
  {
    "name": "JavaScript",
    "slug": "javascript",
    "id": "1810644471159848962"
  },
  {
    "name": "TypeScript",
    "slug": "typescript",
    "id": "1810644420521152513"
  },
  {
    "name": "Vue",
    "slug": "vue",
    "id": "1817900864917000193"
  },
  {
    "name": "React",
    "slug": "react",
    "id": "1817900465338241026"
  },
  {
    "name": "前端手写代码",
    "slug": "frontend-handwrite",
    "id": "1820434920244424705"
  },
  {
    "name": "前端代码分析",
    "slug": "frontend-code-analysis",
    "id": "1810644905160396801"
  },
  {
    "name": "前端工程化",
    "slug": "frontend-engineering",
    "id": "1810644197003362306"
  },
  {
    "name": "AI 大模型",
    "slug": "ai-llm",
    "id": "1906189461556076546"
  },
  {
    "name": "AI 项目实战",
    "slug": "ai-project",
    "id": "1929747035048828930"
  },
  {
    "name": "系统运维",
    "slug": "system-ops",
    "id": "1811358545672855553"
  },
  {
    "name": "IT 运维",
    "slug": "it-ops",
    "id": "1811358325988474882"
  },
  {
    "name": "OpenClaw",
    "slug": "openclaw",
    "id": "2031640554575519745"
  }
];

async function getPictureUrl(bankId) {
  const res = await fetch('https://api.mianshiya.com/api/question_bank/list/page/vo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' },
    body: JSON.stringify({ pageSize: 400 }),
  });
  const data = await res.json();
  const bank = data.data.records.find(b => b.id === bankId);
  return bank ? bank.picture : null;
}

async function downloadImage(url, filePath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(filePath, buffer);
  return buffer.length;
}

async function main() {
  console.log('=== 下载 29 个分类图标 ===\n');

  if (!fs.existsSync(ICON_DIR)) {
    fs.mkdirSync(ICON_DIR, { recursive: true });
  }

  // First, fetch all bank picture URLs in one call
  const res = await fetch('https://api.mianshiya.com/api/question_bank/list/page/vo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' },
    body: JSON.stringify({ pageSize: 400 }),
  });
  const data = await res.json();
  const allBanks = data.data.records;

  const updates = [];

  for (const bank of BANKS) {
    const match = allBanks.find(b => b.id === bank.id);
    const pictureUrl = match ? match.picture : null;

    if (!pictureUrl) {
      console.log(`  ${bank.name}: no picture URL found`);
      continue;
    }

    const ext = path.extname(new URL(pictureUrl).pathname) || '.png';
    const fileName = `${bank.slug}${ext}`;
    const filePath = path.join(ICON_DIR, fileName);

    try {
      const bytes = await downloadImage(pictureUrl, filePath);
      console.log(`  ${bank.name}: ${fileName} (${bytes} bytes)`);
      updates.push({ name: bank.name, slug: bank.slug, icon: `/icons/${fileName}` });
    } catch (err) {
      console.log(`  ${bank.name}: download failed - ${err.message}`);
    }
  }

  // Generate an SQL update script for the icon column
  if (updates.length > 0) {
    const sqlPath = path.resolve(__dirname, 'sql/update-icons.sql');
    const sqlLines = [
      '-- =============================================',
      '-- 更新分类图标（从 mianshiya 下载）',
      `-- 生成时间: ${new Date().toISOString()}`,
      '-- =============================================',
      '',
    ];
    for (const u of updates) {
      sqlLines.push(
        `UPDATE category SET icon = '${u.icon}' WHERE name = '${u.name}';`
      );
    }
    fs.writeFileSync(sqlPath, sqlLines.join('\n'), 'utf-8');
    console.log(`\nSQL 更新脚本: ${sqlPath}`);
  }

  console.log(`\n图标已下载到: ${ICON_DIR}`);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
