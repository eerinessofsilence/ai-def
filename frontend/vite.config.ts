import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import type { OutputAsset } from "rollup";
import { fileURLToPath } from "node:url";

function cmsEntry(): Plugin {
  return {
    name: "cms-entry",
    configureServer(server) {
      server.middlewares.use((request, _response, next) => {
        if (request.url && /^\/cms(?:\/|\?|$)/.test(request.url)) request.url = "/cms/index.html";
        next();
      });
    },
  };
}

function inlineEntryCss(): Plugin {
  return {
    name: "inline-entry-css",
    apply: "build",
    enforce: "post",
    generateBundle(_, bundle) {
      const indexHtml = Object.values(bundle).find(
        (chunk): chunk is OutputAsset =>
          chunk.type === "asset" && chunk.fileName === "index.html",
      );

      if (!indexHtml || typeof indexHtml.source !== "string") {
        return;
      }

      let html = indexHtml.source;
      const stylesheetLinks: RegExpMatchArray[] = [
        ...html.matchAll(/<link rel="stylesheet" crossorigin href="([^"]+)">/g),
      ];

      for (const match of stylesheetLinks) {
        const href = match[1];
        const assetPath = href.startsWith("/") ? href.slice(1) : href;
        const cssAsset = bundle[assetPath];

        if (!cssAsset || cssAsset.type !== "asset") {
          continue;
        }

        const cssSource =
          typeof cssAsset.source === "string"
            ? cssAsset.source
            : cssAsset.source.toString();

        html = html.replace(
          match[0],
          `<style>${cssSource.replace(/<\/style/gi, "<\\/style")}</style>`,
        );
      }

      indexHtml.source = html;
    },
  };
}

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [["babel-plugin-react-compiler"]],
      },
    }),
    tailwindcss(),
    cmsEntry(),
    inlineEntryCss(),
  ],
  build: {
    rollupOptions: {
      input: {
        site: fileURLToPath(new URL("./index.html", import.meta.url)),
        cms: fileURLToPath(new URL("./cms/index.html", import.meta.url)),
      },
    },
  },
  server: {
    proxy: {
      "/api/cms/": { target: "http://127.0.0.1:8000" },
      "/media/": { target: "http://127.0.0.1:8000" },
    },
  },
});
