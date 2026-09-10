import { readFile, readdir, writeFile } from 'node:fs/promises'
import { extname, join, relative, sep } from 'node:path'

const distDirectory = new URL('../dist/', import.meta.url)
const workerFile = new URL('../dist/server/index.js', import.meta.url)
const marker = '/* __EMBEDDED_ASSETS__ */ []'

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml; charset=utf-8',
}

async function collect(directory) {
  const entries = []
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, item.name)
    if (item.isDirectory()) {
      if (item.name !== 'server' && item.name !== '.openai') entries.push(...await collect(path))
      continue
    }

    const extension = extname(item.name)
    const contentType = contentTypes[extension]
    if (!contentType) continue

    const binary = extension === '.png'
    const body = await readFile(path, binary ? 'base64' : 'utf8')
    const assetPath = `/${relative(distDirectory.pathname, path).split(sep).join('/')}`
    entries.push([assetPath, { body, contentType, binary }])
  }
  return entries
}

const worker = await readFile(workerFile, 'utf8')
if (!worker.includes(marker)) throw new Error('Embedded asset marker was not found in the compiled Worker')

const assets = await collect(distDirectory.pathname)
await writeFile(workerFile, worker.replace(marker, () => JSON.stringify(assets)), 'utf8')
console.log(`Embedded ${assets.length} frontend assets in the Worker`)
