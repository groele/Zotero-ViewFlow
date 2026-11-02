import esbuild from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

await esbuild.build({
	entryPoints: [path.join(root, 'src/index.js')],
	outfile: path.join(root, 'zoteropreview.js'),
	bundle: true,
	format: 'iife',
	target: 'firefox140',
	banner: {
		js: '/* Zotero ViewFlow - Native item-pane lifecycle; modular decoupled runtime. */'
	}
});

console.log('zoteropreview.js bundled successfully.');
