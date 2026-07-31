import esbuild from "esbuild";
import { readFile, writeFile } from "node:fs/promises";

const prod = process.argv[2] === "production";

const pptxGenBrowserRuntime = {
  name: "pptxgen-browser-runtime",
  setup(build) {
    build.onLoad({ filter: /pptxgen\.es\.js$/ }, async (args) => {
      const source = await readFile(args.path, "utf8");
      let replacements = 0;
      const contents = source.replace(
        /const isNode = typeof process !== 'undefined'[^\r\n]*;/gu,
        () => {
          replacements += 1;
          return "const isNode = false;";
        }
      );
      if (replacements !== 2) {
        throw new Error(`Expected two PptxGenJS runtime checks, found ${replacements}.`);
      }
      return { contents, loader: "js" };
    });
  }
};

function sanitizeLegacyZipScheduler(source) {
  const dynamicFunctionCount = (source.match(/new\s+Function\s*\(/gu) ?? []).length;
  const dynamicScriptCount = (source.match(/createElement\(\s*["']script["']\s*\)/gu) ?? []).length;
  if (dynamicFunctionCount !== 1 || dynamicScriptCount !== 4) {
    throw new Error(`Unexpected JSZip scheduler source: ${dynamicFunctionCount} dynamic function and ${dynamicScriptCount} script creation(s).`);
  }

  let promiseSchedulers = 0;
  let setImmediateSchedulers = 0;
  let stringCallbacks = 0;
  let contents = source.replace(
    /"document"\s*in\s+t\s*&&\s*"onreadystatechange"\s*in\s+t\.document\.createElement\("script"\)\s*\?\s*function\(\)\s*\{\s*var\s+e\s*=\s*t\.document\.createElement\("script"\);[\s\S]*?t\.document\.documentElement\.appendChild\(e\);?\s*\}\s*:\s*function\(\)\s*\{\s*setTimeout\(u,\s*0\);?\s*\}/gu,
    () => {
      promiseSchedulers += 1;
      return "function() { setTimeout(u, 0); }";
    }
  );
  contents = contents.replace(
    /l\s*&&\s*"onreadystatechange"\s*in\s+l\.createElement\("script"\)\s*\?\s*\(\s*s\s*=\s*l\.documentElement,\s*function\(e\)\s*\{\s*var\s+t\s*=\s*l\.createElement\("script"\);[\s\S]*?s\.appendChild\(t\);?\s*\}\s*\)\s*:\s*function\(e\)\s*\{\s*setTimeout\(c,\s*0,\s*e\);?\s*\}/gu,
    () => {
      setImmediateSchedulers += 1;
      return "function(e) { setTimeout(c, 0, e); }";
    }
  );
  contents = contents.replace(
    /"function"\s*!=\s*typeof\s+e\s*&&\s*\(\s*e\s*=\s*new\s+Function\(\s*""\s*\+\s*e\s*\)\s*\)/gu,
    () => {
      stringCallbacks += 1;
      return '"function" != typeof e && (() => { throw new TypeError("setImmediate callback must be a function"); })()';
    }
  );

  if (promiseSchedulers !== 1 || setImmediateSchedulers !== 1 || stringCallbacks !== 1) {
    throw new Error(`Could not safely replace all JSZip schedulers: ${promiseSchedulers}/${setImmediateSchedulers}/${stringCallbacks}.`);
  }
  if (/\beval\s*\(|new\s+Function\s*\(|createElement\(\s*["']script["']\s*\)/u.test(contents)) {
    throw new Error("JSZip still contains dynamic execution after sanitization.");
  }
  return contents;
}

const safeZipScheduler = {
  name: "safe-zip-scheduler",
  setup(build) {
    build.onLoad({ filter: /[\\/]node_modules[\\/]jszip[\\/]dist[\\/]jszip\.min\.js$/ }, async (args) => ({
      contents: sanitizeLegacyZipScheduler(await readFile(args.path, "utf8")),
      loader: "js"
    }));
  }
};

await esbuild.build({
  bundle: true,
  entryPoints: ["src/main.ts"],
  external: ["obsidian"],
  format: "cjs",
  loader: {
    ".otf": "base64"
  },
  logLevel: "info",
  minify: prod,
  outfile: "main.js",
  platform: "browser",
  plugins: [pptxGenBrowserRuntime, safeZipScheduler],
  sourcemap: prod ? false : "inline",
  target: "es2022",
  treeShaking: true
});

if (prod) {
  const outputPath = "main.js";
  const output = await readFile(outputPath, "utf8");
  await writeFile(outputPath, output.replace(/[ \t]+$/gmu, ""), "utf8");
}
