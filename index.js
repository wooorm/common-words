var fs = require('fs');
var doc = require('global/document');
var win = require('global/window');
var createElement = require('virtual-dom/create-element');
var diff = require('virtual-dom/diff');
var patch = require('virtual-dom/patch');
var h = require('virtual-dom/h');
var unified = require('unified');
var english = require('retext-english');
var normalize = require('nlcst-normalize');
var debounce = require('debounce');
var xtend = require('xtend');

var words = fs.readFileSync('words.txt', 'utf8').split(',');

var offset = 7;
var min = 3;
var processor = unified().use(english);
var root = doc.getElementById('root');
var tree = render(doc.getElementsByTagName('template')[0].innerHTML);
var dom = root.appendChild(createElement(tree));

doc.getElementsByTagName('aside')[0].appendChild(createElement(list()));

function onchange(ev) {
  var next = render(ev.target.value);
  dom = patch(dom, diff(tree, next));
  tree = next;
}

function resize() {
  dom.lastChild.rows = rows(dom.firstChild);
}

function render(text) {
  var tree = processor.runSync(processor.parse(text));
  var change = debounce(onchange, 4);
  var key = 0;

  setTimeout(resize, 4);

  return h('div', {key: 'editor', className: 'editor'}, [
    h('div', {key: 'draw', className: 'draw'}, pad(all(tree, []))),
    h('textarea', {
      key: 'area',
      value: text,
      oninput: change,
      onpaste: change,
      onkeyup: change,
      onmouseup: change
    })
  ]);

  function all(node, parentIds) {
    var children = node.children;
    var length = children.length;
    var index = -1;
    var results = [];

    while (++index < length) {
      results = results.concat(one(children[index], parentIds.concat(index)));
    }

    return results;
  }

  function one(node, parentIds) {
    var result = 'value' in node ? node.value : all(node, parentIds);
    var attrs = attributes(node);
    var id = parentIds.join('-') + '-' + key;

    if (attrs) {
      result = h('span', xtend({key: id, id: id}, attrs), result);
      key++;
    }

    return result;
  }

  /* Trailing white-space in a `textarea` is shown, but not in a `div`
   * with `white-space: pre-wrap`. Add a `br` to make the last newline
   * explicit. */
  function pad(nodes) {
    var tail = nodes[nodes.length - 1];

    if (typeof tail === 'string' && tail.charAt(tail.length - 1) === '\n') {
      nodes.push(h('br', {key: 'break'}));
    }

    return nodes;
  }
}

function attributes(node) {
  var value;
  var scale;

  if (node.type === 'WordNode') {
    value = normalize(node, {allowApostrophes: true}).toLowerCase();
    scale = cap(Math.floor(Math.log(words.indexOf(value)) / Math.log(2)) - offset);

    if (scale) {
      return {style: {backgroundColor: color(scale)}};
    }
  }
}

function list() {
  var index = offset + min - 1;
  var nodes = [];
  var prev = 0;
  var val;
  var capped;
  var message;

  while (++index) {
    val = Math.pow(2, index);
    capped = cap(index - offset);

    if (capped === 1) {
      message = prev + ' and less common';
    } else if (prev) {
      message = prev + ' to ' + val;
    } else {
      message = 'Top ' + val + ' words';
    }

    nodes.push(h('li', {
      style: {
        backgroundColor: color(capped),
        color: capped > 0.6 ? 'white' : 'black'
      }
    }, message));

    if (val > words.length) {
      break;
    }

    prev = val;
  }

  return h('ol.colors', nodes);
}

function color(scale) {
  return 'rgba(0,0,0,' + scale + ')';
}

function cap(scale) {
  if (scale > 10 || isNaN(scale)) {
    scale = 10;
  }

  return scale > min ? scale / 10 : 0;
}

function rows(node) {
  if (!node) {
    return;
  }

  return Math.ceil(
    node.getBoundingClientRect().height /
    parseInt(win.getComputedStyle(node).lineHeight, 10)
  );
}
