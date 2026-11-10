# APP-001 Codex App 帐号接力（共享凭据槽位）计划

- **状态**: 待评审
- **分支**: `agent/20261110-app-slot-shared-auth`
- **任务图**: [`todos/APP-001/README.md`](todos/APP-001/README.md)

## 1. Objective（目标）

PAT 模式的目的是在某个帐号额度用完后，切换到另一个帐号，继续用 Codex App 接力同一类工作。
目标：任意一个已登录 ChatGPT 的账号，都可以随时接管 Codex App；同一帐号同时在 Profile 模式的 CLI 中使用时，两边都不会因凭据冲突掉线。

帐号无论是在 Profile 模式还是 PAT 模式下登录或添加的，在两种模式下都能使用。切换 LamDock 的模式只改变界面上提供的操作，不改动任何凭据。

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

范围外与限制：

- API Key 账号不能接管 Codex App；它们继续在 Profile 模式下使用，避免 App 的 provider 变化导致已有对话只读。
- 不修改 `~/.codex/config.toml`，App 的 provider、模型与项目信任设置保持原样。
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

## 5. Work packages（工作包）

- **APP-001A 后端槽位**：链接式切换、凭据保全与导入、当前帐号识别、删除和重命名联动。
- **APP-001B 前端入口**：PAT 模式下主窗口与托盘的切换按钮可用性和文案。
- **APP-001C 验收与文档**：真实 App 验收、README 与手工验收清单更新。

## 6. Test matrix（测试矩阵）

- 新增 `tests/app_slot_shared_auth.rs`，覆盖：链接建立且经槽位写入落到帐号文件；在帐号之间切换不改动凭据；未知凭据导入及重名；较新凭据写回、较旧凭据不覆盖；团队帐号按用户匹配；API Key 帐号被拒绝且槽位不变；当前帐号按链接识别；删除清除链接；重命名重建链接。
- 更新 `tests/integration_pat_accounts.rs` 与 `account.rs` 内的单元测试，使其断言链接语义而不是复制语义。
- 前端测试覆盖 PAT 模式按钮状态：无凭据帐号、API 帐号、main、当前帐号四种情况，主窗口与托盘各一组。

## 7. Verification（验证）

- 每个节点运行自己的测试命令；最终 `make check` 全部通过。
- 在真实 Codex App 上验证：切换后 App 可以继续对话；等待或触发一次 token 刷新后，链接仍在且帐号目录文件已更新；同一帐号在 Profile 模式 CLI 中同时可用；App 内退出登录只移除链接；重命名、删除被链接的帐号后 App 状态符合 4.4。
- 本机已有的未链接凭据（当前 App 帐号）在第一次切换后出现为 `app-` 开头的新帐号，并可切回。

## 8. Done criteria（完成标准）

- 所有 todo 节点状态为验证成功，证据写入 `execution-map.json`。
- README 中 PAT 模式的说明与新行为一致。
- 手工验收清单增加 App 接力场景并记录结果。

## 9. Stop conditions（停止条件）

- 真实验收发现 Codex 刷新 token 时替换掉符号链接（槽位变回普通文件）：停止推进，改为评估"复制加写回"方案。
- 任一步骤可能删除或覆盖用户凭据而无法保全：停止并报告。
- 测试需要真实帐号的 token 才能通过：停止，改用假数据或转为手工验收。

## 10. Risks and open questions（风险与待确认）

- 在槽位已链接时直接执行不带 `CODEX_HOME` 的 `codex login` 登录另一个帐号，新凭据会写进被链接的帐号文件。App 界面需要先退出登录才能换号，风险较低；README 中提示用户在 LamDock 中添加帐号，而不是对默认目录执行 `codex login`。
- 链接目标使用绝对路径；用户移动 home 目录后链接失效，App 表现为未登录，重新切换即可恢复。
