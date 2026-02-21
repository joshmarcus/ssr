/**
 * Screenshot tool — launches the game in headless Chromium via Playwright,
 * dismisses the opening crawl, optionally plays some turns, and captures
 * a screenshot for visual inspection.
 *
 * Usage:
 *   npx tsx screenshot.ts                    # default seed, screenshot after crawl
 *   npx tsx screenshot.ts --seed 42          # specific seed
 *   npx tsx screenshot.ts --turns 20         # auto-explore 20 turns then screenshot
 *   npx tsx screenshot.ts --overlay journal   # open journal overlay then screenshot
 *   npx tsx screenshot.ts --overlay hub       # open investigation hub then screenshot
 *   npx tsx screenshot.ts --overlay help      # open help overlay then screenshot
 *   npx tsx screenshot.ts --overlay gameover  # play to completion then screenshot
 *   npx tsx screenshot.ts --out my_shot.png  # custom output filename
 *   npx tsx screenshot.ts --width 1280 --height 800  # custom viewport (default: 1280x800)
 */

import { chromium } from "playwright";
import { spawn, type ChildProcess } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Parse CLI args ──────────────────────────────────────────
function parseArgs(): {
  seed: number;
  turns: number;
  overlay: string;
  out: string;
  width: number;
  height: number;
  difficulty: string;
  mode3d: boolean;
} {
  const args = process.argv.slice(2);
  const opts = {
    seed: 184201,
    turns: 0,
    overlay: "",
    out: "screenshot.png",
    width: 1280,
    height: 800,
    difficulty: "normal",
    mode3d: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--seed": opts.seed = parseInt(args[++i], 10); break;
      case "--turns": opts.turns = parseInt(args[++i], 10); break;
      case "--overlay": opts.overlay = args[++i]; break;
      case "--out": opts.out = args[++i]; break;
      case "--width": opts.width = parseInt(args[++i], 10); break;
      case "--height": opts.height = parseInt(args[++i], 10); break;
      case "--difficulty": opts.difficulty = args[++i]; break;
      case "--3d": opts.mode3d = true; break;
    }
  }
  return opts;
}

// ── Start Vite dev server ───────────────────────────────────
async function startVite(): Promise<{ proc: ChildProcess; url: string }> {
  return new Promise((resolve, reject) => {
    const proc = spawn("npx", ["vite", "--port", "5198"], {
      cwd: __dirname,
      shell: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let output = "";
    const timeout = setTimeout(() => {
      reject(new Error("Vite did not start within 30s"));
      proc.kill();
    }, 30000);

    const checkForUrl = () => {
      // Strip ANSI escape codes before matching
      const clean = output.replace(/\x1b\[[0-9;]*m/g, "");
      const match = clean.match(/Local:\s+(http:\/\/localhost:\d+\S*)/);
      if (match) {
        clearTimeout(timeout);
        // Extract base URL (strip trailing path like /ssr/)
        const baseUrl = match[1].replace(/\/+$/, "");
        resolve({ proc, url: baseUrl });
      }
    };

    proc.stdout!.on("data", (data: Buffer) => {
      output += data.toString();
      checkForUrl();
    });

    proc.stderr!.on("data", (data: Buffer) => {
      output += data.toString();
      checkForUrl();
    });

    proc.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

// ── Main ────────────────────────────────────────────────────
async function main(): Promise<void> {
  const opts = parseArgs();
  console.log(`[screenshot] seed=${opts.seed} turns=${opts.turns} overlay=${opts.overlay || "none"} out=${opts.out}`);

  // Start Vite
  console.log("[screenshot] Starting Vite dev server...");
  const { proc: viteProc, url: viteUrl } = await startVite();
  console.log(`[screenshot] Vite running at ${viteUrl}`);

  try {
    // Launch browser
    const browser = await chromium.launch({
      headless: true,
      args: ['--enable-webgl', '--use-gl=swiftshader'],
    });
    const context = await browser.newContext({
      viewport: { width: opts.width, height: opts.height },
    });
    const page = await context.newPage();

    // Capture console errors/warnings from the browser
    page.on("console", (msg) => {
      if (msg.type() === "error" || msg.type() === "warning") {
        console.log(`[browser ${msg.type()}] ${msg.text()}`);
      }
    });

    // Navigate to game with seed (Vite base is /ssr/, root is src/)
    // Ensure trailing slash on base URL so query params work
    const baseUrl = viteUrl.endsWith("/") ? viteUrl : viteUrl + "/";
    const gameUrl = `${baseUrl}?seed=${opts.seed}&difficulty=${opts.difficulty}`;
    console.log(`[screenshot] Loading ${gameUrl}`);
    await page.goto(gameUrl, { waitUntil: "networkidle" });

    // Debug: log page title and check if there are any errors
    const title = await page.title();
    console.log(`[screenshot] Page title: "${title}"`);

    // Wait for the crawl overlay to be visible
    await page.waitForSelector("#crawl-overlay", { state: "visible", timeout: 10000 });
    console.log("[screenshot] Opening crawl visible, dismissing...");

    // Wait a moment for the crawl text to start typing, then press a key to skip
    await page.waitForTimeout(500);
    await page.keyboard.press("Space");

    // Wait for the crawl to disappear and the game to render
    await page.waitForSelector("#crawl-overlay", { state: "hidden", timeout: 10000 });
    console.log("[screenshot] Game started.");

    // Wait for ROT.js canvas to render
    await page.waitForTimeout(300);

    // Toggle 3D mode if requested
    if (opts.mode3d) {
      console.log("[screenshot] Switching to 3D mode (F3)...");
      // First move once to clear any pending state
      await page.keyboard.press(".");
      await page.waitForTimeout(200);
      // Try multiple dispatch methods to trigger F3 (wrapped in try/catch for crash resilience)
      let has3d = false;
      try {
        // Method 1: Click container to focus, then F3 (most reliable)
        await page.click("#game-container").catch(() => {});
        await page.waitForTimeout(300);
        await page.keyboard.press("F3");
        await page.waitForTimeout(4000);
        has3d = await page.evaluate(() => {
          return document.querySelector('.mode-3d') !== null ||
                 document.querySelectorAll('canvas').length > 1;
        });
        console.log(`[screenshot] 3D active after click+F3: ${has3d}`);

        if (!has3d) {
          // Method 2: synthetic keydown dispatch
          console.log("[screenshot] Retrying: synthetic dispatch...");
          await page.evaluate(() => {
            const ev = new KeyboardEvent("keydown", { key: "F3", code: "F3", bubbles: true, cancelable: true });
            window.dispatchEvent(ev);
          });
          await page.waitForTimeout(4000);
          has3d = await page.evaluate(() => {
            return document.querySelector('.mode-3d') !== null ||
                   document.querySelectorAll('canvas').length > 1;
          });
          console.log(`[screenshot] 3D active after dispatch: ${has3d}`);
        }

        if (has3d) {
          console.log("[screenshot] 3D mode activated! Waiting for scene to load...");
          // Wait for models to load, but not too long to avoid crashes
          await page.waitForTimeout(12000);
        } else {
          console.log("[screenshot] WARNING: Could not activate 3D mode");
        }
      } catch (e) {
        console.log(`[screenshot] 3D toggle error (page may have crashed): ${e}`);
        console.log("[screenshot] Continuing with 2D screenshot...");
      }
    }

    // Auto-explore for N turns if requested
    if (opts.turns > 0) {
      console.log(`[screenshot] Auto-exploring for ${opts.turns} turns...`);
      // Press Tab to start auto-explore
      await page.keyboard.press("Tab");
      // Wait for the auto-explore to complete the requested turns
      // Each step is ~80ms, so turns * 100ms gives some buffer
      const waitMs = Math.min(opts.turns * 100, 30000);
      await page.waitForTimeout(waitMs);
      // Stop auto-explore
      await page.keyboard.press("Escape");
      await page.waitForTimeout(200);
    }

    // Open overlay if requested
    switch (opts.overlay) {
      case "journal":
        console.log("[screenshot] Opening journal overlay...");
        await page.keyboard.press("j");
        await page.waitForTimeout(300);
        break;
      case "hub":
        console.log("[screenshot] Opening investigation hub...");
        await page.keyboard.press("v");
        await page.waitForTimeout(300);
        break;
      case "help":
        console.log("[screenshot] Opening help overlay...");
        await page.keyboard.press("?");
        await page.waitForTimeout(300);
        break;
      case "incident":
        console.log("[screenshot] Opening incident card...");
        await page.keyboard.press("g");
        await page.waitForTimeout(300);
        break;
      case "map":
        console.log("[screenshot] Opening map overlay...");
        await page.keyboard.press("m");
        await page.waitForTimeout(300);
        break;
      case "gameover":
        console.log("[screenshot] Playing to game-over (this may take a while)...");
        // Auto-explore aggressively until game ends
        for (let i = 0; i < 600; i++) {
          await page.keyboard.press("Tab");
          await page.waitForTimeout(50);
          // Check if game-over overlay appeared
          const gameOver = await page.$("#gameover-overlay.active");
          if (gameOver) break;
          // Try moving right as fallback
          await page.keyboard.press("l");
          await page.waitForTimeout(50);
        }
        await page.waitForTimeout(500);
        break;
    }

    // Take screenshot
    const outPath = path.resolve(__dirname, opts.out);
    await page.screenshot({ path: outPath, fullPage: false });
    console.log(`[screenshot] Saved to ${outPath}`);

    await browser.close();
  } finally {
    viteProc.kill();
    console.log("[screenshot] Vite server stopped.");
  }
}

main().catch((err) => {
  console.error("[screenshot] Error:", err);
  process.exit(1);
});
