# Todo: 帐号名称保留用户输入大小写

- **Status**: 验证成功
- **Scope**: Add Account 的创建、Session 导入、PAT 上传及 External API 名称输入。
- **Baseline**: 主窗口/托盘参考图首版已实现；后端名称校验仅 trim 和验证字符，不更改大小写。

## Behavior

- 用户输入 ellie、eLlie 或 ELLIE，输入值、预览及提交参数均保留原大小写。
- 对名称输入明确关闭系统自动大写、自动纠正和拼写检查，避免 macOS/WebView 更改标识符。
- 保留现有名称字符、空值和路径校验，不新增 lowercase/uppercase 转换或改变后端合同。

## Test first

App 测试覆盖创建/Session 导入/PAT 输入的浏览器属性与原样预览/提交；API flow 测试覆盖混合大小写和提交参数。
预期 RED 为缺少明确关闭系统自动改写的属性；已有事件处理直接保存原值，不伪造 JS 转换失败。

## Implementation

在现有名称 input 上设置 autoCapitalize=none、autoCorrect=off、spellCheck=false。
不新增字符串规范化工具，不修改账号目录名或已有帐号。

## Done

- [x] 属性 RED 及混合大小写行为测试先行。
- [x] 聚焦/完整前端测试和 lint/build 通过。
- [x] 浏览器确认显示及提交保留输入大小写。

## Evidence

2026-11-02：5 项新增名称测试先因缺少关闭系统改写的属性失败；修复后 64 项聚焦测试通过。
浏览器确认 ellie 输入值、text-transform 和 plan_create_account 参数均原样保留。
API 混合大小写提交、普通创建三种大小写、Session/PAT 输入属性均有测试；现有后端校验不变。
最终验证与截图见 [界面预览](ui-preview.md)。
