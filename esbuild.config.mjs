import esbuild from "esbuild";

await esbuild.build({
  bundle: true,
  entryPoints: ["src/main.ts"],
  external: ["obsidian"],
  format: "cjs",
  loader: {
    ".otf": "base64"
  },
  logLevel: "info",
  outfile: "main.js",
  platform: "browser",
  sourcemap: false,
  target: "es2022",
  treeShaking: true
});
