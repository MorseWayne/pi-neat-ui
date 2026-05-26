# pi-neat-ui

[English](./README.md) | **中文**

一个用于 **pi** 的本地 UI 美化包：扩展 + 主题套件。

`pi-neat-ui` 内置 powerline 风格 statusline，同时提供自定义 Header、提示 Widget、working indicator、工具输出紧凑渲染，以及主题预设。

## 功能

- 内置 powerline/emoji statusline，视觉风格保持 `@narumitw/pi-statusline` 的样式。
- 缓存感知 token 段：
  - `R` 表示 cache-read tokens，即使为 0 也显示；
  - `W` 表示 cache-write tokens，即使为 0 也显示；
  - `⚡` 表示近似缓存命中率，即使为 `0%` 也显示。
- 会话持续时间段（`⏱`）。
- 自定义启动 Header。
- 轻量编辑器提示 Widget。
- 自定义 working indicator。
- 工具输出紧凑渲染：
  - 折叠时只显示摘要，例如 `bash: done (3 lines)` 或 `grep: 12 matches`；
  - 展开/verbose 模式回退到 pi 内置渲染器，保留语法/差异高亮；
  - edit 调用使用 pi 内置渲染器，保证动态 diff 预览与增删行数准确；
  - 需要细节时按 `Ctrl+O` 展开。
- 内置命令：
  - `/neat-ui`：开关 UI 美化。
  - `/neat-statusline`：开关内置 statusline。
  - `/neat-tools`：切换工具渲染 `compact` / `verbose`。
  - `/neat-style`：切换布局密度 `compact` / `spacious`。
  - `/neat-theme`：列出或切换可用主题。
- 附带主题：
  - `neon-aurora`：深色霓虹风。
  - `paper-dawn`：浅色纸张风。

## 安装 / 加载

### 方式一：从 GitHub 安装

```bash
pi install github:MorseWayne/pi-neat-ui
```

然后使用主题启动：

```bash
pi --theme neon-aurora
```

### 方式二：项目本地包

把本目录放入项目中，并配置 `.pi/settings.json`：

```json
{
  "packages": ["./pi-neat-ui"]
}
```

### 方式三：开发阶段直接加载

```bash
pi -e ./pi-neat-ui/extensions/beautify-ui.ts --theme ./pi-neat-ui/themes/neon-aurora.json
```

浅色主题：

```bash
pi -e ./pi-neat-ui/extensions/beautify-ui.ts --theme ./pi-neat-ui/themes/paper-dawn.json
```

## 使用

加载后默认启用插件。

```text
/neat-ui                 # 开关美化
/neat-statusline         # 开关内置 statusline
/neat-statusline off     # 恢复 Pi 内置默认 footer
/neat-statusline on      # 启用 pi-neat-ui statusline
/neat-tools              # compact/verbose 之间切换
/neat-tools verbose      # 显示完整工具输出
/neat-tools compact      # 折叠为摘要
/neat-style              # compact/spacious 之间切换
/neat-theme              # 列出可用主题
/neat-theme neon-aurora  # 切深色主题
/neat-theme paper-dawn   # 切浅色主题
```

## Statusline 缓存显示

当 provider 返回 prompt cache usage 时，token 段会显示缓存数据：

```text
🔢 ↑423k ↓27k R19.6m W0 ⚡94%
```

- `↑` 普通输入 token
- `↓` 输出 token
- `R` cache-read tokens，始终显示
- `W` cache-write tokens，始终显示
- `⚡` 近似缓存命中率，始终显示：`cacheRead / (input + cacheRead + cacheWrite)`
- `⏱` 当前 pi UI 会话持续时间，按分钟级显示

如果你同时安装了 `@narumitw/pi-statusline` 或其他 statusline/footer 扩展，建议禁用其中一个，避免多个插件互相覆盖 footer。`/neat-statusline off` 只会清除 pi-neat-ui 的 footer 并恢复 Pi 内置默认 footer，不能恢复另一个扩展之前设置的 footer。

## `/neat-tools` 和 `Ctrl+O` 的区别

- `Ctrl+O` 是 pi 自带的 UI 层展开/折叠开关。
- `/neat-tools` 是插件层的工具渲染模式切换。

推荐用法：

```text
/neat-tools compact + 需要细节时按 Ctrl+O
```

## 发布到 npm

仓库已包含用于 npm 发布的 GitHub Actions workflow。

1. 在 GitHub 仓库中添加 npm automation token，secret 名称为 `NPM_TOKEN`。
2. 提升 `package.json` 版本号。
3. 创建并推送匹配版本号的 tag，例如：

```bash
npm version patch
git push --follow-tags
```

workflow 会用 `npm pack --dry-run` 校验包内容，并在 tag 触发时使用 npm provenance 发布。

也可以在 GitHub Actions 页面手动运行 workflow，并设置 `publish=true`。

## 说明

`/neat-tools compact` 不会影响工具执行，只改变工具结果在 TUI 中的展示方式。

Statusline 渲染灵感来自 `@narumitw/pi-statusline`；详见 [NOTICE.md](./NOTICE.md)。
