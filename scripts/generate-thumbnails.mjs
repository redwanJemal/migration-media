/**
 * Generate social media thumbnails in both English and Amharic.
 * Produces two PNG files per post: *_en.png and *_am.png
 *
 * Usage:
 *   node generate-thumbnails.mjs              # All posts, both languages
 *   node generate-thumbnails.mjs --lang en    # English only
 *   node generate-thumbnails.mjs --lang am    # Amharic only
 */

import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_PATH = path.resolve(SCRIPT_DIR, "../content/templates/thumbnail.html");
const OUTPUT_DIR = path.resolve(SCRIPT_DIR, "../content/thumbnails");
const POSTS_PATH = path.resolve(SCRIPT_DIR, "../content/posts/posts.json");
const AMHARIC_PATH = path.resolve(SCRIPT_DIR, "../content/posts/amharic-thumbnails.json");

function buildHtml(template, post, lang) {
  return template
    .replace("{{LANG_CLASS}}", lang === "am" ? "lang-am" : "")
    .replace("{{THEME}}", `theme-${post.theme || "scholarship"}`)
    .replace("{{BADGE}}", lang === "am" && post.badge_am ? post.badge_am : post.badge || "NEW")
    .replace("{{FLAG}}", post.flag || "🌍")
    .replace("{{HEADLINE}}", lang === "am" && post.headline_am ? post.headline_am : post.headline || "")
    .replace("{{SUBHEADLINE}}", lang === "am" && post.subheadline_am ? post.subheadline_am : post.subheadline || "")
    .replace("{{HIGHLIGHT_VALUE}}", post.highlightValue || "")
    .replace("{{HIGHLIGHT_LABEL}}", lang === "am" && post.highlightLabel_am ? post.highlightLabel_am : post.highlightLabel || "")
    .replace("{{HIGHLIGHT_STYLE}}", post.highlightValue ? "" : "display:none")
    .replace("{{DEADLINE}}", lang === "am" && post.deadline_am ? post.deadline_am : post.deadline || "")
    .replace("{{DEADLINE_STYLE}}", (lang === "am" ? post.deadline_am : post.deadline) ? "" : "display:none");
}

async function generateThumbnail(page, template, post, lang, outputPath, fontBase64) {
  // Replace the @font-face src with inline base64
  let html = buildHtml(template, post, lang);
  html = html.replace(
    "src: url('./fonts/NotoSansEthiopic-Variable.ttf') format('truetype');",
    `src: url(data:font/ttf;base64,${fontBase64}) format('truetype');`
  );
  await page.setContent(html, { waitUntil: "load" });
  await page.waitForTimeout(800);
  await page.screenshot({ path: outputPath, type: "png" });
}

async function main() {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const args = process.argv.slice(2);
  const langFilter = args.includes("--lang") ? args[args.indexOf("--lang") + 1] : null;
  const langs = langFilter ? [langFilter] : ["en", "am"];

  const template = fs.readFileSync(TEMPLATE_PATH, "utf-8");
  const posts = JSON.parse(fs.readFileSync(POSTS_PATH, "utf-8"));
  const amharicData = JSON.parse(fs.readFileSync(AMHARIC_PATH, "utf-8"));

  // Merge Amharic data into posts
  const amharicMap = {};
  for (const am of amharicData) {
    amharicMap[am.id] = am;
  }
  for (const post of posts) {
    const am = amharicMap[post.id];
    if (am) {
      post.badge_am = am.badge_am;
      post.headline_am = am.headline_am;
      post.subheadline_am = am.subheadline_am;
      post.highlightLabel_am = am.highlightLabel_am;
      post.deadline_am = am.deadline_am;
    }
  }

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  // Load Ethiopic font as base64 for inline embedding
  const fontPath = path.resolve(SCRIPT_DIR, "../content/templates/fonts/NotoSansEthiopic-Variable.ttf");
  const fontBase64 = fs.readFileSync(fontPath).toString("base64");
  console.log(`Loaded Ethiopic font (${(fontBase64.length / 1024).toFixed(0)} KB base64)\n`);

  const context = await browser.newContext({ viewport: { width: 1080, height: 1080 } });
  const page = await context.newPage();

  const totalCount = posts.length * langs.length;
  console.log(`Generating ${totalCount} thumbnails (${posts.length} posts × ${langs.length} languages)...\n`);

  for (let i = 0; i < posts.length; i++) {
    const post = posts[i];
    const num = String(i + 1).padStart(2, "0");

    for (const lang of langs) {
      const filename = `${num}_${post.id}_${lang}.png`;
      const outputPath = path.join(OUTPUT_DIR, filename);

      await generateThumbnail(page, template, post, lang, outputPath, fontBase64);
      const label = lang === "am" ? "አማርኛ" : "English";
      console.log(`  ✓ [${label}] ${filename}`);
    }
  }

  await browser.close();
  console.log(`\nDone! Generated ${totalCount} thumbnails.`);
}

main().catch(console.error);
