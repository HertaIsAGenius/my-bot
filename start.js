const { execSync, spawn } = require("child_process");
const { existsSync, mkdirSync, renameSync, readdirSync, statSync, rmSync, cpSync } = require("fs");
const { join } = require("path");

const cwd = __dirname;
console.log("[Setup] Working in " + cwd);

// 1. Create all needed directories
const dirs = [
  "src", "src/commands", "src/utils", "src/dashboard",
  "src/dashboard/views", "src/dashboard/public",
  "dist", "dist/commands", "dist/utils", "dist/dashboard",
  "data",
];
dirs.forEach((d) => { const p = join(cwd, d); if (!existsSync(p)) mkdirSync(p, { recursive: true }); });

// 2. Check if src/ has any .ts files
const srcFiles = readdirSync(join(cwd, "src")).filter((f) => f.endsWith(".ts"));
if (srcFiles.length === 0) {
  console.log("[Setup] No .ts files in src/ — scanning root for flat uploads...");
  const rootItems = readdirSync(cwd).filter((f) => !["start.js", "node_modules", "data", ".git"].includes(f));
  rootItems.forEach((f) => { const s = statSync(join(cwd, f)); if (s.isFile()) console.log("  Found: " + f); });

  const fileMoves = {
    "index.ejs":   "src/dashboard/views/index.ejs",
    "layout.ejs":  "src/dashboard/views/layout.ejs",
    "header.ejs":  "src/dashboard/views/header.ejs",
    "footer.ejs":  "src/dashboard/views/footer.ejs",
    "todos.ejs":   "src/dashboard/views/todos.ejs",
    "tickets.ejs": "src/dashboard/views/tickets.ejs",
    "logging.ejs": "src/dashboard/views/logging.ejs",
    "slowmode.ejs":"src/dashboard/views/slowmode.ejs",
    "modchannel.ejs":"src/dashboard/views/modchannel.ejs",
    "infractions.ejs":"src/dashboard/views/infractions.ejs",
    "style.css":   "src/dashboard/public/style.css",
    "index.ts":    "src/index.ts",
    "start.ts":    "src/start.ts",
    "commands.ts": "src/commands.ts",
    "kick.ts":     "src/commands/kick.ts",
    "ban.ts":      "src/commands/ban.ts",
    "mute.ts":     "src/commands/mute.ts",
    "warn.ts":     "src/commands/warn.ts",
    "infractions.ts":"src/commands/infractions.ts",
    "ticket.ts":   "src/commands/ticket.ts",
    "todolist.ts": "src/commands/todolist.ts",
    "slowmode.ts": "src/commands/slowmode.ts",
    "logging.ts":  "src/commands/logging.ts",
    "modchannel.ts":"src/commands/modchannel.ts",
    "report.ts":   "src/commands/report.ts",
    "help.ts":     "src/commands/help.ts",
    "stop.ts":     "src/commands/stop.ts",
    "todos.ts":        "src/utils/todos.ts",
    "tickets.ts":      "src/utils/tickets.ts",
    "moderation.ts":   "src/utils/moderation.ts",
    "logs.ts":         "src/utils/logs.ts",
    "slowmodeConfig.ts":"src/utils/slowmodeConfig.ts",
    "autoSlowmode.ts": "src/utils/autoSlowmode.ts",
    "pagination.ts":   "src/utils/pagination.ts",
    "server.ts":       "src/dashboard/server.ts",
    "ticketmessagecreate.ts":"src/commands/ticketmessagecreate.ts",
    "tag.ts":          "src/commands/tag.ts",
    "tags.ts":         "src/utils/tags.ts",
    "rank.ts":         "src/commands/rank.ts",
    "leaderboard.ts":  "src/commands/leaderboard.ts",
    "addxp.ts":        "src/commands/addxp.ts",
    "automod.ts":      "src/commands/automod.ts",
    "automodUtils.ts": "src/utils/automodUtils.ts",
    "stickers.ts":     "src/commands/stickers.ts",
    "stickerCheck.ts": "src/utils/stickerCheck.ts",
    "levels.ts":       "src/utils/levels.ts",
    "embed.ts":        "src/utils/embed.ts",
    "store.ts":        "src/utils/store.ts",
    "ticketConfig.ts": "src/utils/ticketConfig.ts",
    "transcripts.ts":  "src/utils/transcripts.ts",
    "canvas.ts":       "src/utils/canvas.ts",
    "top3.ts":         "src/commands/top3.ts",
    "weekly.ts":       "src/commands/weekly.ts",
    "weeklyreset.ts":  "src/commands/weeklyreset.ts",
    "index.js":        "dist/index.js",
    "commands.js":     "dist/commands.js",
    "ban.js":          "dist/commands/ban.js",
    "kick.js":         "dist/commands/kick.js",
    "mute.js":         "dist/commands/mute.js",
    "warn.js":         "dist/commands/warn.js",
    "infractions.js":  "dist/commands/infractions.js",
    "ticket.js":       "dist/commands/ticket.js",
    "todolist.js":     "dist/commands/todolist.js",
    "slowmode.js":     "dist/commands/slowmode.js",
    "logging.js":      "dist/commands/logging.js",
    "modchannel.js":   "dist/commands/modchannel.js",
    "report.js":       "dist/commands/report.js",
    "help.js":         "dist/commands/help.js",
    "stop.js":         "dist/commands/stop.js",
    "todos.js":        "dist/utils/todos.js",
    "tickets.js":      "dist/utils/tickets.js",
    "infractions.js":  "dist/utils/infractions.js",
    "moderation.js":   "dist/utils/moderation.js",
    "logs.js":         "dist/utils/logs.js",
    "slowmodeConfig.js":"dist/utils/slowmodeConfig.js",
    "autoSlowmode.js": "dist/utils/autoSlowmode.js",
    "pagination.js":   "dist/utils/pagination.js",
    "server.js":       "dist/dashboard/server.js",
    "ticketmessagecreate.js":"dist/commands/ticketmessagecreate.js",
    "tag.js":          "dist/commands/tag.js",
    "tags.js":         "dist/utils/tags.js",
    "rank.js":         "dist/commands/rank.js",
    "leaderboard.js":  "dist/commands/leaderboard.js",
    "addxp.js":        "dist/commands/addxp.js",
    "automod.js":      "dist/commands/automod.js",
    "automodUtils.js": "dist/utils/automodUtils.js",
    "stickers.js":     "dist/commands/stickers.js",
    "stickerCheck.js": "dist/utils/stickerCheck.js",
    "levels.js":       "dist/utils/levels.js",
    "embed.js":        "dist/utils/embed.js",
    "store.js":        "dist/utils/store.js",
    "ticketConfig.js": "dist/utils/ticketConfig.js",
    "transcripts.js":  "dist/utils/transcripts.js",
    "canvas.js":       "dist/utils/canvas.js",
    "top3.js":         "dist/commands/top3.js",
    "weekly.js":       "dist/commands/weekly.js",
    "weeklyreset.js":  "dist/commands/weeklyreset.js",
  };

  let moved = 0;
  readdirSync(cwd).forEach((f) => {
    if (fileMoves[f] && f.endsWith(".ts")) {
      const src = join(cwd, f);
      const dst = join(cwd, fileMoves[f]);
      if (existsSync(src)) {
        const dstDir = join(dst, "..");
        if (!existsSync(dstDir)) mkdirSync(dstDir, { recursive: true });
        renameSync(src, dst);
        console.log("  Moved: " + f + " -> " + fileMoves[f]);
        moved++;
      }
    }
  });
  // Move JS files too (only if src has no .ts — means it's a fresh flat upload)
  readdirSync(cwd).forEach((f) => {
    if (fileMoves[f] && f.endsWith(".js")) {
      const src = join(cwd, f);
      const dst = join(cwd, fileMoves[f]);
      if (existsSync(src)) {
        const dstDir = join(dst, "..");
        if (!existsSync(dstDir)) mkdirSync(dstDir, { recursive: true });
        renameSync(src, dst);
        console.log("  Moved: " + f + " -> " + fileMoves[f]);
        moved++;
      }
    }
  });
  // Move ejs/css
  readdirSync(cwd).forEach((f) => {
    if (fileMoves[f] && (f.endsWith(".ejs") || f.endsWith(".css"))) {
      const src = join(cwd, f);
      const dst = join(cwd, fileMoves[f]);
      if (existsSync(src)) {
        const dstDir = join(dst, "..");
        if (!existsSync(dstDir)) mkdirSync(dstDir, { recursive: true });
        renameSync(src, dst);
        console.log("  Moved: " + f + " -> " + fileMoves[f]);
        moved++;
      }
    }
  });
  if (moved === 0) console.log("[Setup] No flat files to move — checking if files are already in place...");
} else {
  console.log("[Setup] src/ already has " + srcFiles.length + " .ts files");
}

// 3. .env setup
if (!existsSync(join(cwd, ".env")) && existsSync(join(cwd, ".env.example"))) {
  renameSync(join(cwd, ".env.example"), join(cwd, ".env"));
  console.log("[Setup] Renamed .env.example -> .env — EDIT THIS FILE with your tokens!");
}

// 4. Install deps if node_modules missing
if (!existsSync(join(cwd, "node_modules", "discord.js"))) {
  console.log("[Setup] Running npm install...");
  try { execSync("npm install", { cwd, stdio: "inherit", timeout: 120000 }); } catch (e) { console.error("[Setup] npm install failed:", e.message); process.exit(1); }
}
// 5. Clean old dist, recompile, fix sharp
console.log("[Setup] Cleaning old dist...");
try { rmSync(join(cwd, "dist"), { recursive: true, force: true }); } catch {}
console.log("[Setup] Compiling TypeScript...");
let tscCmd = "npx tsc";
try {
  const ver = execSync("npx tsc --version", { cwd }).toString();
  if (ver.includes("Version 6.")) tscCmd = "npx tsc --ignoreDeprecations 6.0";
} catch {}
try { execSync(tscCmd, { cwd, stdio: "inherit" }); } catch (e) { console.error("[Setup] tsc failed:", e.message); process.exit(1); }
// 6. Copy non-TS assets (EJS templates, CSS) to dist
[
  ["src/dashboard/views", "dist/dashboard/views"],
  ["src/dashboard/public", "dist/dashboard/public"],
].forEach(([s, d]) => {
  const src = join(cwd, s), dest = join(cwd, d);
  try {
    if (existsSync(src)) {
      mkdirSync(dest, { recursive: true });
      cpSync(src, dest, { recursive: true });
      console.log("[Setup] Copied " + s + " -> " + d);
    }
  } catch (e) { console.log("[Setup] WARN: couldn't copy " + s + " — dashboard views may not work"); }
});
// 7. Launch
console.log("[Start] Launching bot + dashboard...");
const proc = spawn("node", [join(cwd, "dist", "start.js")], { cwd, stdio: "inherit" });
proc.on("exit", (code) => process.exit(code));
process.on("SIGINT", () => { proc.kill(); process.exit(0); });
process.on("SIGTERM", () => { proc.kill(); process.exit(0); });
