/**
 * Generate social media thumbnails from post data.
 * Uses Playwright to render HTML templates into PNG images.
 *
 * Usage:
 *   node generate-thumbnails.mjs                    # Generate all from posts.json
 *   node generate-thumbnails.mjs --single "data"    # Generate one
 */

import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const TEMPLATE_PATH = path.resolve(import.meta.dirname, "../content/templates/thumbnail.html");
const OUTPUT_DIR = path.resolve(import.meta.dirname, "../content/thumbnails");
const POSTS_PATH = path.resolve(import.meta.dirname, "../content/posts/posts.json");

function buildHtml(template, post) {
  return template
    .replace("{{THEME}}", `theme-${post.theme || "scholarship"}`)
    .replace("{{BADGE}}", post.badge || "NEW")
    .replace("{{FLAG}}", post.flag || "🌍")
    .replace("{{HEADLINE}}", post.headline || "OPPORTUNITY")
    .replace("{{SUBHEADLINE}}", post.subheadline || "")
    .replace("{{HIGHLIGHT_VALUE}}", post.highlightValue || "")
    .replace("{{HIGHLIGHT_LABEL}}", post.highlightLabel || "")
    .replace("{{HIGHLIGHT_STYLE}}", post.highlightValue ? "" : "display:none")
    .replace("{{DEADLINE}}", post.deadline || "")
    .replace("{{DEADLINE_STYLE}}", post.deadline ? "" : "display:none");
}

async function generateThumbnail(browser, template, post, outputPath) {
  const html = buildHtml(template, post);
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1080, height: 1080 });
  await page.setContent(html, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  await page.screenshot({ path: outputPath, type: "png" });
  await page.close();
  console.log(`  ✓ ${outputPath}`);
}

async function main() {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const template = fs.readFileSync(TEMPLATE_PATH, "utf-8");
  const posts = JSON.parse(fs.readFileSync(POSTS_PATH, "utf-8"));

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  console.log(`Generating ${posts.length} thumbnails...\n`);

  for (let i = 0; i < posts.length; i++) {
    const post = posts[i];
    const filename = `${String(i + 1).padStart(2, "0")}_${post.id || "post"}.png`;
    const outputPath = path.join(OUTPUT_DIR, filename);
    await generateThumbnail(browser, template, post, outputPath);
  }

  await browser.close();
  console.log("\nDone!");
}

main().catch(console.error);
