# pi-neat-ui

一个用于 **pi** 的本地美化插件包：自定义 UI 扩展 + 主题套件。

## 功能

- 自定义 Header：启动徽标与标题。
- 不改 pi 默认 statusline/Footer；保留系统原生 `▒▓ π ...` powerline/emoji 底栏。
- 自定义 Widget / working indicator：更轻的状态提示。
- 默认折叠工具输出：保留工具调用行与结果摘要，隐藏大段细节；按 `ctrl+o` 可展开。
- 内置命令：
  - `/neat-ui`：开关整个美化插件。
  - `/neat-tools`：切换工具输出 `compact` / `verbose`。
  - `/neat-style`：切换布局 `compact` / `spacious`。
  - `/neat-theme`：列出或切换主题。
- 附带主题：
  - `neon-aurora`：深色霓虹风。
  - `paper-dawn`：浅色纸张风。

## 安装 / 加载

### 方式一：项目本地包

把整个 `pi-neat-ui` 文件夹放入项目根目录，配置 `.pi/settings.json`：

```json
{
  "packages": ["./pi-neat-ui"]
}
```

### 方式二：开发阶段直接加载

```bash
pi -e ./pi-neat-ui/extensions/beautify-ui.ts --theme ./pi-neat-ui/themes/neon-aurora.json
```

也可以换浅色主题：

```bash
pi -e ./pi-neat-ui/extensions/beautify-ui.ts --theme ./pi-neat-ui/themes/paper-dawn.json
```

### 方式三：发布后安装

```bash
pi install npm:pi-neat-ui
```

## 使用

启动后默认启用美化与 compact 工具输出。

```text
/neat-ui                 # 开关美化
/neat-tools              # compact/verbose 之间切换
/neat-tools verbose      # 显示完整工具输出
/neat-tools compact      # 折叠为摘要
/neat-style              # compact/spacious 之间切换
/neat-theme              # 列出可用主题
/neat-theme neon-aurora  # 切深色主题
/neat-theme paper-dawn   # 切浅色主题
```

## 说明

`/neat-tools compact` 不会阻止工具执行，只改变 TUI 渲染：默认只展示摘要，需要查看完整输出时按 `ctrl+o` 展开，或输入 `/neat-tools verbose`。

插件不会调用 `ctx.ui.setFooter()`，也不会通过 `ctx.ui.setStatus()` 往默认 statusline 追加状态行。
