/**
 * @typedef Frequency
 * @property {string} word
 * @property {number} count
 */

import fs from 'node:fs/promises'

/**
 * @type {Array<Frequency>}
 */
const frequencies = JSON.parse(
  String(
    await fs.readFile(
      new URL(
        'node_modules/subtlex-word-frequencies/index.json',
        import.meta.url
      )
    )
  )
)

const data = frequencies
  .concat()
  .sort(sort)
  .slice(0, 2 ** 16)
  .map((value) => value.word.toLowerCase())

await fs.writeFile(
  new URL('src/words.js', import.meta.url),
  [
    '/**',
    ' * @typedef Frequency',
    ' * @property {string} word',
    ' * @property {number} count',
    ' */',
    '',
    'export const words = ' + JSON.stringify(data),
    ''
  ].join('\n')
)

/**
 * @param {Frequency} a
 * @param {Frequency} b
 * @returns {number}
 */
function sort(a, b) {
  return b.count - b.count
}
