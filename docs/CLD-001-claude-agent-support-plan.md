# CLD-001：Claude Code 账号支持开发计划

- **Plan ID**: CLD-001
- **版本**: 1.0（执行基线）
- **日期**: 2026-09-24
- **状态**: 待执行（本文件是 CLD-001 的唯一主源计划 / source plan）
- **关联文档**: `docs/FINAL-DESIGN.md`、`docs/05-tauri-command-contracts.md`、`docs/DESIGN_GOAL.md`
- **参考实现**: `docs/cockpit-tools-main/src-tauri/src/modules/claude_account.rs`、`claude_instance.rs`（行为参考，非规范）

---

## 1. Objective（目标）

在 LAM 中把 Claude Code 支持为一等 agent，与 Codex 同形提供账号空间、auth 登录、external API 接入、会话与额度能力。

- **目标 1：同形账号体验。** 新增 Claude Code agent 后，用户在 LAM 里看到与管理 Codex 账号一致的账号卡片、空间生命周期、登录入口和额度信息。每个 Claude 空间都能通过生成的 wrapper 命令直接启动 Claude Code，命令形态与 `codex-<name>` 对称，用户不需要手工设置环境变量。
- **目标 2：两种模型接入路径。** external API 支持两条与 Codex 对称的路径：上游本身是 Anthropic Messages 兼容时走直连投影；上游是 OpenAI Chat Completions 时走 LAM 本地网关协议适配。
- **目标 3：增量兼容。** 所有 Claude 能力必须以增量方式加入，Codex 现有命令、缓存、配置投影与 wrapper 输出保持兼容，`make check` 是每个节点的公共回归 Gate。
- **目标 4：安全默认。** 延续 LAM 的零泄漏原则：凭据不复制、不落明文；默认空间 `~/.claude` 默认只读，任何写入都必须是用户显式触发、可备份、可还原的受管投影。

## 2. Scope（范围）

### 2.1 In Scope（本次交付）

- **空间**：识别默认空间 `~/.claude`（profile id 为 `main`）与受管空间 `~/.claude-<name>`（profile id 为 `<name>`），支持创建、重命名、删除与 wrapper 生成。
- **认证**：支持在外部终端完成 Claude Code 的 auth 登录（含全新空间首次登录），支持探测登录状态、凭据位置与过期时间，支持用户显式导入凭据 JSON 以生成受管空间。
- **External API 直连**：支持在 Provider Hub 中新增 Anthropic Messages 协议的上游，并把 `ANTHROPIC_BASE_URL`、`ANTHROPIC_AUTH_TOKEN`、模型映射等键以受管投影方式写入目标空间的 `settings.json`。
- **External API 网关**：支持把 OpenAI Chat Completions 上游通过本地网关暴露为 Anthropic Messages 协议，让 Claude Code 以 `ANTHROPIC_BASE_URL` 指向回环地址的方式直接使用。
- **会话**：支持列出、查询、删除 Claude 会话，支持生成 resume 命令并在终端恢复，支持把单条 Claude 会话接力到另一个空间。
- **用量与额度**：支持把 Claude 会话 JSONL 的 token 活动写入 LAM 本地用量只读模型，支持采集 Claude 订阅额度快照并在托盘与界面展示。
- **界面与文档**：支持在桌面应用中按 agent 切换账号/会话/用量视图，支持在 Provider 界面编辑 Anthropic Messages 协议与模型映射，并更新命令契约文档与 README。

### 2.2 Non-Goals（本次不做）

- **不修改 Claude Code 自身。** LAM 不内置、不补丁、不替换 Claude Code 二进制，只通过 `CLAUDE_CONFIG_DIR`、wrapper 与配置文件契约驱动官方 CLI。
- **不实现或复刻非公开 OAuth。** 不逆向 Claude 的 OAuth 端点、客户端 ID 或私有接口来替用户登录；登录必须在 Claude Code 官方 CLI 流程内完成。
- **不合并用量库。** 本次不把 Claude 用量写入 Codex 的 `usage.sqlite3`，不改动 Codex 用量聚合逻辑；Claude 使用独立数据库与独立查询服务。
- **不做跨平台。** 与现状一致，仅支持 macOS。
- **不自动复制凭据。** 任何空间创建、接力、导入流程都不得复制 `.credentials.json`、Keychain 条目或 `~/.claude.json` 中的账号信息。
- **不做 Claude Desktop。** 本次只覆盖 Claude Code CLI，不覆盖 Claude 桌面应用的实例管理与桌面网关。

## 3. Steps（实施步骤）

波次按 A→B/C→D→E/F→G 推进，后一波次节点在前置节点 `验证成功` 前保持 `BLOCKED`。

1. **波次 A（基础）**：先完成 agent 领域模型（CLD-001-01）与多 agent 存储布局（CLD-001-02），建立 Codex 零回归基线。
2. **波次 B（空间与认证）**：Claude 空间生命周期（CLD-001-03）与登录/凭据探测（CLD-001-04），使账号卡片与 wrapper 可用。
3. **波次 C（直连）**：Provider 协议扩展与 `settings.json` 受管投影（CLD-001-05）、API 账号编排（CLD-001-06），打通 Anthropic 兼容上游。
4. **波次 D（网关）**：Anthropic Messages 网关入站与适配（CLD-001-07）、网关绑定与启动链路（CLD-001-08），打通 Chat Completions 上游。
5. **波次 E（会话）**：会话索引与删除（CLD-001-09）、resume 与跨空间接力（CLD-001-10）。
6. **波次 F（用量）**：用量与额度采集（CLD-001-11）。
7. **波次 G（交付）**：账号与 agent 切换 UI（CLD-001-12）、会话与用量 UI（CLD-001-13）、命令契约/文档/发布验收（CLD-001-14）。

每个行为任务先写测试并观察 RED，再实现到 GREEN，禁止跳过 RED 证据；RED 与 GREEN 是每个任务的完成方式，不作为独立任务拆分。

## 4. Interfaces（接口与不变式）

### 4.1 Agent 领域接口

- 新增 `AgentId`、`AgentProfile` 与 `AgentCapabilities`，Codex 通过适配器实现同一投影，不改变既有 `CodexAccount` 字段与序列化。
- `AgentId` 取值为 `codex` 与 `claude_code`；新增取值必须同时提供 profile 扫描、wrapper 生成与能力声明，否则注册失败。
- `AgentProfile` 字段：`id`、`agentId`、`displayName`、`homePath`、`wrapperPath`、`hasAuth`、`sessionCount`、`managed`、`note`；序列化使用 camelCase，与前端 `types.ts` 对齐。
- 注册表按 agent 分派：列表、查找、wrapper 生成、登录命令必须经由注册表，禁止在上层直接匹配目录名。

### 4.2 空间与文件契约

- profile id 为 `main` 时空间目录是 `~/.claude`，其它 id 为 `~/.claude-<name>`；`main` 不生成 wrapper，其余空间生成 `claude-<name>` wrapper。
- wrapper 生成位置沿用 Codex 的候选目录与 PATH 探测逻辑（优先 `~/.local/bin`，回退 `~/bin`），并在输出目录不在登录 PATH 时给出同样的警告。
- wrapper 脚本必须导出 `CLAUDE_CONFIG_DIR` 并在缺少 `claude` 时给出可操作的错误信息；二进制解析顺序是 `CLAUDE_BIN` 环境变量、登录 shell PATH 中的 `claude`。
- 空间信号文件集合为 `settings.json`、`settings.local.json`、`.credentials.json`、`projects`、`history.jsonl`、`.claude.json`、`.config.json` 与 LAM marker；任一存在即视为可识别的 Claude 空间。
- LAM 在每个受管空间写入 marker `.managed-by-lam.json`，记录 `agentId`、`profileId`、`homePath`、`wrapperPath`、`createdAt`。

### 4.3 认证接口

- 登录入口必须打开用户配置的终端目标并执行带 `CLAUDE_CONFIG_DIR` 的 `claude` 命令，由用户在官方 CLI 内完成 `/login`；LAM 不读取、不转发、不存储登录过程中的浏览器凭据。
- 凭据探测顺序：macOS Keychain 条目优先，回退空间内 `.credentials.json`；探测失败不得阻塞其它账号卡片的渲染，必须以 `authMode=unknown` 呈现。
- Keychain service 名按 Claude Code 的命名规则推导：默认空间使用无后缀名，非默认空间使用带目录指纹后缀的名字；该规则是待实测假设，必须通过探针测试锁定并在推导失败时回退到"仅检测 `.credentials.json`"。
- LAM 只读凭据中的过期时间与订阅层级用于展示；任何凭据写入只发生在用户显式导入流程，且导入后立即写私密权限位（文件 0600、目录 0700）。

### 4.4 Provider 与投影接口

- `ProviderProtocol` 新增 `anthropic_messages`；`responses` 与 `chat_completions` 的既有序列化保持不变。
- Claude 投影目标文件是目标空间的 `settings.json`，受管键集合为 `env.ANTHROPIC_BASE_URL`、`env.ANTHROPIC_AUTH_TOKEN`、`env.ANTHROPIC_API_KEY`、`env.ANTHROPIC_MODEL`、`env.ANTHROPIC_DEFAULT_HAIKU_MODEL`、`env.ANTHROPIC_DEFAULT_SONNET_MODEL`、`env.ANTHROPIC_DEFAULT_OPUS_MODEL`、`env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC`；未使用的键必须移除而不是写空值。
- 投影必须沿用 Codex 的受管语义：写入前备份原文件、在绑定记录里保存 `beforeHash`、`appliedHash`、`previousValues` 与 `managedValues`，detach 时逐键校验所有权后还原。
- 密钥合同：`settings.json` 不落明文密钥；token 通过 Keychain 引用 + `lam-auth-helper` 在 wrapper 启动时注入，helper 参数至少包含状态根目录、profile id 与凭据引用。
- 模型映射必须总是写入一个可用的小模型（HAIKU 等价）与默认模型，否则 Claude Code 的后台任务会因模型不存在而报错。

### 4.5 网关接口

- 网关新增入站路由 `POST /v1/messages`，并实现 `POST /v1/messages/count_tokens`；错误响应使用 Anthropic 错误信封 `{"type":"error","error":{"type":...,"message":...}}`。
- 流式响应必须产生 Anthropic SSE 事件序列：`message_start`、`content_block_start`、`content_block_delta`、`content_block_stop`、`message_delta`、`message_stop`，并按需要发送 `ping`。
- 认证同时接受 `x-api-key` 与 `Authorization: Bearer`；token 校验复用现有网关绑定与哈希校验逻辑，未知 token 必须返回 401 且不产生上游请求。
- 适配器 `messages_to_chat_completions` 负责把 Anthropic 请求映射为 Chat Completions 请求并反向映射响应，覆盖系统提示、工具定义、工具调用与工具结果、停止原因、usage 与错误映射。
- 绑定记录新增 `agentId` 与入站协议字段；Claude 网关路径的本地基址是 `http://127.0.0.1:<port>`，鉴权 token 由 wrapper 从 Keychain 注入的 `ANTHROPIC_AUTH_TOKEN` 提供。

### 4.6 会话接口

- Claude 会话文件位于 `<config_dir>/projects/<cwd-slug>/<session-uuid>.jsonl`，会话 id 是文件名的 UUID，工作目录从 JSONL 记录中还原。
- resume 命令形态为 `cd '<cwd>' && CLAUDE_CONFIG_DIR='<home>' claude --resume '<session-id>'`，cwd 缺失时退化为不切换目录并在预览中给出警告。
- 跨空间接力只复制会话 JSONL 到目标空间的对应 slug 目录；禁止复制 `.credentials.json`、Keychain 条目与 `~/.claude.json`。
- 会话删除沿用 Codex 的暂存删除策略（先移动到 LAM 暂存目录再清理），并同步清理该会话在 Claude 用量库中的行。

### 4.7 用量与额度接口

- Claude 用量写入独立数据库 `~/.lam/usage/claude-usage.sqlite3`，记录 `agent_id=claude_code` 维度的 calls 与 threads，不改动 Codex 用量库。
- 用量解析以每条 assistant 消息的 usage 字段为原子事件，记录输入、输出、缓存创建与缓存读取 token，并把模型 id 写入行。
- 额度采集默认关闭，作为实验性高级选项显式启用；启用后通过带 Bearer token 的 OAuth usage 接口读取 5 小时与 7 天窗口，输出复用 `UsageQuotaSnapshot` 形状。
- 采集失败必须降级：`source=unavailable` 或 `source=stale_cache`，界面展示原因，且绝不把本地估算伪装成实时剩余额度。
- 使用 API Key 的账号没有订阅额度，必须显示 `unavailable` 与明确的账号类型说明，不发起额度请求。

### 4.8 命令与前端接口

- 新增 Tauri 命令沿用 `<domain>_v2` 或 `<domain>` 命名并登记到 `docs/05-tauri-command-contracts.md`；命令返回结构化错误 `{code, message}`，禁止 panic 传播到前端。
- 前端 `types.ts` 新增 `AgentProfile`、`ClaudeAccount`、`ClaudeSession`、`ClaudeUsage*` 类型；`api.ts` 为每个新命令提供薄封装。
- 视图层新增 agent 切换器，账号/会话/用量视图按 agent 过滤；Provider 编辑器新增 Anthropic Messages 协议与 Claude 模型映射区块。
- 敏感值禁止进入前端状态与日志：界面只展示是否存在凭据、过期时间与来源，不展示 token 原文。

## 5. Work Packages（工作包）

### 5.1 CLD-001A 领域模型与存储基线

交付 agent 注册表、`AgentProfile` 投影、按 agent 分区的 LAM 存储路径与 Codex 零回归基线。节点：CLD-001-01、CLD-001-02。

### 5.2 CLD-001B Claude 空间与认证

交付 Claude 空间发现/创建/重命名/删除、wrapper 生成、终端登录入口与凭据探测。节点：CLD-001-03、CLD-001-04。

### 5.3 CLD-001C External API 直连接入

交付 `anthropic_messages` 协议、`settings.json` 受管投影与 API 账号编排（规划、执行、分离、轮换）。节点：CLD-001-05、CLD-001-06。

### 5.4 CLD-001D 本地网关（Anthropic Messages）

交付 Anthropic Messages 网关入站、`messages_to_chat_completions` 适配、网关绑定与启动链路。节点：CLD-001-07、CLD-001-08。

### 5.5 CLD-001E Claude 会话

交付 Claude 会话索引、查询、删除、resume 命令与跨空间接力。节点：CLD-001-09、CLD-001-10。

### 5.6 CLD-001F 用量与额度

交付 Claude 用量只读模型与额度快照采集、降级策略与托盘展示数据。节点：CLD-001-11。

### 5.7 CLD-001G 前端与交付

交付 agent 切换 UI、Claude 账号/会话/用量界面、Provider 编辑扩展、命令契约与发布验收。节点：CLD-001-12、CLD-001-13、CLD-001-14。

## 6. Test Matrix（测试矩阵）

所有行为任务按下列维度选择适用用例，并在任务中写明具体用例；不适用于某任务的维度必须在该任务里说明原因。

- **正常路径**：创建空间、登录后卡片刷新、直连/网关两种上游各跑一次真实请求形态。
- **边界**：id 含连字符/大小写、超长路径、缺失 cwd、空 `settings.json`、模型列表为空、时区与过期时间边界。
- **非法输入**：非法 profile id（路径穿越、空串、保留字）、非法 base URL、非法协议组合、非法 token 形态。
- **错误与降级**：上游 4xx/5xx、SSE 中途断开、Keychain 读取失败、凭据过期、额度接口失败。
- **状态与冲突**：已存在同名空间、wrapper 已存在且内容不同、投影文件被外部修改（drift）、并发创建同名账号。
- **安全**：凭据不落明文、不跨空间复制、日志与前端状态不出现 token、文件权限 0600/0700、默认空间只读约束。
- **回滚**：创建空间失败回滚、投影写入失败回滚、attach 失败还原原 `settings.json`、删除失败恢复暂存文件。

## 7. Verification（验证）

- 每个节点必须运行：聚焦测试命令（`cargo test --test <node-test>` 或 `npm run test:ui`）与公共回归 Gate `make check`（前端构建、UI 测试、`cargo fmt -- --check`、`cargo clippy -- -D warnings`、`cargo test`）。
- 涉及前端行为的节点（CLD-001-12、CLD-001-13）除 `make check` 外必须运行 `npm run test:ui` 并保留交互测试证据。
- 协议与集成节点必须提供端到端证据：以临时 LAM home 与 wiremock/fixture 上游运行，断言请求路径、鉴权头、SSE 事件序列与失败映射。
- 真实二进制验收：CLD-001-14 必须提供一份手工验收矩阵，使用真实 `claude` 二进制与至少一个 Anthropic 兼容上游、一个 Chat Completions 上游完成登录、直连调用、网关调用、resume 与接力。
- 兼容性 Gate：CLD-001-02 与 CLD-001-14 必须运行 Codex 既有测试套件并确认缓存文件、命令 DTO 与 wrapper 文本未发生非预期变化。

## 8. Done（完成标准）

- 用户可在 LAM 中创建 Claude 空间，完成登录后看到与 Codex 对称的账号卡片与状态。
- 用户可新增 external API 账号，并让 Claude Code 通过直连或本地网关两条路径直接调用，无需手工编辑配置文件。
- 用户可在 LAM 中查看 Claude 会话、复制 resume 命令并在终端恢复，可把单条会话接力到另一个空间且不复制任何凭据。
- 用户可查看 Claude 用量与订阅额度（含托盘），失败时有明确的降级状态说明。
- Codex 全部既有功能与测试保持通过，`make check` 在合并前全绿。

## 9. STOP（停止条件）

- 源计划、语义追溯与实现事实冲突，或需求/digest 漂移、双向映射缺失时停止并回到规划。
- 需要未授权公共语义变更（修改既有 Codex 命令契约、缓存格式或默认空间写入策略）时停止。
- 需要破坏性操作或外部权限（写入用户 `~/.claude` 且无备份、读取浏览器凭据、调用非公开端点）时停止。
- Claude Code 实测行为与假设冲突（Keychain 命名、`settings.json` schema、SSE 事件名、`count_tokens` 语义）时停止并回到设计评审。
- 连续五轮修复仍无法通过节点验收时停止并上报证据。

## 10. External Sources（外部依据）

规范来源（实现前必须按版本核对，冲突时以官方文档为准）：

- Anthropic Claude Code 官方文档：配置目录与 `CLAUDE_CONFIG_DIR`、`settings.json` 的 `env`/`apiKeyHelper` 语义、`ANTHROPIC_*` 环境变量、`--resume` 与会话存储位置。
- Anthropic Messages API 官方文档：`POST /v1/messages` 请求/响应结构、SSE 事件名与错误信封、`count_tokens` 语义。
- 本地参考实现（行为参考，非规范）：`docs/cockpit-tools-main/src-tauri/src/modules/claude_account.rs`、`claude_instance.rs`，用于核对 Keychain 命名、凭据结构与额度接口形态。
- 仓库内基线：`docs/FINAL-DESIGN.md`（Agent/AgentProfile 抽象）、`docs/05-tauri-command-contracts.md`（命令契约）、`apps/desktop/src-tauri/src/services/account.rs` 与 `provider_config_editor.rs`（wrapper 与受管投影既有语义）。

待实测假设（对应 STOP 条件，必须由探针测试锁定后才能固化行为）：

- macOS Keychain 的 Claude Code 凭据 service 名推导规则与非默认目录后缀形态。
- `claude --resume` 对跨目录复制 JSONL 的接受度与所需的最小元数据。
- `count_tokens` 在客户端调用频率与缺失时的降级行为。
