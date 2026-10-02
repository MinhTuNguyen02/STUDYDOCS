import { readdir, stat } from 'node:fs/promises'
import path from 'node:path'

const assetsDirectory = path.resolve(import.meta.dirname, '../dist/assets')
const files = await readdir(assetsDirectory)
const javascriptFiles = files.filter((file) => file.endsWith('.js'))
const sizes = await Promise.all(
  javascriptFiles.map(async (file) => ({ file, bytes: (await stat(path.join(assetsDirectory, file))).size })),
)

const oversized = sizes.filter(({ bytes }) => bytes > 550 * 1024)
const entry = sizes.find(({ file }) => /^index-.*\.js$/.test(file))

if (!entry) throw new Error('Unable to find the frontend entry chunk.')
if (entry.bytes > 500 * 1024) {
  throw new Error(`Entry chunk exceeds 500 KiB: ${entry.file} (${Math.ceil(entry.bytes / 1024)} KiB)`)
}
if (oversized.length > 0) {
  throw new Error(
    `Route/vendor chunk exceeds 550 KiB: ${oversized.map(({ file, bytes }) => `${file} (${Math.ceil(bytes / 1024)} KiB)`).join(', ')}`,
  )
}

console.log(`Bundle budget passed: entry ${Math.ceil(entry.bytes / 1024)} KiB; ${sizes.length} JS chunks checked.`)
