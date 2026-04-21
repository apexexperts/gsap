import { existsSync } from "node:fs";
import { extname, resolve } from "node:path";
import { defineConfig } from "vite";

const page = (file) => resolve(process.cwd(), file);

const extensionlessHtmlRewrite = () => {
  const rewrite = (req, _res, next) => {
    const url = req.url;

    if (!url) {
      next();
      return;
    }

    const [pathname, search = ""] = url.split("?");

    if (
      pathname !== "/" &&
      !pathname.endsWith("/") &&
      extname(pathname) === "" &&
      existsSync(resolve(process.cwd(), pathname.slice(1), "index.html"))
    ) {
      req.url = `${pathname}/${search ? `?${search}` : ""}`;
    }

    next();
  };

  return {
    name: "extensionless-html-rewrite",
    configureServer(server) {
      server.middlewares.use(rewrite);
    },
    configurePreviewServer(server) {
      server.middlewares.use(rewrite);
    }
  };
};

export default defineConfig({
  plugins: [extensionlessHtmlRewrite()],
  appType: "mpa",
  build: {
    rollupOptions: {
      input: {
        index: page("index.html"),
        about: page("about/index.html"),
        anatomy: page("anatomy/index.html"),
        portfolio: page("portfolio/index.html"),
        portfolioVitalAccess: page("portfolio/vital-access/index.html"),
        portfolioTimeBeing: page("portfolio/time-being/index.html"),
        portfolioLocalMarketNavigator: page("portfolio/local-market-navigator/index.html"),
        portfolioBuiltKindly: page("portfolio/built-kindly/index.html")
      }
    }
  }
});
