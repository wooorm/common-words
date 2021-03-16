import fs from 'fs'
import path from 'path'

var frequencies = JSON.parse(
  fs.readFileSync(
    path.join(
      process.cwd(),
      'node_modules',
      'subtlex-word-frequencies',
      'index.json'
    )
  )
)

var data = frequencies
  .concat()
  .sort(sort)
  .slice(0, 2 ** 16)
  .map((value) => value.word.toLowerCase())

fs.writeFileSync(
  path.join('src', 'words.js'),
  'export var words = ' + JSON.stringify(data) + '\n'
)

function sort(a, b) {
  return b.count - b.count
}
