// Builds desktop/app/ from the web version (../index.html) so the packaged app runs fully offline:
// Three.js and the web fonts are copied from node_modules instead of loaded from CDNs.
const fs = require('fs'), path = require('path');
const root = __dirname, out = path.join(root, 'app'), nm = path.join(root, 'node_modules');

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'vendor'), { recursive: true });

let html = fs.readFileSync(path.join(root, '..', 'index.html'), 'utf8');
const swap = (re, to, what) => {
  if (!re.test(html)) throw new Error(`build-app: could not find ${what} in index.html`);
  html = html.replace(re, to);
};

// three.js r128 → local copy
fs.copyFileSync(path.join(nm, 'three', 'build', 'three.min.js'), path.join(out, 'vendor', 'three.min.js'));
swap(/<script src="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/three\.js\/r128\/three\.min\.js"><\/script>/,
  '<script src="vendor/three.min.js"></script>', 'the three.js CDN script tag');

// Google Fonts → @fontsource copies (same families and weights)
const fonts = [['barlow-condensed', ['600', '700']], ['ibm-plex-sans-thai', ['400', '600']], ['jetbrains-mono', ['500']]];
const links = [];
for (const [fam, weights] of fonts) {
  const src = path.join(nm, '@fontsource', fam), dst = path.join(out, 'fonts', fam);
  fs.mkdirSync(path.join(dst, 'files'), { recursive: true });
  for (const w of weights) {
    const css = fs.readFileSync(path.join(src, `${w}.css`), 'utf8');
    fs.writeFileSync(path.join(dst, `${w}.css`), css);
    for (const m of css.matchAll(/url\(\.\/files\/([^)]+)\)/g))
      fs.copyFileSync(path.join(src, 'files', m[1]), path.join(dst, 'files', m[1]));
    links.push(`<link rel="stylesheet" href="fonts/${fam}/${w}.css">`);
  }
}
swap(/<link rel="preconnect" href="https:\/\/fonts\.googleapis\.com">\s*<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com\/css2[^"]*">/,
  links.join('\n'), 'the Google Fonts links');

if (/https?:\/\/(?!www\.w3\.org)/.test(html.replace(/<!--[\s\S]*?-->/g, '')))
  console.warn('build-app: index.html still references a remote URL');
fs.writeFileSync(path.join(out, 'index.html'), html);
console.log('build-app: wrote', path.relative(process.cwd(), out));
