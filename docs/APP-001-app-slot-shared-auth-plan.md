# APP-001 Codex App 帐号接力（共享凭据槽位）计划

- **状态**: 待评审
- **分支**: `agent/20261110-app-slot-shared-auth`
- **任务图**: [`todos/APP-001/README.md`](todos/APP-001/README.md)

## 1. Objective（目标）

PAT 模式的目的是在某个帐号额度用完后，切换到另一个帐号，继续用 Codex App 接力同一类工作。
目标：任意一个已登录 ChatGPT 的账号，都可以随时接管 Codex App；同一帐号同时在 Profile 模式的 CLI 中使用时，两边都不会因凭据冲突掉线。

帐号无论是在 Profile 模式还是 PAT 模式下登录或添加的，在两种模式下都能使用。切换 LamDock 的模式只改变界面上提供的操作，不改动任何凭据。

切换必须真正生效：App 当前挂着外部 API 连接时，切换 ChatGPT 帐号不能只换凭据就报告成功；用户也能从同一处把 App 切到某个 External API 连接。界面始终显示 App 当前用的是哪个帐号或哪个连接。

## 2. Research（调研结论）

### 2.1 现状与根因

- Codex App 内嵌在 `/Applications/ChatGPT.app` 中，它的 app-server 以 `CODEX_HOME=~/.codex` 运行，读取 `~/.codex/auth.json`。
- 现在的 PAT 切换（`switch_to_pat_account`）把帐号目录里的 `auth.json` 复制到 `~/.codex/auth.json`，再重启 ChatGPT。
- ChatGPT 登录的 refresh token 每使用一次就换成新的，旧的随即失效。复制后同一个 token 有两份：帐号目录的 CLI 和 App 谁先刷新，另一份就作废。切走时也不会把 App 刷新得到的新 token 写回帐号目录，下次切回来复制的是作废的旧 token。这是"切换后 App 仍然不能用"的设计根因。
- 实现缺陷：
  - 覆盖 `~/.codex/auth.json` 前不保存原内容。本机当前 App 使用的帐号不属于任何 profile，第一次切换就会丢失。
  - 帐号卡片和托盘在帐号没有 `auth.json` 时仍可点击切换，点击后才报 `AUTH_NOT_FOUND`。托盘对 API 帐号和 main 也显示切换按钮。
  - API Key 帐号可以被切进 `~/.codex`，但 `~/.codex/config.toml` 的 provider 仍是 OpenAI，凭据和 provider 对不上。
- Codex App 的"对话只读"提示由 Codex 自己判断：对话记录的 provider 与当前 provider 不同就锁定为只读。LamDock 的接力会改写对话的 `model_provider`，API 帐号的 provider 显示名（如 `pro API connection`）也由 LamDock 生成。这说明 App 槽位不能改变 provider。
- App 用哪个连接由 `~/.codex/config.toml` 决定：LamDock 通过 Provider Hub 中 `profile_id = main` 的绑定，把外部连接写进这个文件（Providers 页的 Attach / Detach，带预览、指纹校验和可回滚的 journal）。存在这个绑定时，App 走外部连接，`auth.json` 不起作用。现在的切换不检查这一点：用户切换 ChatGPT 帐号后看到"成功"，App 实际仍在用外部连接，旧对话还会变成只读。这是"切换后仍不能用"的第二个原因。
- 用户也可能手工在 `config.toml` 顶层写 `model_provider`。这类配置不归 LamDock 管理，LamDock 不应改动。

### 2.2 Codex 凭据写入实测

2026-11-10 在临时目录中实测：让 `CODEX_HOME/auth.json` 是指向另一个文件的符号链接，然后执行 `codex login --with-api-key`。

- 系统安装的 `codex-cli 0.167.0` 与 ChatGPT.app 自带的 `codex-cli 0.167.0-alpha.3.2` 行为一致：写入沿链接落到目标文件，链接本身保留。
- 退出登录只删除链接本身，目标文件不受影响。
- Codex 在链接目标旁创建 `auth.json.lock`，说明同一目标文件的并发刷新会经过同一把锁。
- 尚未验证：真实 token 刷新路径（非 login）是否走同一写入函数。这需要在真实帐号上观察，列入验收。

### 2.3 约束

- 不改变 Profile 模式的目录结构、wrapper 与登录方式。
- 不修改 Codex 或 ChatGPT.app。
- 帐号凭据只存一份，位于各自的 `~/.codex-<name>/` 目录。
- 不在日志、错误信息或前端状态中输出 token 原文。

## 3. Scope（范围）

范围内：

- PAT 切换改为链接：`~/.codex/auth.json`（以及存在时的 `auth-f.json`）指向目标帐号目录中的同名文件。
- 切换前保全槽位中的普通文件凭据：写回所属帐号，或导入为新帐号。
- 当前帐号识别、帐号删除和重命名与槽位链接保持一致。
- 前端在 PAT 模式下只对可接管 App 的帐号提供切换。
- 识别 App 当前目标（帐号、LamDock 管理的外部连接、用户自定义连接），在界面上显示。
- 切换 ChatGPT 帐号时，若 App 挂着 LamDock 管理的外部连接，经用户确认后先解除连接再切换；External API 帐号可经用户确认后接管 App。

范围外与限制：

- API Key 账号（`auth.json` 为 API Key 格式的 Codex 帐号）不能接管 Codex App；它们继续在 Profile 模式下使用。需要让 App 走 API 时，使用 External API 帐号。
- 帐号切换本身只处理凭据文件；`~/.codex/config.toml` 只在用户确认后，通过既有的 Attach / Detach 事务修改。用户手工写入的 `model_provider` 不做任何改动，只提示原因。
- 不改变 Profile 模式的接力（Handoff）逻辑。
- 不自动迁移：已有的复制式凭据在下一次切换时才被保全，不在启动时改动用户文件。

## 4. Design（设计）

### 4.1 App 凭据槽位模型

`~/.codex` 是 Codex App 和不带 `CODEX_HOME` 的 `codex` 命令共用的目录，本计划称其凭据文件为"App 槽位"。槽位有三种状态：

| 状态 | 判定 | 含义 |
| --- | --- | --- |
| 已链接 | `auth.json` 是符号链接 | 由链接目标所在的帐号接管 App |
| 未链接 | `auth.json` 是普通文件 | 旧版复制留下的副本，或用户直接在 App 中登录 |
| 空 | 文件不存在 | App 已退出登录 |

帐号的唯一凭据始终在 `~/.codex-<name>/auth.json`。槽位只引用，不持有。

### 4.2 切换流程

`switch_to_pat_account` 保持命令名与参数不变，行为改为：

1. 校验帐号：不能是 `main`；目录与 `auth.json` 必须存在；凭据是 API Key 时返回 `APP_SLOT_API_KEY_UNSUPPORTED`。
2. 如果槽位处于未链接状态，先按 4.3 保全原凭据。
3. 对 `auth.json` 和 `auth-f.json`，以符号链接指向目标账号目录中的同名文件。链接先建到临时名，再用 rename 原子替换。帐号没有 `auth-f.json` 时删除槽位中的同名文件。
4. 读取槽位内容，与帐号文件比对，不一致时返回 `VERIFY_FAILED`。
5. 前端随后照旧重启 ChatGPT.app。

### 4.3 槽位原有凭据的保全

槽位中的普通文件凭据在重新链接前必须被保全，规则依次为：

1. 内容与某个帐号的 `auth.json` 完全相同：不需要处理。
2. 按身份找所属帐号。身份 = `tokens.account_id` 加上 `id_token` 里的用户标识（`chatgpt_user_id`，其次 `user_id`、`sub`、`email`）。团队成员共用 `account_id`，所以必须带上用户标识。
   - 恰好匹配一个帐号：槽位的 `last_refresh` 更新时写回该帐号，否则保留帐号现有内容。
   - 匹配零个或多个帐号：进入下一步。
3. 导入为新帐号 `app-<account_id 末 6 位>`，重名时追加 `-2`、`-3`。导入的帐号与 Session 导入的帐号结构相同（目录、wrapper、受管标记），两种模式下都能使用。槽位中的普通 `auth-f.json` 一并复制。

### 4.4 账号生命周期联动

- 当前接管 App 的账号以槽位链接目标为准。槽位未链接时沿用现有的 `account_id` 后缀匹配。
- 删除或重命名被链接的账号时同步处理槽位链接：删除前移除指向该帐号的槽位链接（App 随之退出登录）；重命名后把链接改指向新目录。

### 4.5 前端行为

- 主窗口和托盘在 PAT 模式下：没有凭据或使用 API Key 的账号不显示可点击的切换按钮，并在提示中说明原因（需先登录 / API 帐号不支持接管 App）。`main` 在托盘中同样不可切换。
- 切换成功的状态文案改为"Codex App now uses <帐号>. Restarting ChatGPT…"。
- 模式切换本身不调用后端凭据操作。

### 4.6 App 当前目标与连接切换

App 当前目标按以下顺序判定，由新的只读查询 `get_app_target` 返回：

| 目标 | 判定 | 返回 |
| --- | --- | --- |
| 外部连接 | Provider Hub 中存在 `profile_id = main` 的绑定 | `provider`，带 provider id 和显示名 |
| 自定义连接 | 无上述绑定，`~/.codex/config.toml` 顶层 `model_provider` 存在且不是 `openai` | `customProvider`，带 provider id |
| 帐号 | 其余情况 | `account`，带按 4.4 识别出的帐号 id；无法识别时为空 |

`switch_to_pat_account` 增加前置检查，命令名与参数不变：

- 目标为外部连接：返回 `APP_SLOT_PROVIDER_ATTACHED`，槽位不变。
- 目标为自定义连接：返回 `APP_SLOT_CUSTOM_PROVIDER`，槽位不变。

前端（PAT 模式下）：

- 概览与托盘显示一行"Codex App: <帐号名或连接名>"。
- 切换 ChatGPT 帐号且目标为外部连接时，弹出确认："Codex App is using <连接名>. Detach it and switch to <帐号>?"，并说明在该连接下产生的对话会变成只读。确认后依次执行 `main` 的 Detach 预览与执行、帐号切换、重启 ChatGPT；任一步失败即停止并显示错误，不继续后续步骤。
- 目标为自定义连接时，切换按钮给出原因（`config.toml` 中有手工设置的 provider），不提供一键处理。
- External API 帐号卡片增加"Use in Codex App"。确认弹窗说明 App 中原有的 OpenAI 对话会变成只读，切回 ChatGPT 帐号后恢复。确认后对 `main` 执行 Attach 预览与执行（provider 为该帐号绑定的 provider，模型为该帐号当前模型），再重启 ChatGPT。App 已在使用该连接时按钮禁用，显示"In use"。
- Attach / Detach 全部复用 Providers 页的既有服务与错误处理，不新增写 `config.toml` 的路径。

## 5. Work packages（工作包）

- **APP-001A 后端槽位**：链接式切换、凭据保全与导入、当前帐号识别、删除和重命名联动。
- **APP-001B 前端入口**：PAT 模式下主窗口与托盘的切换按钮可用性和文案。
- **APP-001C 验收与文档**：真实 App 验收、README 与手工验收清单更新。
- **APP-001D App 目标与连接切换**：`get_app_target` 查询与切换前置检查（后端）；App 目标展示、解除连接后切换、External API 接管 App（前端）。

## 6. Test matrix（测试矩阵）

- 新增 `tests/app_slot_shared_auth.rs`，覆盖：链接建立且经槽位写入落到帐号文件；在帐号之间切换不改动凭据；未知凭据导入及重名；较新凭据写回、较旧凭据不覆盖；团队帐号按用户匹配；API Key 帐号被拒绝且槽位不变；当前帐号按链接识别；删除清除链接；重命名重建链接。
- 更新 `tests/integration_pat_accounts.rs` 与 `account.rs` 内的单元测试，使其断言链接语义而不是复制语义。
- 前端测试覆盖 PAT 模式按钮状态：无凭据帐号、API 帐号、main、当前帐号四种情况，主窗口与托盘各一组。
- 新增 `tests/app_target.rs`，覆盖三类 App 目标的判定，以及目标为外部连接或自定义连接时切换被拒绝且槽位不变。
- 前端测试覆盖 App 目标展示、外部连接下切换帐号的确认与调用顺序（Detach → 切换 → 重启）、Detach 失败时不切换、External API 接管 App 的确认与调用顺序（Attach → 重启）、自定义连接时的原因提示。

## 7. Verification（验证）

- 每个节点运行自己的测试命令；最终 `make check` 全部通过。
- 在真实 Codex App 上验证：切换后 App 可以继续对话；等待或触发一次 token 刷新后，链接仍在且帐号目录文件已更新；同一帐号在 Profile 模式 CLI 中同时可用；App 内退出登录只移除链接；重命名、删除被链接的帐号后 App 状态符合 4.4。
- 本机已有的未链接凭据（当前 App 帐号）在第一次切换后出现为 `app-` 开头的新帐号，并可切回。
- 在真实 App 上验证连接切换：External API 帐号接管 App 后可对话；再切回 ChatGPT 帐号后 App 可对话、原 OpenAI 对话恢复可写；External API 帐号在 Profile 模式 CLI 中全程可用。

## 8. Done criteria（完成标准）

- 所有 todo 节点状态为验证成功，证据写入 `execution-map.json`。
- README 中 PAT 模式的说明与新行为一致。
- 手工验收清单增加 App 接力场景并记录结果。

## 9. Stop conditions（停止条件）

- 真实验收发现 Codex 刷新 token 时替换掉符号链接（槽位变回普通文件）：停止推进，改为评估"复制加写回"方案。
- 任一步骤可能删除或覆盖用户凭据而无法保全：停止并报告。
- 测试需要真实帐号的 token 才能通过：停止，改用假数据或转为手工验收。
- 既有 Attach / Detach 服务拒绝或无法安全处理 `main`（例如需要新增写 `config.toml` 的路径）：停止，回到设计评审。

## 10. Risks and open questions（风险与待确认）

- 在槽位已链接时直接执行不带 `CODEX_HOME` 的 `codex login` 登录另一个帐号，新凭据会写进被链接的帐号文件。App 界面需要先退出登录才能换号，风险较低；README 中提示用户在 LamDock 中添加帐号，而不是对默认目录执行 `codex login`。
- 链接目标使用绝对路径；用户移动 home 目录后链接失效，App 表现为未登录，重新切换即可恢复。
- App 在外部连接与 OpenAI 之间切换时，另一侧产生的对话会变成只读，这是 Codex 的规则，LamDock 只能在确认弹窗中提前说明。
- Detach 成功而随后的帐号切换失败时，App 处于"已回到 OpenAI、仍用原凭据"的状态，可正常使用；错误提示中说明这一点，用户可重试切换。
