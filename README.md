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
- `components/AdminPanel.tsx`：管理员登录面板（口令 + passkey 双因素）
- `app/api/admin/*`：管理员口令、passkey 注册/验证、会话接口
- `lib/auth.ts` / `lib/webauthn.ts`：内存版管理认证状态与 WebAuthn 参数推导
- `tests/*.test.ts`：认证与数据层单元测试（`pnpm test`）

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
pnpm typecheck
pnpm build
~~~

## 管理员 2FA（口令 + passkey）

首页顶部新增了管理员入口，采用「口令（第一因素）+ WebAuthn passkey（第二因素）」登录：

1. 输入 `ADMIN_PASSWORD` 配置的管理员口令
2. 首次使用：浏览器会引导注册一个 passkey（平台认证器或安全密钥）
3. 之后每次登录：口令通过后，还要用同一设备的 passkey 再验证一次
4. 登录后每条点歌右侧出现「隐藏」按钮；隐藏内容不再出现在公开列表里，并记录 `hiddenAt`

环境变量：复制 `.env.example` 为 `.env.local` 后按需修改（`.env*` 已被 gitignore，不要提交真实口令）。

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `ADMIN_PASSWORD` | 是（未配置时管理员接口返回 503） | 第一因素管理员口令 |
| `WEBAUTHN_RP_ID` | 否 | passkey 的 RP ID，默认从请求 origin 的域名推导 |
| `WEBAUTHN_ORIGIN` | 否 | 期望的 origin，默认从请求头推导，反向代理场景可显式指定 |

### 新增接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/admin/login` | 校验口令，返回 `{ next: "register" \| "passkey" }` 并签发 5 分钟 pre-auth cookie |
| GET | `/api/admin/session` | 查询是否已登录、是否已注册 passkey |
| DELETE | `/api/admin/session` | 退出登录 |
| GET | `/api/admin/passkey/register` | 获取 passkey 注册参数（仅限尚未注册时） |
| POST | `/api/admin/passkey/register` | 校验注册结果、保存凭据并建立会话 |
| GET | `/api/admin/passkey/login` | 获取 passkey 断言参数 |
| POST | `/api/admin/passkey/login` | 校验断言并建立会话 |
| PATCH | `/api/songs/[id]` | 隐藏点歌（需要管理员会话） |

### 安全设计

- 口令使用常量时间比较；同一进程内连续失败达到 5 次触发 10 分钟限流
- pre-auth / 会话 cookie 均为 `HttpOnly` + `SameSite=Lax`（生产环境额外加 `Secure`），cookie 值只是随机 id，真实状态保存在服务端
- passkey 校验会核对 origin、RP ID、challenge 与签名，并更新凭据计数器
- 首次注册 passkey 只允许「尚无任何 passkey」时进行，避免仅凭口令就给攻击者注册第二因素
- 当前版本不支持在线追加第二台设备；如需更换设备，重启服务（内存状态清空）后重新注册

> 和点歌数据一样，passkey / 会话 / challenge 都只存在进程内存里，重启后清空。生产使用请换成持久化存储。

跑测试：

~~~bash
pnpm test
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
