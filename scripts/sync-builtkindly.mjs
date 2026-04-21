import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const SITE_ORIGIN = "https://builtkindly.com";
const ROUTES = ["/", "/about", "/anatomy", "/portfolio"];
const RIVE_ASSETS = [
  "/rive/anatomy.riv",
  "/rive/footer.riv",
  "/rive/hero_computer.riv",
  "/rive/hero_crane.riv",
  "/rive/pottery.riv",
  "/rive/ui.riv"
];
const ASSET_PATTERN = /(href|src|data-src)="(\/(?:[^"]+\/)?_payload\.json[^"]*|\/_nuxt\/[^"]+)"/g;
const ROUTE_PATTERN = /href="(\/(?!_nuxt)(?!rive\/)[^"#?]+)"/g;

const ensureDir = async (filePath) => {
  await mkdir(dirname(filePath), { recursive: true });
};

const fetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 (compatible; BuiltKindlyClone/1.0)"
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }

  return response.text();
};

const fetchBuffer = async (url) => {
  const response = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 (compatible; BuiltKindlyClone/1.0)"
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }

  return Buffer.from(await response.arrayBuffer());
};

const routeToFile = (route) => {
  if (route === "/") {
    return "index.html";
  }

  return join(route.slice(1), "index.html");
};

const injectStackShim = (html) => {
  if (html.includes('src="/stack-shim.js"')) {
    return html;
  }

  return html.replace("</body>", '<script type="module" src="/stack-shim.js"></script></body>');
};

const collectPageAssets = (html) => {
  const assets = new Set();

  for (const match of html.matchAll(ASSET_PATTERN)) {
    assets.add(new URL(match[2], SITE_ORIGIN).href);
  }

  return assets;
};

const collectInternalRoutes = (html) => {
  const routes = new Set();

  for (const match of html.matchAll(ROUTE_PATTERN)) {
    const route = match[1];

    if (route === "/" || route.includes(".") || route.startsWith("/mailto:")) {
      continue;
    }

    routes.add(route);
  }

  return routes;
};

const assetUrlToFile = (assetUrl) => {
  const url = new URL(assetUrl);
  return url.pathname.replace(/^\/+/, "");
};

const collectNuxtChunkAssets = (source) => {
  const assets = new Set();
  const depsMatch = source.match(/m\.f\|\|\(m\.f=\[(.*?)\]\)/);

  if (!depsMatch) {
    return assets;
  }

  for (const match of depsMatch[1].matchAll(/"\.\/([^"]+)"/g)) {
    assets.add(new URL(`/_nuxt/${match[1]}`, SITE_ORIGIN).href);
  }

  return assets;
};

const writeFetchedFile = async (assetUrl) => {
  const targetFile = assetUrlToFile(assetUrl);
  const buffer = await fetchBuffer(assetUrl);

  await ensureDir(targetFile);
  await writeFile(targetFile, buffer);

  return targetFile;
};

const syncPages = async () => {
  const pendingRoutes = [...ROUTES];
  const seenRoutes = new Set();
  const discoveredAssets = new Set();

  while (pendingRoutes.length > 0) {
    const route = pendingRoutes.shift();

    if (!route || seenRoutes.has(route)) {
      continue;
    }

    seenRoutes.add(route);

    const html = await fetchText(new URL(route, SITE_ORIGIN));
    const outputFile = routeToFile(route);

    await ensureDir(outputFile);
    await writeFile(outputFile, injectStackShim(html));

    for (const assetUrl of collectPageAssets(html)) {
      discoveredAssets.add(assetUrl);
    }

    for (const linkedRoute of collectInternalRoutes(html)) {
      if (!seenRoutes.has(linkedRoute)) {
        pendingRoutes.push(linkedRoute);
      }
    }
  }

  for (const asset of RIVE_ASSETS) {
    discoveredAssets.add(new URL(asset, SITE_ORIGIN).href);
  }

  return discoveredAssets;
};

const syncAssets = async (assetUrls) => {
  const downloadedFiles = [];

  for (const assetUrl of assetUrls) {
    downloadedFiles.push(await writeFetchedFile(assetUrl));
  }

  return downloadedFiles;
};

const main = async () => {
  const pageAssets = await syncPages();
  const downloadedFiles = await syncAssets(pageAssets);
  const discoveredChunkAssets = new Set();

  for (const file of downloadedFiles) {
    if (!file.endsWith(".js") || !file.startsWith("_nuxt/")) {
      continue;
    }

    const source = await readFile(file, "utf8");

    for (const assetUrl of collectNuxtChunkAssets(source)) {
      discoveredChunkAssets.add(assetUrl);
    }
  }

  const extraAssets = [...discoveredChunkAssets].filter((assetUrl) => !pageAssets.has(assetUrl));
  await syncAssets(extraAssets);
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
