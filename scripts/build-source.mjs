import esbuild from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

await esbuild.build({
	entryPoints: [path.join(root, 'src/index.ts')],
	outfile: path.join(root, 'zoteropreview.js'),
	bundle: true,
	format: 'iife',
	target: 'firefox140',
	charset: 'utf8',
	treeShaking: true,
	minify: false,
	banner: {
		js: '/* Zotero ViewFlow - Native item-pane lifecycle; modular decoupled runtime. */'
	}
});

console.log('zoteropreview.js bundled successfully.');

await esbuild.build({
  entryPoints: [path.join(root, 'src/preferences.ts')],
  outfile: path.join(root, 'zoteropreview_prefs.js'),
  bundle: true, format: 'iife', target: 'firefox140', charset: 'utf8', treeShaking: true, minify: false
});
