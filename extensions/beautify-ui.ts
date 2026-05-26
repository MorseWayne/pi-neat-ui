/**
 * pi-neat-ui extension
 *
 * - 美化 Header / Footer / Widget / Working indicator
 * - 默认折叠工具输出：保留调用行 + 结果摘要，隐藏大段细节
 * - /neat-tools：compact / verbose
 * - /neat-style：compact / spacious
 * - /neat-theme：切换已发现主题
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
	createBashToolDefinition,
	createEditToolDefinition,
	createFindToolDefinition,
	createGrepToolDefinition,
	createLsToolDefinition,
	createReadToolDefinition,
	createWriteToolDefinition,
} from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";

const baseDir = dirname(fileURLToPath(import.meta.url));
const themesDir = join(baseDir, "..", "themes");

const LOGO = [
	"",
	"  ╭─ pi-neat-ui ─╮",
	"  │  UI polish   │",
	"  ╰──────────────╯",
	"",
];

type ToolStyle = "compact" | "spacious";

type BuiltInToolDefinitions = ReturnType<typeof createBuiltInToolDefinitions>;

const toolDefinitionCache = new Map<string, BuiltInToolDefinitions>();

function createBuiltInToolDefinitions(cwd: string) {
	return {
		read: createReadToolDefinition(cwd),
		bash: createBashToolDefinition(cwd),
		edit: createEditToolDefinition(cwd),
		write: createWriteToolDefinition(cwd),
		find: createFindToolDefinition(cwd),
		grep: createGrepToolDefinition(cwd),
		ls: createLsToolDefinition(cwd),
	};
}

function getBuiltInToolDefinitions(cwd: string) {
	let definitions = toolDefinitionCache.get(cwd);
	if (!definitions) {
		definitions = createBuiltInToolDefinitions(cwd);
		toolDefinitionCache.set(cwd, definitions);
	}
	return definitions;
}

function shortenPath(path: string): string {
	const home = process.env.HOME;
	if (home && path.startsWith(home)) {
		return `~${path.slice(home.length) || "/"}`;
	}
	return path || ".";
}

function textResult(result: { content: Array<{ type: string; text?: string }> }) {
	const content = result.content.find((item) => item.type === "text");
	return content?.text ?? "";
}

function nonEmptyLineCount(text: string) {
	return text.split("\n").filter((line) => line.trim().length > 0).length;
}

function renderFullText(text: string, theme: any) {
	if (!text) return new Text("", 0, 0);
	const output = text
		.split("\n")
		.map((line) => theme.fg("toolOutput", line))
		.join("\n");
	return new Text(`\n${output}`, 0, 0);
}

function countDiff(diff: string | undefined) {
	let additions = 0;
	let removals = 0;
	for (const line of (diff ?? "").split("\n")) {
		if (line.startsWith("+") && !line.startsWith("+++")) additions++;
		if (line.startsWith("-") && !line.startsWith("---")) removals++;
	}
	return { additions, removals };
}

function toolHint(theme: any, style: ToolStyle) {
	const pad = style === "spacious" ? "  " : " ";
	return `${pad}${theme.fg("accent", "•")} ${theme.fg("dim", "ctrl+o 展开工具 · /neat-tools · /neat-style · /neat-theme")}`;
}

function buildHeader(theme: any, style: ToolStyle) {
	const color = style === "spacious" ? "toolOutput" : "accent";
	const logo = LOGO.map((line) => (line ? theme.fg(color, line) : line));
	const title = `${theme.fg("accent", "pi-neat-ui")} ${theme.fg("dim", "美化界面 + 主题套件")}`;
	return {
		render() {
			return style === "spacious" ? [...logo, title, ""] : [...logo.slice(1), title];
		},
		invalidate() {},
	};
}

function registerBuiltInToolRenderers(pi: ExtensionAPI, isCompact: () => boolean) {
	const defaults = getBuiltInToolDefinitions(process.cwd());

	pi.registerTool({
		...defaults.read,
		async execute(toolCallId, params, signal, onUpdate, ctx) {
			return getBuiltInToolDefinitions(ctx.cwd).read.execute(toolCallId, params, signal, onUpdate, ctx);
		},
		renderCall(args, theme) {
			let display = theme.fg("accent", shortenPath(args.path || ""));
			if (args.offset !== undefined || args.limit !== undefined) {
				const start = args.offset ?? 1;
				const end = args.limit !== undefined ? start + args.limit - 1 : "";
				display += theme.fg("warning", `:${start}${end ? `-${end}` : ""}`);
			}
			return new Text(`${theme.fg("toolTitle", theme.bold("read"))} ${display}`, 0, 0);
		},
		renderResult(result, { expanded, isPartial }, theme) {
			if (isPartial) return new Text(theme.fg("warning", "reading..."), 0, 0);
			const text = textResult(result);
			if (isCompact() && !expanded) {
				const count = nonEmptyLineCount(text);
				return new Text(theme.fg("toolOutput", count ? `read: ${count} lines` : "read: done"), 0, 0);
			}
			return renderFullText(text, theme);
		},
	});

	pi.registerTool({
		...defaults.bash,
		async execute(toolCallId, params, signal, onUpdate, ctx) {
			return getBuiltInToolDefinitions(ctx.cwd).bash.execute(toolCallId, params, signal, onUpdate, ctx);
		},
		renderCall(args, theme) {
			const command = args.command.length > 96 ? `${args.command.slice(0, 93)}...` : args.command;
			return new Text(`${theme.fg("toolTitle", theme.bold("$"))} ${theme.fg("accent", command)}`, 0, 0);
		},
		renderResult(result, { expanded, isPartial }, theme, context) {
			if (isPartial) return new Text(theme.fg("warning", "running..."), 0, 0);
			const text = textResult(result);
			if (isCompact() && !expanded) {
				const lines = nonEmptyLineCount(text);
				const failed = context.isError;
				const label = failed ? theme.fg("error", "bash: failed") : theme.fg("success", "bash: done");
				return new Text(`${label}${theme.fg("dim", ` (${lines} lines)`)}`, 0, 0);
			}
			return renderFullText(text, theme);
		},
	});

	pi.registerTool({
		...defaults.edit,
		async execute(toolCallId, params, signal, onUpdate, ctx) {
			return getBuiltInToolDefinitions(ctx.cwd).edit.execute(toolCallId, params, signal, onUpdate, ctx);
		},
		renderCall(args, theme) {
			return new Text(`${theme.fg("toolTitle", theme.bold("edit"))} ${theme.fg("accent", shortenPath(args.path || ""))}`, 0, 0);
		},
		renderResult(result, { expanded, isPartial }, theme, context) {
			if (isPartial) return new Text(theme.fg("warning", "editing..."), 0, 0);
			const text = textResult(result);
			if (isCompact() && !expanded) {
				const diff = (result.details as { diff?: string } | undefined)?.diff;
				const { additions, removals } = countDiff(diff);
				if (context.isError || text.toLowerCase().includes("error")) {
					return new Text(theme.fg("error", "edit: failed"), 0, 0);
				}
				const stats = additions || removals ? ` +${additions}/-${removals}` : "";
				return new Text(theme.fg("success", `edit: applied${stats}`), 0, 0);
			}
			return renderFullText(text, theme);
		},
	});

	pi.registerTool({
		...defaults.write,
		async execute(toolCallId, params, signal, onUpdate, ctx) {
			return getBuiltInToolDefinitions(ctx.cwd).write.execute(toolCallId, params, signal, onUpdate, ctx);
		},
		renderCall(args, theme) {
			const lines = String(args.content ?? "").split("\n").length;
			return new Text(
				`${theme.fg("toolTitle", theme.bold("write"))} ${theme.fg("accent", shortenPath(args.path || ""))}${theme.fg("dim", ` (${lines} lines)`)}`,
				0,
				0,
			);
		},
		renderResult(result, { expanded, isPartial }, theme, context) {
			if (isPartial) return new Text(theme.fg("warning", "writing..."), 0, 0);
			const text = textResult(result);
			if (isCompact() && !expanded) {
				return new Text(theme.fg(context.isError ? "error" : "success", context.isError ? "write: failed" : "write: done"), 0, 0);
			}
			return renderFullText(text, theme);
		},
	});

	pi.registerTool({
		...defaults.find,
		async execute(toolCallId, params, signal, onUpdate, ctx) {
			return getBuiltInToolDefinitions(ctx.cwd).find.execute(toolCallId, params, signal, onUpdate, ctx);
		},
		renderCall(args, theme) {
			return new Text(
				`${theme.fg("toolTitle", theme.bold("find"))} ${theme.fg("accent", args.pattern || "")}${theme.fg("dim", ` in ${shortenPath(args.path || ".")}`)}`,
				0,
				0,
			);
		},
		renderResult(result, { expanded, isPartial }, theme) {
			if (isPartial) return new Text(theme.fg("warning", "finding..."), 0, 0);
			const text = textResult(result);
			if (isCompact() && !expanded) {
				return new Text(theme.fg("toolOutput", `find: ${nonEmptyLineCount(text)} matches`), 0, 0);
			}
			return renderFullText(text, theme);
		},
	});

	pi.registerTool({
		...defaults.grep,
		async execute(toolCallId, params, signal, onUpdate, ctx) {
			return getBuiltInToolDefinitions(ctx.cwd).grep.execute(toolCallId, params, signal, onUpdate, ctx);
		},
		renderCall(args, theme) {
			return new Text(
				`${theme.fg("toolTitle", theme.bold("grep"))} ${theme.fg("accent", `/${args.pattern || ""}/`)} ${theme.fg("dim", `in ${shortenPath(args.path || ".")}`)}`,
				0,
				0,
			);
		},
		renderResult(result, { expanded, isPartial }, theme) {
			if (isPartial) return new Text(theme.fg("warning", "searching..."), 0, 0);
			const text = textResult(result);
			if (isCompact() && !expanded) {
				return new Text(theme.fg("toolOutput", `grep: ${nonEmptyLineCount(text)} matches`), 0, 0);
			}
			return renderFullText(text, theme);
		},
	});

	pi.registerTool({
		...defaults.ls,
		async execute(toolCallId, params, signal, onUpdate, ctx) {
			return getBuiltInToolDefinitions(ctx.cwd).ls.execute(toolCallId, params, signal, onUpdate, ctx);
		},
		renderCall(args, theme) {
			return new Text(`${theme.fg("toolTitle", theme.bold("ls"))} ${theme.fg("accent", shortenPath(args.path || "."))}`, 0, 0);
		},
		renderResult(result, { expanded, isPartial }, theme) {
			if (isPartial) return new Text(theme.fg("warning", "listing..."), 0, 0);
			const text = textResult(result);
			if (isCompact() && !expanded) {
				return new Text(theme.fg("toolOutput", `ls: ${nonEmptyLineCount(text)} entries`), 0, 0);
			}
			return renderFullText(text, theme);
		},
	});
}

export default function (pi: ExtensionAPI) {
	let enabled = true;
	let compactTools = true;
	let style: ToolStyle = "compact";
	let preferredTheme = "neon-aurora";

	pi.on("resources_discover", () => ({
		themePaths: [themesDir],
	}));

	registerBuiltInToolRenderers(pi, () => compactTools);

	function applyTheme(ctx: any) {
		if (!ctx.hasUI || !preferredTheme) return;
		if (!ctx.ui.getAllThemes().some((theme: { name: string }) => theme.name === preferredTheme)) return;

		const result = ctx.ui.setTheme(preferredTheme);
		if (!result.success) {
			ctx.ui.notify(`主题应用失败：${result.error}`, "error");
		}
	}

	function setToolMode(ctx: any) {
		if (!ctx.hasUI) return;
		ctx.ui.setToolsExpanded(!compactTools);
	}

	function applyBeautify(ctx: any) {
		if (!ctx.hasUI) return;
		applyTheme(ctx);

		ctx.ui.setHeader((_tui, theme) => buildHeader(theme, style));
		ctx.ui.setWidget("beauty-above", (_tui, theme) => new Text(toolHint(theme, style), 0, 0));
		ctx.ui.setWorkingIndicator({
			frames: [
				ctx.ui.theme.fg("dim", "∙"),
				ctx.ui.theme.fg("muted", "•"),
				ctx.ui.theme.fg("accent", "●"),
				ctx.ui.theme.fg("muted", "•"),
			],
			intervalMs: 140,
		});
		setToolMode(ctx);
	}

	function clearBeautify(ctx: any) {
		if (!ctx.hasUI) return;
		ctx.ui.setHeader(undefined);
		ctx.ui.setWidget("beauty-above", undefined);
		ctx.ui.setWorkingIndicator();
	}

	pi.on("session_start", async (_event, ctx: any) => {
		if (enabled) applyBeautify(ctx);
	});

	pi.registerCommand("neat-ui", {
		description: "切换 pi-neat-ui 界面美化",
		handler: async (_args, ctx: any) => {
			enabled = !enabled;
			if (!ctx.hasUI) return;
			if (enabled) {
				applyBeautify(ctx);
				ctx.ui.notify("pi-neat-ui 已开启", "info");
			} else {
				clearBeautify(ctx);
				ctx.ui.notify("pi-neat-ui 已关闭", "info");
			}
		},
	});

	pi.registerCommand("neat-tools", {
		description: "切换工具输出：compact / verbose",
		handler: async (args, ctx: any) => {
			const value = (args || "").trim().toLowerCase();
			if (value === "compact") compactTools = true;
			else if (value === "verbose") compactTools = false;
			else compactTools = !compactTools;

			if (ctx.hasUI) {
				setToolMode(ctx);
				ctx.ui.notify(`工具模式：${compactTools ? "compact" : "verbose"}`, "info");
			}
		},
	});

	pi.registerCommand("neat-style", {
		description: "切换布局风格：compact / spacious",
		handler: async (args, ctx: any) => {
			const value = (args || "").trim().toLowerCase();
			if (value === "compact") style = "compact";
			else if (value === "spacious") style = "spacious";
			else style = style === "compact" ? "spacious" : "compact";

			if (ctx.hasUI && enabled) {
				ctx.ui.setHeader((_tui, theme) => buildHeader(theme, style));
				ctx.ui.setWidget("beauty-above", (_tui, theme) => new Text(toolHint(theme, style), 0, 0));
				setToolMode(ctx);
				ctx.ui.notify(`布局风格：${style}`, "info");
			}
		},
	});

	pi.registerCommand("neat-theme", {
		description: "切换主题；不带参数时列出可用主题",
		handler: async (args, ctx: any) => {
			if (!ctx.hasUI) return;
			const value = (args || "").trim();
			const themes = ctx.ui.getAllThemes().map((theme: { name: string }) => theme.name);

			if (!value) {
				ctx.ui.notify(`可用主题：${themes.join("、")}`, "info");
				return;
			}

			if (!themes.includes(value)) {
				ctx.ui.notify(`主题不存在：${value}。可用：${themes.join("、")}`, "error");
				return;
			}

			const result = ctx.ui.setTheme(value);
			if (!result.success) {
				ctx.ui.notify(`切换主题失败：${result.error}`, "error");
				return;
			}

			preferredTheme = value;
			ctx.ui.notify(`主题已切换：${value}`, "info");
			if (enabled) applyBeautify(ctx);
		},
	});
}
