# 部署说明

本项目生产部署采用单机 Docker Compose，适合轻量应用服务器。暂不配置域名时，访问地址为 `http://服务器公网IP/`。

## 服务器要求

- Linux x86_64，推荐 Ubuntu 22.04/24.04 或 Debian 12
- 2 核 2G 可跑小流量，推荐 2 核 4G 或 4 核 4G
- 安全组放行 80 端口；暂不配置域名时不需要 443
- 不要对公网开放 3306、6379、8080

## 首次部署

```bash
sudo mkdir -p /opt/lcb-interview
cd /opt/lcb-interview
```

把仓库代码上传到 `/opt/lcb-interview` 后，复制环境变量模板：

```bash
cp .env.example .env
```

编辑 `.env`，至少修改：

- `MYSQL_ROOT_PASSWORD`
- `DB_PASSWORD`
- `ADMIN_TOKEN`

如果服务器上不安装 Node.js 和 Maven，推荐先在本机完成构建并使用运行时编排：

```bash
cd backend
mvn -DskipTests package
cd ../frontend
npm run build
cd ..
```

启动服务：

```bash
docker compose -f docker-compose.runtime.yml up -d
```

查看状态：

```bash
docker compose ps
docker compose logs -f backend
```

浏览器访问：

```text
http://服务器公网IP/
```

管理后台访问：

```text
http://服务器公网IP/admin/login
```

登录 Token 使用 `.env` 中的 `ADMIN_TOKEN`。

## 数据初始化

MySQL 容器第一次创建数据卷时，会自动执行 `backend/scripts/sql/init.sql`。如果 `mysql_data` 卷已经存在，初始化 SQL 不会重复执行，避免覆盖已有数据。

如果确实要重建数据库，需要先备份数据，再删除 `mysql_data` 卷后重新启动。

## 日常更新

```bash
cd /opt/lcb-interview
git pull
docker compose -f docker-compose.runtime.yml up -d
```

## 资源建议

2G 内存服务器建议保留 `.env.example` 中的默认限制：

```text
JAVA_OPTS=-Xms256m -Xmx768m -XX:+ExitOnOutOfMemoryError
REDIS_MAXMEMORY=128mb
```

如果升级到 4G 内存，可以把 Java 最大堆调到 1G：

```text
JAVA_OPTS=-Xms256m -Xmx1024m -XX:+ExitOnOutOfMemoryError
```
