'use strict';

var fs = require('fs');
var frequencies = require('subtlex-word-frequencies');

var data = frequencies.concat().sort(sort).slice(0, Math.pow(2, 16)).map(map);

fs.writeFileSync('words.txt', String(data));

function sort(a, b) {
  return b.count - b.count;
}

function map(value) {
  return value.word;
}
