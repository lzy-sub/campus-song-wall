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
- `lib/songs.ts`：内存版数据层，方便先跑通逻辑
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
components/        # 有需要再拆
lib/
  songs.ts
prisma/            # 任务 1 再创建
tests/             # 任务 4 再创建
~~~

## 本地开发

~~~bash
pnpm install
pnpm dev
~~~

常用检查：

~~~bash
pnpm lint
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