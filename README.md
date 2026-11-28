# 校园点歌墙（新手任务）

> 极简总结：一个用来练习前后端协作和 PR 流程的迷你项目。当前代码可以直接跑，但只用了内存数据；新手任务是在现有骨架上做一个有意义的小功能。

## 目标

做一个简单的校园广播点歌墙：

- 用户可以提交「歌名 + 歌手 + 点歌人」
- 首页展示当前公开点歌
- 管理员可以隐藏不合适的内容
- 前后端都在同一个 Next.js 项目里，但 API 和页面分离
- 构建、类型检查、测试和部署方式尽量贴近凛光

## 当前已有

- Next.js App Router + TypeScript
- `app/page.tsx`：点歌表单和列表
- `app/api/songs/route.ts`：GET / POST 接口
- `app/api/songs/[id]/route.ts`：PATCH 接口，管理员隐藏点歌（见下方「管理员隐藏」）
- `lib/songs.ts`：内存版数据层，含隐藏与审计记录
- 基础 `package.json`、`tsconfig.json`、`next.config.ts`

> 注意：数据存在进程内存里，重启会丢失。这是故意留给新手的改造点。

## 新手任务（任选一个，提交 PR）

优先做其中一项，不要一次改太多：

1. **接入 Prisma + SQLite**
   - 增加 `prisma/schema.prisma`
   - `SongRequest` 模型：id、song、artist、requester、hidden、createdAt
   - 首次迁移和 seed
   - 把 `lib/songs.ts` 改成 Prisma 查询

2. **管理员隐藏功能**
   - 增加一个最简单的管理员口令或登录态
   - `PATCH /api/songs/[id]` 支持隐藏
   - 首页只展示未隐藏内容
   - 写一条审计或至少记录操作时间

3. **表单校验和错误提示**
   - 歌名、歌手、点歌人长度限制
   - 禁止空提交
   - API 返回结构化错误，前端展示

4. **测试**
   - 给数据层或 API 校验逻辑写 `tests/*.test.ts`
   - 接入 `tsx`，在 `package.json` 增加 `test`
   - 至少覆盖：正常提交、空内容、隐藏后不可见

5. **Docker 部署**
   - 增加 Dockerfile 和 docker-compose
   - 使用 SQLite 数据卷
   - 提供一条启动命令和 README 部署说明

## 目录结构

~~~text
app/
  page.tsx
  api/songs/route.ts
  api/songs/[id]/route.ts
  api/admin/audit/route.ts
components/        # 有需要再拆
lib/
  songs.ts
  admin.ts
prisma/            # 任务 1 再创建
tests/
  songs.test.ts
~~~

## 本地开发

~~~bash
pnpm install
pnpm dev
~~~

常用检查：

~~~bash
pnpm typecheck
pnpm build
~~~

## 完成标准

一个 PR 至少满足：

- 改动范围聚焦，能清楚说明做了什么
- `pnpm typecheck` 通过
- 如果改了业务逻辑，补了对应测试
- README 或代码注释说明了新增的接口/字段
- 没有提交 `.env`、数据库文件、密钥或 `node_modules`

## PR 规则

- 从自己的 fork 或分支提交 PR
- 标题使用 `feat:` / `fix:` / `test:` / `chore:`
- 描述写清楚：改了什么、为什么改、怎么验证
- 一个 PR 只解决一个明确问题

评审通过一个有意义、可运行的 PR，即完成新手任务。

## 管理员隐藏（任务 2 已完成）

- 鉴权：请求头 `x-admin-password` 与服务端环境变量 `ADMIN_PASSWORD` 相等即可（最简单的口令方案）。
  - 鉴权逻辑抽在 `lib/admin.ts` 的 `checkAdmin()`，`PATCH /api/songs/[id]` 与 `GET /api/admin/audit` 复用。
- 接口：`PATCH /api/songs/[id]`，隐藏指定 id 的点歌。
  - `401`：口令错误；`404`：点歌不存在；`500`：服务端未配置 `ADMIN_PASSWORD`。
- 审计查询：`GET /api/admin/audit`，返回内存版隐藏操作记录（鉴权同上）。
- 数据字段：`SongRequest` 新增 `hiddenAt`（隐藏时间，未隐藏为 `null`）。
- 审计：`lib/songs.ts` 的 `listAudit()` 返回内存版操作记录（`hide` 动作 + 歌名快照 + 时间），重启丢失。
- 首页 `GET /api/songs` 只返回未隐藏内容。
- 测试：`tests/songs.test.ts`，运行 `pnpm test`（`tsx --test`），覆盖提交、隐藏后不可见、审计写入、口令校验。

配置示例（复制 `.env.example` 为 `.env` 并修改）：

~~~bash
ADMIN_PASSWORD=你的口令
~~~

调用示例：

~~~bash
# 隐藏某条点歌
curl -X PATCH http://localhost:3000/api/songs/<id> -H "x-admin-password: 你的口令"

# 查看隐藏审计
curl http://localhost:3000/api/admin/audit -H "x-admin-password: 你的口令"
~~~

## 部署产物要求（重要）

这个仓库和凛光一样，**源码改动必须同时提交部署产物**。不允许只提交源码后让服务器现构建。

本地有 Linux/Docker 环境时执行：

~~~bash
pnpm deploy:build
pnpm deploy:check
git add -f .next/standalone .next/static .next/BUILD_ID .next/DEPLOY_INPUT_HASH .next/DEPLOY_PLATFORM
git commit -m "chore: update deploy artifacts (.next)"
~~~

提交 PR 时必须包含这五类产物：

- `.next/standalone`
- `.next/static`
- `.next/BUILD_ID`
- `.next/DEPLOY_INPUT_HASH`
- `.next/DEPLOY_PLATFORM`

如果本地没有 Docker/Linux 构建环境，请先说明，不要改用普通 `next build` 代替，也不要在生产服务器上构建。
