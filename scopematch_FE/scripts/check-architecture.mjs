import { readdir, readFile } from 'node:fs/promises'
import { dirname, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createScanner, LanguageVariant, SyntaxKind } from 'typescript/unstable/ast'

const root = fileURLToPath(new URL('../src/', import.meta.url))
const violations = []
let count = 0
function checkImport(name, layer, path, specifier) {
  const local = specifier.startsWith('.')
  const target = local ? relative(root, resolve(dirname(path), specifier)).split(sep).join('/').split('/')[0] : null
  if (layer === 'domain' && (!local || target !== 'domain')) violations.push(`${name}: domain cannot import ${specifier}`)
  if (layer === 'application' && (!local || !['domain', 'application'].includes(target))) violations.push(`${name}: application cannot import ${specifier}`)
  if (layer === 'api' && (!local || !['domain', 'application', 'api'].includes(target))) violations.push(`${name}: HTTP adapter cannot import ${specifier}`)
  if (target === 'api' && layer !== 'api' && name !== 'main.tsx') violations.push(`${name}: inject the gateway instead of importing ${specifier}`)
}
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = resolve(dir, entry.name)
    if (entry.isDirectory()) { await walk(path); continue }
    if (!/\.tsx?$/.test(entry.name)) continue
    count++
    const name = relative(root, path).split(sep).join('/')
    const layer = name.split('/')[0]
    // Use the installed TypeScript scanner so comments/string contents cannot
    // masquerade as imports. This also handles type-only and dynamic imports.
    const scanner = createScanner(true, LanguageVariant.Standard, await readFile(path, 'utf8'))
    const tokens = []
    for (let kind = scanner.scan(); kind !== SyntaxKind.EndOfFile; kind = scanner.scan()) tokens.push({ kind, text: scanner.getTokenText(), value: scanner.getTokenValue() })
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i], prev = tokens[i - 1], before = tokens[i - 2], next = tokens[i + 1]
      const dynamic = prev?.kind === SyntaxKind.OpenParenToken && (before?.kind === SyntaxKind.ImportKeyword || before?.text === 'require')
      if (t.kind === SyntaxKind.StringLiteral && (prev?.kind === SyntaxKind.FromKeyword || prev?.kind === SyntaxKind.ImportKeyword || dynamic)) checkImport(name, layer, path, t.value)
      if (t.text === 'fetch' && next?.kind === SyntaxKind.OpenParenToken && layer !== 'api') violations.push(`${name}: fetch belongs in the HTTP adapter`)
      if (['domain', 'application'].includes(layer) && ['window', 'document', 'localStorage', 'sessionStorage'].includes(t.text)) violations.push(`${name}: browser APIs cannot enter the inner layers`)
    }
  }
}
await walk(root)
if (violations.length) { console.error(violations.join('\n')); process.exitCode = 1 }
else console.log(`Clean Architecture boundaries passed for ${count} TypeScript files.`)
