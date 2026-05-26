/**
 * pi-neat-ui extension
 *
 * - 美化 Header / Footer / Widget / Working indicator
 * - 默认折叠工具输出：保留调用行 + 结果摘要，隐藏大段细节
 * - /neat-tools：compact / verbose
 * - /neat-style：compact / spacious
 * - /neat-theme：切换已发现主题
 */

import { basename, dirname, join } from "node:path";
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
import { Text, truncateToWidth } from "@earendil-works/pi-tui";

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
type ThinkingLevel = ReturnType<ExtensionAPI["getThinkingLevel"]>;
type StatuslineBlockName = "header" | "directory" | "git" | "runtime" | "meter";

type BuiltInToolDefinitions = ReturnType<typeof createBuiltInToolDefinitions>;

interface RuntimeState {
	activeTools: Map<string, number>;
	lastCompletedTool?: string;
	isStreaming: boolean;
	thinkingLevel: ThinkingLevel;
	startedAt: number;
	requestRender?: () => void;
}

interface TokenTotals {
	input: number;
	output: number;
	cacheRead: number;
	cacheWrite: number;
	cost: number;
}

interface StatuslineSegment {
	text: string;
	block: StatuslineBlockName;
	emphasis?: boolean;
}

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

// Statusline style inspired by @narumitw/pi-statusline (MIT, see NOTICE.md).
const TOKYO_NIGHT_COLORS = {
	lead: "#a3aed2",
	header: { fg: "#090c0c", bg: "#a3aed2" },
	directory: { fg: "#e3e5e5", bg: "#769ff0" },
	git: { fg: "#769ff0", bg: "#394260" },
	runtime: { fg: "#769ff0", bg: "#212736" },
	meter: { fg: "#a0a9cb", bg: "#1d2230" },
	extensionSeparator: "#394260",
};

const STATUSLINE_BLOCK_ORDER: StatuslineBlockName[] = ["header", "directory", "git", "runtime", "meter"];

function ansiStyle(text: string, colors: { fg?: string; bg?: string }) {
	const codes = [
		colors.fg ? trueColorCode("38", colors.fg) : undefined,
		colors.bg ? trueColorCode("48", colors.bg) : undefined,
	].filter((code): code is string => code !== undefined);
	if (codes.length === 0) return text;
	return `\u001b[${codes.join(";")}m${text}\u001b[0m`;
}

function ansiFg(hex: string, text: string) {
	return ansiStyle(text, { fg: hex });
}

function trueColorCode(prefix: "38" | "48", hex: string) {
	const normalized = hex.replace(/^#/, "");
	const red = Number.parseInt(normalized.slice(0, 2), 16);
	const green = Number.parseInt(normalized.slice(2, 4), 16);
	const blue = Number.parseInt(normalized.slice(4, 6), 16);
	return `${prefix};2;${red};${green};${blue}`;
}

function getStatuslineBlockColors(block: StatuslineBlockName) {
	return TOKYO_NIGHT_COLORS[block];
}

function renderStatusline(width: number, ctx: any, footerData: any, runtime: RuntimeState) {
	if (width <= 0) return "";
	const segments = buildStatuslineSegments(ctx, footerData, runtime);
	const blocksByName = new Map<StatuslineBlockName, StatuslineSegment[]>();
	for (const segment of segments) {
		const blockSegments = blocksByName.get(segment.block) ?? [];
		blockSegments.push(segment);
		blocksByName.set(segment.block, blockSegments);
	}

	const blocks = STATUSLINE_BLOCK_ORDER.flatMap((name) => {
		const blockSegments = blocksByName.get(name);
		return blockSegments ? [{ name, segments: blockSegments }] : [];
	});

	let line = ansiFg(TOKYO_NIGHT_COLORS.lead, "░▒▓");
	for (const [index, block] of blocks.entries()) {
		const colors = getStatuslineBlockColors(block.name);
		const previous = index === 0 ? undefined : getStatuslineBlockColors(blocks[index - 1]?.name ?? "header");
		if (previous) line += ansiStyle("", { fg: previous.bg, bg: colors.bg });
		line += ansiStyle(` ${block.segments.map(formatStatuslineSegmentText).join(" ")}`, colors);
	}

	const lastBlock = blocks.at(-1);
	if (lastBlock) line += ansiFg(getStatuslineBlockColors(lastBlock.name).bg, "");
	return truncateToWidth(line, width, "");
}

function buildStatuslineSegments(ctx: any, footerData: any, runtime: RuntimeState): StatuslineSegment[] {
	const totals = getTokenTotals(ctx);
	return [
		{ text: "π", block: "header", emphasis: true },
		{ text: `🤖 ${shortenModel(ctx.model?.id ?? "no-model")}`, block: "header" },
		{ text: `🧠 ${runtime.thinkingLevel}`, block: "header" },
		{ text: `📁 ${basename(ctx.cwd) || ctx.cwd}`, block: "directory" },
		{ text: `🌿 ${footerData.getGitBranch() ?? "no-git"}`, block: "git" },
		{ text: formatToolActivity(runtime), block: "runtime" },
		{ text: formatContextUsage(ctx), block: "runtime" },
		{ text: formatTokenUsage(totals), block: "runtime" },
		{ text: `💸 $${formatCost(totals.cost)}`, block: "meter" },
		{ text: `⏱ ${formatDuration(Date.now() - runtime.startedAt)}`, block: "meter" },
		{ text: `🕒 ${formatTime()}`, block: "meter" },
	];
}

function formatStatuslineSegmentText(segment: StatuslineSegment) {
	return segment.emphasis ? `\u001b[1m${segment.text}\u001b[22m` : segment.text;
}

function renderExtensionStatusline(width: number, footerData: any) {
	const statuses = [...footerData.getExtensionStatuses().entries()]
		.filter(([, value]) => value.trim().length > 0)
		.map(([key, value]) => formatExtensionStatus(key, value))
		.slice(0, 5);
	if (statuses.length === 0) return undefined;
	return truncateToWidth(statuses.join(ansiFg(TOKYO_NIGHT_COLORS.extensionSeparator, " • ")), width, "");
}

function formatExtensionStatus(key: string, value: string) {
	const stripped = value.trim().replace(new RegExp(`^${escapeRegExp(key)}\\s*:\\s*`, "iu"), "");
	const text = truncateToWidth(stripped.replace(/\s+/g, " "), 22, "…");
	return `${ansiFg(TOKYO_NIGHT_COLORS.runtime.fg, "🔌")} ${ansiFg(TOKYO_NIGHT_COLORS.meter.fg, text)}`;
}

function escapeRegExp(value: string) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function formatContextUsage(ctx: any) {
	const usage = ctx.getContextUsage?.();
	return usage?.percent === null || usage?.percent === undefined ? "🪟 ctx ?" : `🪟 ctx ${usage.percent.toFixed(0)}%`;
}

function getTokenTotals(ctx: any): TokenTotals {
	const totals: TokenTotals = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0 };
	for (const entry of ctx.sessionManager.getBranch()) {
		if (entry.type !== "message" || entry.message.role !== "assistant") continue;
		const usage = entry.message.usage as
			| {
					input?: number;
					output?: number;
					cacheRead?: number;
					cacheWrite?: number;
					cost?: { total?: number };
			  }
			| undefined;
		totals.input += usage?.input ?? 0;
		totals.output += usage?.output ?? 0;
		totals.cacheRead += usage?.cacheRead ?? 0;
		totals.cacheWrite += usage?.cacheWrite ?? 0;
		totals.cost += usage?.cost?.total ?? 0;
	}
	return totals;
}

function formatTokenUsage(totals: TokenTotals) {
	const denominator = totals.input + totals.cacheRead + totals.cacheWrite;
	const hitRate = denominator > 0 ? Math.round((totals.cacheRead / denominator) * 100) : 0;
	const parts = [
		`↑${formatCount(totals.input)}`,
		`↓${formatCount(totals.output)}`,
		`R${formatCount(totals.cacheRead)}`,
		`W${formatCount(totals.cacheWrite)}`,
		`⚡${hitRate}%`,
	];
	return `🔢 ${parts.join(" ")}`;
}

function formatCount(value: number) {
	if (value < 1000) return `${value}`;
	if (value < 1_000_000) return `${(value / 1000).toFixed(value < 10_000 ? 1 : 0)}k`;
	return `${(value / 1_000_000).toFixed(1)}m`;
}

function formatCost(value: number) {
	return value.toFixed(value >= 1 ? 2 : 3);
}

function formatDuration(ms: number) {
	const totalSeconds = Math.max(0, Math.floor(ms / 1000));
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;
	if (hours > 0) return `${hours}h${minutes.toString().padStart(2, "0")}m`;
	if (minutes > 0) return `${minutes}m${seconds.toString().padStart(2, "0")}s`;
	return `${seconds}s`;
}

function formatTime() {
	const now = new Date();
	return `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
}

function formatToolActivity(runtime: RuntimeState) {
	const active = [...runtime.activeTools.entries()];
	if (active.length > 0) {
		const [name, count] = active[0] ?? ["tool", 1];
		const suffix = count > 1 ? `×${count}` : active.length > 1 ? `+${active.length - 1}` : "";
		return `⚙ ${name}${suffix}`;
	}
	if (runtime.isStreaming) return "💭 thinking";
	if (runtime.lastCompletedTool) return `✅ ${runtime.lastCompletedTool}`;
	return "💤 idle";
}

function shortenModel(model: string) {
	return model
		.replace(/^claude-/, "")
		.replace(/^gpt-/, "gpt ")
		.replace(/-20\d{6}$/, "")
		.replace(/-latest$/, "");
}

function renderDefaultResult(tool: any, result: any, options: any, theme: any, context: any) {
	return tool.renderResult?.(result, options, theme, context) ?? renderFullText(textResult(result), theme);
}

function compactSummary(theme: any, text: string, color: "success" | "error" | "warning" | "toolOutput" = "toolOutput") {
	return new Text(theme.fg(color, text), 0, 0);
}

function registerBuiltInToolRenderers(pi: ExtensionAPI, isCompact: () => boolean) {
	const defaults = getBuiltInToolDefinitions(process.cwd());

	pi.registerTool({
		...defaults.read,
		async execute(toolCallId, params, signal, onUpdate, ctx) {
			return getBuiltInToolDefinitions(ctx.cwd).read.execute(toolCallId, params, signal, onUpdate, ctx);
		},
		renderResult(result, options, theme, context) {
			if (options.isPartial) return compactSummary(theme, "reading...", "warning");
			if (isCompact() && !options.expanded) {
				const text = textResult(result);
				const count = nonEmptyLineCount(text);
				return compactSummary(theme, count ? `read: ${count} lines` : "read: done");
			}
			return renderDefaultResult(defaults.read, result, options, theme, context);
		},
	});

	pi.registerTool({
		...defaults.bash,
		async execute(toolCallId, params, signal, onUpdate, ctx) {
			return getBuiltInToolDefinitions(ctx.cwd).bash.execute(toolCallId, params, signal, onUpdate, ctx);
		},
		renderResult(result, options, theme, context) {
			if (options.isPartial) return compactSummary(theme, "running...", "warning");
			if (isCompact() && !options.expanded) {
				const lines = nonEmptyLineCount(textResult(result));
				const label = context.isError ? "bash: failed" : "bash: done";
				const color = context.isError ? "error" : "success";
				return new Text(`${theme.fg(color, label)}${theme.fg("dim", ` (${lines} lines)`)}`, 0, 0);
			}
			return renderDefaultResult(defaults.bash, result, options, theme, context);
		},
	});

	pi.registerTool({
		...defaults.edit,
		async execute(toolCallId, params, signal, onUpdate, ctx) {
			return getBuiltInToolDefinitions(ctx.cwd).edit.execute(toolCallId, params, signal, onUpdate, ctx);
		},
		renderResult(result, options, theme, context) {
			if (options.isPartial) return renderDefaultResult(defaults.edit, result, options, theme, context);
			if (isCompact() && !options.expanded) {
				const text = textResult(result);
				const diff = (result.details as { diff?: string } | undefined)?.diff;
				const { additions, removals } = countDiff(diff);
				if (context.isError || text.toLowerCase().includes("error")) return compactSummary(theme, "edit: failed", "error");
				return compactSummary(theme, `edit: applied +${additions}/-${removals}`, "success");
			}
			return renderDefaultResult(defaults.edit, result, options, theme, context);
		},
	});

	pi.registerTool({
		...defaults.write,
		async execute(toolCallId, params, signal, onUpdate, ctx) {
			return getBuiltInToolDefinitions(ctx.cwd).write.execute(toolCallId, params, signal, onUpdate, ctx);
		},
		renderResult(result, options, theme, context) {
			if (options.isPartial) return compactSummary(theme, "writing...", "warning");
			if (isCompact() && !options.expanded) {
				return compactSummary(theme, context.isError ? "write: failed" : "write: done", context.isError ? "error" : "success");
			}
			return renderDefaultResult(defaults.write, result, options, theme, context);
		},
	});

	pi.registerTool({
		...defaults.find,
		async execute(toolCallId, params, signal, onUpdate, ctx) {
			return getBuiltInToolDefinitions(ctx.cwd).find.execute(toolCallId, params, signal, onUpdate, ctx);
		},
		renderResult(result, options, theme, context) {
			if (options.isPartial) return compactSummary(theme, "finding...", "warning");
			if (isCompact() && !options.expanded) {
				return compactSummary(theme, `find: ${nonEmptyLineCount(textResult(result))} matches`);
			}
			return renderDefaultResult(defaults.find, result, options, theme, context);
		},
	});

	pi.registerTool({
		...defaults.grep,
		async execute(toolCallId, params, signal, onUpdate, ctx) {
			return getBuiltInToolDefinitions(ctx.cwd).grep.execute(toolCallId, params, signal, onUpdate, ctx);
		},
		renderResult(result, options, theme, context) {
			if (options.isPartial) return compactSummary(theme, "searching...", "warning");
			if (isCompact() && !options.expanded) {
				return compactSummary(theme, `grep: ${nonEmptyLineCount(textResult(result))} matches`);
			}
			return renderDefaultResult(defaults.grep, result, options, theme, context);
		},
	});

	pi.registerTool({
		...defaults.ls,
		async execute(toolCallId, params, signal, onUpdate, ctx) {
			return getBuiltInToolDefinitions(ctx.cwd).ls.execute(toolCallId, params, signal, onUpdate, ctx);
		},
		renderResult(result, options, theme, context) {
			if (options.isPartial) return compactSummary(theme, "listing...", "warning");
			if (isCompact() && !options.expanded) {
				return compactSummary(theme, `ls: ${nonEmptyLineCount(textResult(result))} entries`);
			}
			return renderDefaultResult(defaults.ls, result, options, theme, context);
		},
	});
}

export default function (pi: ExtensionAPI) {
	let enabled = true;
	let compactTools = true;
	let style: ToolStyle = "compact";
	let preferredTheme = "neon-aurora";
	let statuslineEnabled = true;
	const runtime: RuntimeState = {
		activeTools: new Map(),
		isStreaming: false,
		thinkingLevel: "off",
		startedAt: Date.now(),
	};

	const refreshStatusline = () => runtime.requestRender?.();

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

	function installStatusline(ctx: any) {
		if (!ctx.hasUI || !statuslineEnabled) return;
		ctx.ui.setFooter((tui, _theme, footerData) => {
			runtime.requestRender = () => tui.requestRender();
			const unsubscribeBranch = footerData.onBranchChange(() => tui.requestRender());
			const clock = setInterval(() => tui.requestRender(), 30_000);
			return {
				dispose() {
					unsubscribeBranch();
					clearInterval(clock);
				},
				invalidate() {},
				render(width: number) {
					const lines = [renderStatusline(width, ctx, footerData, runtime)];
					const extensionStatusline = renderExtensionStatusline(width, footerData);
					if (extensionStatusline) lines.push(extensionStatusline);
					return lines;
				},
			};
		});
	}

	function applyBeautify(ctx: any) {
		if (!ctx.hasUI) return;
		applyTheme(ctx);
		installStatusline(ctx);

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
		ctx.ui.setFooter(undefined);
		ctx.ui.setWidget("beauty-above", undefined);
		ctx.ui.setWorkingIndicator();
		runtime.requestRender = undefined;
	}

	pi.on("session_start", async (_event, ctx: any) => {
		runtime.startedAt = Date.now();
		runtime.thinkingLevel = pi.getThinkingLevel();
		if (enabled) applyBeautify(ctx);
	});

	pi.on("session_tree", async (_event, ctx: any) => {
		if (enabled) applyBeautify(ctx);
		refreshStatusline();
	});

	pi.on("session_shutdown", async (_event, ctx: any) => {
		if (ctx.hasUI) ctx.ui.setFooter(undefined);
		runtime.requestRender = undefined;
	});

	pi.on("model_select", () => refreshStatusline());
	pi.on("thinking_level_select", (event: any) => {
		runtime.thinkingLevel = event.level;
		refreshStatusline();
	});
	pi.on("agent_start", () => {
		runtime.isStreaming = true;
		refreshStatusline();
	});
	pi.on("agent_end", () => {
		runtime.isStreaming = false;
		refreshStatusline();
	});
	pi.on("turn_start", () => {
		runtime.isStreaming = true;
		refreshStatusline();
	});
	pi.on("turn_end", () => refreshStatusline());
	pi.on("tool_execution_start", (event: any) => {
		const currentCount = runtime.activeTools.get(event.toolName) ?? 0;
		runtime.activeTools.set(event.toolName, currentCount + 1);
		refreshStatusline();
	});
	pi.on("tool_execution_end", (event: any) => {
		const currentCount = runtime.activeTools.get(event.toolName) ?? 0;
		if (currentCount <= 1) runtime.activeTools.delete(event.toolName);
		else runtime.activeTools.set(event.toolName, currentCount - 1);
		runtime.lastCompletedTool = event.toolName;
		refreshStatusline();
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

	pi.registerCommand("neat-statusline", {
		description: "切换 pi-neat-ui 内置 statusline（含缓存命中率）",
		handler: async (args, ctx: any) => {
			const value = (args || "").trim().toLowerCase();
			if (value === "on") statuslineEnabled = true;
			else if (value === "off") statuslineEnabled = false;
			else statuslineEnabled = !statuslineEnabled;

			if (!ctx.hasUI) return;
			if (statuslineEnabled) {
				installStatusline(ctx);
				ctx.ui.notify("pi-neat-ui statusline 已开启", "info");
			} else {
				ctx.ui.setFooter(undefined);
				runtime.requestRender = undefined;
				ctx.ui.notify("pi-neat-ui statusline 已关闭", "info");
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
