// Builds www/ for the Android app and dist/dosewell.html (one self-contained file for a browser preview).
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, rmSync } from 'node:fs';
const font = 'node_modules/@fontsource-variable/plus-jakarta-sans/files/plus-jakarta-sans-latin-wght-normal.woff2';
const CSP = `<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'">`;
rmSync('www', { recursive: true, force: true }); mkdirSync('www', { recursive: true }); mkdirSync('dist', { recursive: true });
const out = await build({ entryPoints: ['src/app.js'], bundle: true, format: 'iife', minify: true, target: ['chrome80'], write: false, legalComments: 'none' });
const js = out.outputFiles[0].text;
const css = readFileSync('src/styles.css', 'utf8');
const html = readFileSync('src/index.html', 'utf8');
writeFileSync('www/app.js', js);
writeFileSync('www/styles.css', css.replace('__FONT__', 'jakarta.woff2'));
copyFileSync(font, 'www/jakarta.woff2');
writeFileSync('www/index.html', html.replace('<!--CSP-->', CSP).replace('<!--STYLE-->', '<link rel="stylesheet" href="styles.css">').replace('<!--SCRIPT-->', '<script src="app.js"></script>'));
const b64 = readFileSync(font).toString('base64');
writeFileSync('dist/dosewell.html', html.replace('<!--CSP-->', '').replace('<!--STYLE-->', () => '<style>' + css.replace('__FONT__', 'data:font/woff2;base64,' + b64) + '</style>').replace('<!--SCRIPT-->', () => '<script>' + js.replace(/<\/script/gi, '<\\/script') + '</script>'));
console.log('built www/ (' + Math.round(js.length / 1024) + ' KB js) and dist/dosewell.html');
