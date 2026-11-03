// Builds dist/index.html: one self-contained file (CSS and JS inlined)
// that opens straight from disk, no server needed.
import { build } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const out = await build({
  entryPoints: [new URL('src/ui/app.js', root).pathname],
  bundle: true,
  format: 'iife',
  minify: true,
  write: false,
  target: 'es2019',
});
const js = out.outputFiles[0].text;
const css = await readFile(new URL('css/styles.css', root), 'utf8');
let html = await readFile(new URL('index.html', root), 'utf8');

html = html
  .replace(/<link rel="stylesheet" href="css\/styles.css">/, () => `<style>\n${css}\n</style>`)
  .replace(/<script type="module" src="src\/ui\/app.js"><\/script>/, () => `<script>\n${js.replace(/<\/script/gi, '<\\/script')}\n</script>`);

await mkdir(new URL('dist/', root), { recursive: true });
await writeFile(new URL('dist/index.html', root), html);
console.log(`dist/index.html written (${Math.round(html.length / 1024)} KB)`);
