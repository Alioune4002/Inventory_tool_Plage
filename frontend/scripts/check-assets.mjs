import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const publicDir = path.join(rootDir, "public");
const indexPath = path.join(rootDir, "index.html");
const manifestPath = path.join(publicDir, "manifest.webmanifest");

const assetExts = new Set([".png", ".ico", ".svg", ".webmanifest"]);

function collectIndexAssets() {
  const assets = new Set();
  const raw = fs.readFileSync(indexPath, "utf8");
  const regex = /<(?:link|meta)\b[^>]*(?:href|content)=["']\/([^"']+)["']/gi;
  let match = null;
  while ((match = regex.exec(raw))) {
    const rel = match[1].split("?")[0];
    const ext = path.extname(rel).toLowerCase();
    if (assetExts.has(ext)) {
      assets.add(`/${rel}`);
    }
  }
  return assets;
}

function collectManifestAssets() {
  const assets = new Set();
  if (!fs.existsSync(manifestPath)) {
    return assets;
  }
  const raw = fs.readFileSync(manifestPath, "utf8");
  let data = null;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error("manifest.webmanifest invalide (JSON)");
  }
  const icons = Array.isArray(data?.icons) ? data.icons : [];
  icons.forEach((icon) => {
    if (icon?.src) assets.add(String(icon.src));
  });
  return assets;
}

function checkCaseSensitive(baseDir, relPath) {
  const parts = relPath.split("/").filter(Boolean);
  let current = baseDir;
  for (const part of parts) {
    const entries = fs.readdirSync(current);
    if (entries.includes(part)) {
      current = path.join(current, part);
      continue;
    }
    const insensitive = entries.find((e) => e.toLowerCase() === part.toLowerCase());
    if (insensitive) {
      return {
        status: "case",
        expected: part,
        actual: insensitive,
        dir: current,
      };
    }
    return { status: "missing" };
  }
  return { status: "ok" };
}

function main() {
  if (!fs.existsSync(publicDir)) {
    throw new Error("Dossier public manquant");
  }

  const assets = new Set();
  collectIndexAssets().forEach((a) => assets.add(a));
  collectManifestAssets().forEach((a) => assets.add(a));

  const missing = [];
  const caseIssues = [];

  assets.forEach((asset) => {
    if (!asset.startsWith("/")) return;
    const relPath = asset.replace(/^\//, "");
    const result = checkCaseSensitive(publicDir, relPath);
    if (result.status === "missing") {
      missing.push(asset);
    } else if (result.status === "case") {
      caseIssues.push({ asset, expected: result.expected, actual: result.actual, dir: result.dir });
    }
  });

  if (missing.length || caseIssues.length) {
    console.error("Asset check failed.");
    if (missing.length) {
      console.error("Missing assets:");
      missing.forEach((asset) => console.error(`- ${asset}`));
    }
    if (caseIssues.length) {
      console.error("Case mismatches:");
      caseIssues.forEach((issue) => {
        console.error(`- ${issue.asset} (expected ${issue.expected}, found ${issue.actual})`);
      });
    }
    process.exit(1);
  }

  console.log("Asset check OK.");
}

main();
