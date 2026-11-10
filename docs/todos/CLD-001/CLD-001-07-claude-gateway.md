# CLD-001-07: Anthropic Messages 网关入站与适配

- **Todo ID**: CLD-001-07
- **Execution Map**: docs/todos/CLD-001/execution-map.json
- **Todo maturity**: DECOMPOSED
- **Task detail format**: v1
- **Source baseline**: `docs/CLD-001-claude-agent-support-plan.md` (sha256 ee46f48d077c678ba3911b302f31a6ff208ff293565d73939f10fd1d53894d8d)

## Outcome

本地网关新增 `POST /v1/messages` 与 `POST /v1/messages/count_tokens` 入站契约，并以 `messages_to_chat_completions` 适配器把 Anthropic 请求映射到现有 Chat Completions 上游，流式响应产生合法 Anthropic SSE 事件序列。

## Contract

- **Requirements**: `REQ-SCP-04`, `REQ-STP-01`, `REQ-STP-02`, `REQ-STP-06`, `REQ-IF-12`, `REQ-IF-13`, `REQ-IF-14`, `REQ-WP-D`, `REQ-TM-01`, `REQ-TM-05`, `REQ-VER-01`, `REQ-VER-03`, `REQ-STOP-04`, `REQ-EXT-02`, `REQ-EXT-05`, `REQ-OBJ-05`, `REQ-IF-42`, `REQ-TM-06`, `REQ-TM-07`, `REQ-EXT-08`
- **Produces**: `artifact:anthropic-gateway-route` — 入站路由、错误/认证契约与适配器。
- **Gates**: `cargo test --test claude_gateway_messages`；`make check`。
- **Boundaries**: 既有 `/v1/responses` 与 `/v1/models` 行为不变；未知 token 不产生上游请求；适配器只做协议转换，不做凭据透传或改写模型名以外的上游隐私处理。

## Tasks

- [ ] `T01` 实现入站路由、认证与 Anthropic 错误信封。
  - **Test and RED**: 在 `tests/claude_gateway_messages.rs` 断言：无 token 请求返回 401 且上游零调用；`x-api-key` 与 `Authorization: Bearer` 均可通过；上游 500 映射为 Anthropic 错误信封且 `type` 正确；`/v1/responses` 旧行为快照不变。实现前 RED。
  - **Execution logic**: 在网关路由中加入新路径分派，复用既有绑定 token 校验（哈希比对、过期与撤销检查）；错误映射集中在单一函数；请求日志沿用现有脱敏观测，不记录 prompt 内容。
  - **Files and responsibilities**: `src/services/gateway/routes.rs` 拥有分派；`src/services/gateway/messages.rs` 拥有 Anthropic 入站层；`tests/claude_gateway_messages.rs` 拥有契约测试。
  - **Verification**: 正常（两种认证头）、非法（畸形 JSON、缺少 model）、错误（未绑定 token、过期 token）、安全（日志无 token/prompt）。
  - **Artifact handoff**: `artifact:anthropic-gateway-route` 的入站层，供 T02/T03 与 CLD-001-08 消费。
- [ ] `T02` 实现请求映射（system/messages/tools → Chat Completions）。
  - **Test and RED**: 断言顶层 `system`、多轮 `messages`、`tool_use`/`tool_result` 块被正确转换为 `system` 消息与工具调用/结果消息；`max_tokens`、`temperature`、`stop_sequences` 正确映射。实现前 RED。
  - **Execution logic**: 输入校验顺序为 model → messages 结构 → 工具定义 → 采样参数；文本块与工具块按顺序保序；不支持的内容块返回结构化 400 而不是静默丢弃；映射函数纯函数化便于快照测试。
  - **Files and responsibilities**: `src/services/adapters/anthropic_messages.rs` 拥有映射；`tests/claude_gateway_messages.rs` 拥有映射用例。
  - **Verification**: 正常（文本、工具）、边界（空 content、system 缺失）、非法（未知块类型）、错误（超长/畸形参数）。
  - **Artifact handoff**: 适配器请求侧能力，供 T03 流式响应复用。
- [ ] `T03` 实现流式响应映射与工具调用增量。
  - **Test and RED**: 断言上游 SSE 流被转换为 `message_start`、`content_block_start`、`content_block_delta`、`content_block_stop`、`message_delta`、`message_stop` 序列，工具调用产出 `tool_use` 块与 `input_json_delta`；上游中途断开时流以错误事件结束而不是静默截断。实现前 RED。
  - **Execution logic**: 状态机跟踪当前块索引与类型；文本增量映射为 `text_delta`，工具参数增量映射为 `input_json_delta`；`finish_reason` 映射停止原因（`end_turn`/`tool_use`/`max_tokens`）；结束时统一补 `message_delta` 的 usage 与 `message_stop`；取消连接时释放上游请求。
  - **Files and responsibilities**: `src/services/adapters/anthropic_messages_stream.rs` 拥有状态机；`src/services/adapters/registry.rs` 注册适配器；`tests/claude_gateway_messages.rs` 拥有事件序列测试。
  - **Verification**: 正常（文本流、工具流）、错误（上游断开、上游 4xx）、状态（多轮工具调用）、并发（取消后无悬挂任务）。
  - **Artifact handoff**: 适配器响应侧能力，供 CLD-001-08 端到端验证。
- [ ] `T04` 实现 `count_tokens` 与 usage/错误映射。
  - **Test and RED**: 断言 `count_tokens` 在 Anthropic 兼容上游时透传、在 Chat Completions 上游时返回本地估算并标记近似；usage 字段映射为 `input_tokens`/`output_tokens`；上游 429/5xx 映射为 Anthropic 错误类型。实现前 RED。
  - **Execution logic**: `count_tokens` 优先透传到支持该端点的上游，否则按字符/词元估算并返回 `approx: true` 语义；usage 缺失时省略字段而不是填 0；错误映射表覆盖 400/401/403/404/429/5xx 与超时。
  - **Files and responsibilities**: `src/services/gateway/messages.rs` 拥有 count_tokens；`src/services/adapters/anthropic_messages.rs` 拥有 usage/错误映射；`tests/claude_gateway_messages.rs` 拥有用例。
  - **Verification**: 正常（透传与估算）、错误（各类上游错误码）、边界（空 prompt、超长 prompt）、安全（错误消息不含上游密钥）。
  - **Artifact handoff**: 完成适配器契约，供 CLD-001-08 与 CLD-001-14 端到端验收。

## Tests

- `tests/claude_gateway_messages.rs`：路由/认证/错误信封、请求映射、SSE 事件序列、count_tokens、usage 与错误映射。
- **RED**: 新路由 404、事件序列缺失、工具映射缺失时的失败。

## Done

- [ ] Every task has RED/GREEN evidence and the node Gates pass.
- [ ] Artifact/evidence/status are updated in the execution map.
- [ ] Graph and semantic checks pass.

## STOP conditions

- Anthropic SSE 事件语义与实测/官方文档冲突时停止并更新设计。
- 既有 `/v1/responses` 行为发生回归时停止。
- 适配器需要记录或透出上游密钥才能工作时停止。
