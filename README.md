# pi-neat-ui

**English** | [中文](./README.zh-CN.md)

A local **pi** UI polish package: extension + themes.

`pi-neat-ui` provides a polished powerline-style statusline, custom header, hint widget, working indicator, compact tool rendering, and theme presets.

## Features

- Built-in powerline/emoji statusline with the same visual style as `@narumitw/pi-statusline`.
- Cache-aware token segment:
  - `R` shows cache-read tokens;
  - `W` shows cache-write tokens;
  - `⚡` shows approximate cache hit rate.
- Custom startup Header.
- Lightweight editor hint Widget.
- Custom working indicator.
- Compact tool rendering:
  - collapsed mode shows short summaries such as `bash: done (3 lines)` or `grep: 12 matches`;
  - press `Ctrl+O` to expand details when needed.
- Slash commands:
  - `/neat-ui` — toggle the extension UI polish.
  - `/neat-statusline` — toggle the built-in statusline.
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
/neat-statusline         # Toggle built-in statusline
/neat-statusline off     # Restore Pi built-in default footer
/neat-statusline on      # Enable pi-neat-ui statusline
/neat-tools              # Toggle compact/verbose tool rendering
/neat-tools verbose      # Show full tool output
/neat-tools compact      # Show compact summaries
/neat-style              # Toggle compact/spacious layout
/neat-theme              # List available themes
/neat-theme neon-aurora  # Switch to dark theme
/neat-theme paper-dawn   # Switch to light theme
```

## Statusline cache display

When the provider reports prompt-cache usage, the token segment shows cache data:

```text
🔢 ↑423k ↓27k R19.6m ⚡94%
```

- `↑` normal input tokens
- `↓` output tokens
- `R` cache-read tokens
- `W` cache-write tokens, shown only when non-zero
- `⚡` approximate cache hit rate: `cacheRead / (input + cacheRead + cacheWrite)`

If you also have `@narumitw/pi-statusline` or another statusline/footer extension installed, disable one of them to avoid footer override races. `/neat-statusline off` clears pi-neat-ui's footer and restores Pi's built-in default footer; it cannot restore another extension's previous footer.

## `/neat-tools` vs `Ctrl+O`

- `Ctrl+O` is pi's built-in UI-level expand/collapse toggle.
- `/neat-tools` changes this extension's rendering mode.

Recommended workflow:

```text
/neat-tools compact + Ctrl+O when details are needed
```

## Publishing

The repository includes a GitHub Actions workflow for npm publishing.

1. Add an npm automation token as a GitHub repository secret named `NPM_TOKEN`.
2. Bump `package.json` version.
3. Create and push a matching tag, for example:

```bash
npm version patch
git push --follow-tags
```

The workflow validates package contents with `npm pack --dry-run` and publishes tagged versions with npm provenance.

You can also run the workflow manually from GitHub Actions with `publish=true`.

## Notes

`/neat-tools compact` does not affect tool execution. It only changes how tool results are rendered in the TUI.

The statusline renderer is inspired by `@narumitw/pi-statusline`; see [NOTICE.md](./NOTICE.md).
