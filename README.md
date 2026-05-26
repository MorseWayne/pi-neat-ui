# pi-neat-ui

**English** | [中文](./README.zh-CN.md)

A local **pi** UI polish package: extension + themes.

`pi-neat-ui` keeps pi's default statusline untouched, while improving the surrounding UI with a custom header, hint widget, working indicator, compact tool rendering, and theme presets.

## Features

- Keeps the default pi statusline/Footer unchanged.
  - No `ctx.ui.setFooter()` override.
  - No `ctx.ui.setStatus()` injection into the default statusline.
- Custom startup Header.
- Lightweight editor hint Widget.
- Custom working indicator.
- Compact tool rendering:
  - collapsed mode shows short summaries such as `bash: done (3 lines)` or `grep: 12 matches`;
  - press `Ctrl+O` to expand details when needed.
- Slash commands:
  - `/neat-ui` — toggle the extension UI polish.
  - `/neat-tools` — switch tool rendering between `compact` and `verbose`.
  - `/neat-style` — switch layout density between `compact` and `spacious`.
  - `/neat-theme` — list or switch available themes.
- Included themes:
  - `neon-aurora` — dark neon theme.
  - `paper-dawn` — light paper-like theme.

## Install / Load

### Option 1: Install from GitHub

```bash
pi install github:MorseWayne/pi-neat-ui
```

Then start pi with the theme:

```bash
pi --theme neon-aurora
```

### Option 2: Local project package

Put this folder in your project and configure `.pi/settings.json`:

```json
{
  "packages": ["./pi-neat-ui"]
}
```

### Option 3: Direct development loading

```bash
pi -e ./pi-neat-ui/extensions/beautify-ui.ts --theme ./pi-neat-ui/themes/neon-aurora.json
```

Light theme:

```bash
pi -e ./pi-neat-ui/extensions/beautify-ui.ts --theme ./pi-neat-ui/themes/paper-dawn.json
```

## Usage

The extension is enabled by default after loading.

```text
/neat-ui                 # Toggle UI polish
/neat-tools              # Toggle compact/verbose tool rendering
/neat-tools verbose      # Show full tool output
/neat-tools compact      # Show compact summaries
/neat-style              # Toggle compact/spacious layout
/neat-theme              # List available themes
/neat-theme neon-aurora  # Switch to dark theme
/neat-theme paper-dawn   # Switch to light theme
```

## `/neat-tools` vs `Ctrl+O`

- `Ctrl+O` is pi's built-in UI-level expand/collapse toggle.
- `/neat-tools` changes this extension's rendering mode.

Recommended workflow:

```text
/neat-tools compact + Ctrl+O when details are needed
```

## Notes

`/neat-tools compact` does not affect tool execution. It only changes how tool results are rendered in the TUI.

This extension intentionally does **not** replace pi's default statusline.
