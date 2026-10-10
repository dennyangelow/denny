const fs = require('fs')
const path = require('path')

const layout = fs.readFileSync('app/layout.tsx', 'utf8')
const m = layout.match(/\/_next\/static\/media\/([\w.-]+\.woff2)/)
if (!m) {
  console.log('[font-check] Няма ръчен preload в layout.tsx, пропускам.')
  process.exit(0)
}

const cssDir = '.next/static/css'
const css = fs.readdirSync(cssDir)
  .filter(f => f.endsWith('.css'))
  .map(f => fs.readFileSync(path.join(cssDir, f), 'utf8'))
  .join('')

if (css.includes(m[1])) {
  console.log(`[font-check] ✓ Preload ${m[1]} съвпада с build-а.`)
} else {
  console.warn(`[font-check] ⚠ Preload ${m[1]} НЕ е в CSS-а! Намери новото име в .next/static/css (търси U+0400-045F).`)
}