# LCB Interview — 面试题库网站

前后端分离的公开面试题库网站，支持浏览器端和手机端访问。

## 技术栈

| 层 | 技术 |
|------|------|
| 语言 | JDK 21（Virtual Threads, Record, Text Block, SequencedCollection） |
| 后端框架 | Spring Boot 3 + MyBatis-Plus |
| 数据库 | MySQL 8 + Redis (Spring Cache) |
| 前端 | React 18 + Vite + Ant Design 5 + Axios |
| Markdown | react-markdown + rehype-highlight |
| 部署 | Nginx 静态托管 + jar 部署 |

## 项目结构

```
lcb-interview/
├── backend/                          # Spring Boot 后端
│   ├── pom.xml
│   └── src/main/java/com/lcbinterview/
│       ├── common/                   # 统一响应结构、全局异常处理、业务异常
│       ├── config/                   # CORS、Redis 缓存、Swagger、MyBatis-Plus 配置
│       ├── model/                    # Entity（Category, Tag, Question）
│       ├── mapper/                   # MyBatis-Plus BaseMapper + 自定义 @Select
│       ├── service/                  # 业务逻辑层 + ViewCount 定时批量写入
│       ├── controller/               # REST API 控制器
│       └── dto/                      # Query/VO/PageResult（JDK 21 Record）
├── frontend/                         # React 前端
│   ├── package.json
│   ├── vite.config.ts
│   └── src/
│       ├── api/                      # Axios 实例 + API 封装
│       ├── components/Layout/        # 响应式布局壳
│       ├── pages/                    # 5 个页面
│       └── styles/                   # Ant Design 5 主题
├── docs/
│   └── superpowers/
│       ├── specs/                    # 设计文档
│       └── plans/                    # 实现计划
```

## 快速启动

### 1. 数据库初始化

```sql
CREATE DATABASE IF NOT EXISTS lcb_interview DEFAULT CHARSET utf8mb4;
SOURCE backend/src/main/resources/schema.sql;
SOURCE backend/src/main/resources/data.sql;
```

### 2. 启动后端

```bash
cd backend
mvn spring-boot:run
```

后端启动在 `http://localhost:8080`，Swagger 文档访问 `http://localhost:8080/swagger-ui.html`

### 3. 启动前端

```bash
cd frontend
npm install
npm run dev
```

前端启动在 `http://localhost:3000`，Vite 自动代理 `/api` 到后端

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/categories | 获取全部分类 |
| GET | /api/categories/{id} | 分类详情 |
| GET | /api/questions | 分页查询题目（支持 category/difficulty/tag/keyword） |
| GET | /api/questions/{id} | 题目详情 |
| GET | /api/questions/hot | 热门题目排行（Redis 缓存） |
| GET | /api/tags | 获取所有标签 |

## 代码规范

- **类注释**：每个类必须包含 Javadoc，说明类和职责
- **方法注释**：所有 public 方法包含参数/返回值说明
- **字段注释**：Entity 字段必须注释业务含义
- **日志分级**：INFO（关键节点）/ WARN（可恢复异常）/ ERROR（需人工介入）
- **JDK 21 Record**：DTO/VO 用 Record，不可变且自动 equals/hashCode
- **MyBatis-Plus**：LambdaQueryWrapper 动态拼 SQL，BaseMapper 内置 CRUD

## 部署

Nginx 配置见 `frontend/nginx.conf`，关键配置：

```nginx
# SPA 路由
location / {
    try_files $uri $uri/ /index.html;
}

# API 反向代理
location /api/ {
    proxy_pass http://backend:8080;
}
```
