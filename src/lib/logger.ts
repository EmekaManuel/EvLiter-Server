const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";

const FG_BLACK = "\x1b[30m";
const FG_RED = "\x1b[31m";
const FG_GREEN = "\x1b[32m";
const FG_YELLOW = "\x1b[33m";
const FG_BLUE = "\x1b[34m";
const FG_MAGENTA = "\x1b[35m";
const FG_CYAN = "\x1b[36m";
const FG_WHITE = "\x1b[37m";
const FG_GRAY = "\x1b[90m";

function color(text: string, code: string): string {
  return `${code}${text}${RESET}`;
}

export const colors = {
  bold: (t: string) => color(t, BOLD),
  dim: (t: string) => color(t, DIM),
  gray: (t: string) => color(t, FG_GRAY),
  red: (t: string) => color(t, FG_RED),
  green: (t: string) => color(t, FG_GREEN),
  yellow: (t: string) => color(t, FG_YELLOW),
  blue: (t: string) => color(t, FG_BLUE),
  magenta: (t: string) => color(t, FG_MAGENTA),
  cyan: (t: string) => color(t, FG_CYAN),
  white: (t: string) => color(t, FG_WHITE),
  black: (t: string) => color(t, FG_BLACK),
};

export const symbols = {
  info: colors.blue("ℹ"),
  success: colors.green("✔"),
  warn: colors.yellow("⚠"),
  error: colors.red("✖"),
  rocket: colors.magenta("🚀"),
  db: colors.cyan("🗄"),
  api: colors.cyan("📡"),
  inbox: colors.blue("📥"),
};

function prefix(tag: string): string {
  const ts = new Date().toISOString();
  return `${colors.gray(`[${ts}]`)} ${tag}`;
}

export const logger = {
  info: (msg: string, ...rest: unknown[]) =>
    console.log(prefix(colors.blue("INFO")), msg, ...rest),
  success: (msg: string, ...rest: unknown[]) =>
    console.log(prefix(colors.green("OK")), msg, ...rest),
  warn: (msg: string, ...rest: unknown[]) =>
    console.warn(prefix(colors.yellow("WARN")), msg, ...rest),
  error: (msg: string, ...rest: unknown[]) =>
    console.error(prefix(colors.red("ERR")), msg, ...rest),
  http: (method: string, path: string, status: number, ms: number) => {
    const statusColor =
      status >= 500
        ? colors.red
        : status >= 400
        ? colors.yellow
        : status >= 300
        ? colors.cyan
        : colors.green;
    const methodColor =
      method === "GET"
        ? colors.cyan
        : method === "POST"
        ? colors.green
        : method === "PUT"
        ? colors.yellow
        : method === "PATCH"
        ? colors.magenta
        : method === "DELETE"
        ? colors.red
        : colors.white;
    console.log(
      `${prefix(symbols.api)} ${methodColor(method)} ${colors.bold(path)} ` +
        `${colors.gray("→")} ${statusColor(String(status))} ${colors.gray(
          `(${ms.toFixed(1)}ms)`
        )}`
    );
  },
  start: (msg: string) =>
    console.log(prefix(symbols.rocket), colors.magenta(msg)),
  db: (msg: string) => console.log(prefix(symbols.db), colors.cyan(msg)),
};
