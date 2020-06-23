'use strict'

var fs = require('fs')
var path = require('path')
var frequencies = require('subtlex-word-frequencies')

var data = frequencies.concat().sort(sort).slice(0, Math.pow(2, 16)).map(map)

fs.writeFileSync(path.join('src', 'words.txt'), String(data))

function sort(a, b) {
  return b.count - b.count
}

function map(value) {
  return value.word.toLowerCase()
}
