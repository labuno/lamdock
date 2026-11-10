# CLD-001-08: Claude 网关绑定、启动与密钥注入

- **Todo ID**: CLD-001-08
- **Execution Map**: docs/todos/CLD-001/execution-map.json
- **Todo maturity**: DECOMPOSED
- **Task detail format**: v1
- **Source baseline**: `docs/CLD-001-claude-agent-support-plan.md` (sha256 ee46f48d077c678ba3911b302f31a6ff208ff293565d73939f10fd1d53894d8d)

## Outcome

Claude 空间可以把 Chat Completions 上游绑定到本地网关：绑定记录带 agent 维度与入站协议，wrapper 注入 `ANTHROPIC_BASE_URL` 与 Keychain 解析出的 token，sidecar 按需启动并健康可用；端到端请求可被网关正确处理。

## Contract

- **Requirements**: `REQ-SCP-04`, `REQ-STP-01`, `REQ-STP-02`, `REQ-STP-06`, `REQ-IF-10`, `REQ-IF-15`, `REQ-WP-D`, `REQ-TM-01`, `REQ-VER-01`, `REQ-VER-03`, `REQ-DONE-02`, `REQ-STOP-04`, `REQ-OBJ-05`
- **Produces**: `artifact:claude-gateway-binding` — agent 维度绑定、Claude 启动链路与 sidecar 监督。
- **Gates**: `cargo test --test claude_gateway_binding`；`make check`。
- **Boundaries**: 既有 Codex 绑定记录必须保持可读；token 只存在于 Keychain 与运行时环境；回环地址只在 127.0.0.1 监听。

## Tasks

- [ ] `T01` 扩展绑定模型与存储（agent 维度、入站协议）。
  - **Test and RED**: 断言新绑定记录包含 `agentId` 与 `inboundProtocol`；读取旧记录（无这些字段）时默认 `agentId=codex` 且不破坏既有行为；Claude 绑定的 token 哈希校验与 Codex 一致。实现前 RED。
  - **Execution logic**: 在 `gateway/binding.rs` 增加带默认值的字段，schema revision 递增但向后兼容；绑定服务按 (profile, provider, agent) 唯一；序列化保持 camelCase；旧记录升级在读取时惰性完成。
  - **Files and responsibilities**: `src/services/gateway/binding.rs` 拥有绑定模型；`tests/claude_gateway_binding.rs` 拥有兼容用例。
  - **Verification**: 正常（新建绑定）、兼容（旧记录读取默认值）、状态（重复绑定幂等）、安全（存储只保存哈希）。
  - **Artifact handoff**: 绑定模型供 T02/T03 与 CLD-001-12 消费。
- [ ] `T02` 实现 Claude wrapper 启动链路与密钥注入。
  - **Test and RED**: 断言 Claude 网关 wrapper 导出 `ANTHROPIC_BASE_URL=http://127.0.0.1:<port>` 与 `ANTHROPIC_AUTH_TOKEN`（由 helper 解析）、`CLAUDE_CONFIG_DIR` 指向空间；helper 缺失或返回空 token 时脚本以非零码退出并输出可操作错误。实现前 RED。
  - **Execution logic**: 复用启动器架构，新增 Claude 渲染分支；wrapper 依次调用 `lam-auth-helper gateway-token`（携带状态根、profile、binding）获取 token 并导出；基址端口来自运行中的网关状态；脚本不落明文 token。
  - **Files and responsibilities**: `src/services/gateway/launch_planner.rs` 拥有渲染；`src/services/claude_spaces.rs` 拥有 wrapper 落盘；`tests/claude_gateway_binding.rs` 拥有脚本断言。
  - **Verification**: 正常（脚本内容）、错误（helper 失败）、安全（无明文 token）、边界（网关未运行时脚本给出明确提示）。
  - **Artifact handoff**: 供用户直接调用 `claude-<name>` 走网关路径。
- [ ] `T03` 实现 sidecar 监督、端口与健康检查的 Claude 维度。
  - **Test and RED**: 断言绑定生效后网关按需启动、健康检查通过、空闲策略与 Codex 一致；停止后端口释放。实现前 RED。
  - **Execution logic**: 复用 `gateway::supervisor` 与 `sidecar` 生命周期，把「需要网关」的条件从「协议是 ChatCompletions」扩展为「协议是 ChatCompletions 或绑定 agent 为 Claude 且入站协议为 anthropic_messages」；健康探针沿用现有签名校验。
  - **Files and responsibilities**: `src/services/gateway/supervisor.rs` 拥有生命周期；`tests/claude_gateway_binding.rs` 拥有启动/停止用例。
  - **Verification**: 正常（按需启动、健康）、状态（重复启动幂等）、错误（二进制缺失返回结构化错误）、并发（多 Claude 绑定共享同一 sidecar）。
  - **Artifact handoff**: 提供可运行的网关，供 T04 与 CLD-001-13 端到端验证。
- [ ] `T04` 端到端：Claude 空间 + 绑定 + 真实请求到 fixture 上游。
  - **Test and RED**: 以临时 LAM home、临时空间与 wiremock Chat Completions 上游运行：断言请求路径为 `/chat/completions`、鉴权头来自绑定 token、响应以 Anthropic SSE 形态返回并被客户端路径消费；未绑定 token 请求被拒绝。实现前 RED。
  - **Execution logic**: 测试夹具启动真实网关进程（或进程内服务器），使用与生产相同的 wrapper 环境变量构造请求；断言上游收到的模型名为映射后的模型；清理所有临时进程与文件。
  - **Files and responsibilities**: `tests/claude_gateway_binding.rs` 拥有端到端用例与夹具。
  - **Verification**: 正常（端到端成功）、错误（错误 token）、状态（绑定撤销后请求失败）、安全（上游请求头不含 Claude 侧凭据）。
  - **Artifact handoff**: 为 CLD-001-14 的手工验收提供自动化基线证据。

## Tests

- `tests/claude_gateway_binding.rs`：绑定兼容、wrapper 注入、supervisor 生命周期、端到端 fixture 请求。
- **RED**: 字段缺失、wrapper 未注入、网关未启动时的失败。

## Done

- [ ] Every task has RED/GREEN evidence and the node Gates pass.
- [ ] Artifact/evidence/status are updated in the execution map.
- [ ] Graph and semantic checks pass.

## STOP conditions

- 绑定模型变更导致既有 Codex 绑定不可读时停止。
- 启动链路需要把 token 写入磁盘或日志时停止。
- 网关端口需要监听非回环地址时停止。
