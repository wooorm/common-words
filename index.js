var fs = require('fs');
var doc = require('global/document');
var win = require('global/window');
var createElement = require('virtual-dom/create-element');
var diff = require('virtual-dom/diff');
var patch = require('virtual-dom/patch');
var h = require('virtual-dom/h');
var unified = require('unified');
var english = require('retext-english');
var visit = require('unist-util-visit');
var normalize = require('nlcst-normalize');
var debounce = require('debounce');
var xtend = require('xtend');

var words = fs.readFileSync('words.txt', 'utf8').split(',');

var offset = 7;
var min = 3;
var processor = unified().use(english);
var root = doc.getElementById('root');
var info = doc.getElementsByTagName('aside')[0];
var defaultValue = doc.getElementsByTagName('template')[0].innerHTML;
var graph = createElement(list());

info.appendChild(graph);

var state = {
  value: defaultValue,
  normalize: false
};

var tree = render(state);
var dom = root.appendChild(createElement(tree));

function onchangevalue(ev) {
  state.value = ev.target.value;
  onchange();
}

function onchangenormalize(ev) {
  state.normalize = ev.target.checked;
  graph.style.opacity = Number(!state.normalize);
  onchange();
}

function onchange() {
  var next = render(state);
  dom = patch(dom, diff(tree, next));
  tree = next;
}

function resize() {
  dom.querySelector('textarea').rows = rows(dom.querySelector('.draw'));
}

function render(state) {
  var tree = processor.runSync(processor.parse(state.value));
  var change = debounce(onchangevalue, 4);
  var key = 0;

  setTimeout(resize, 4);

  return h('div', [
    h('div', {key: 'options', className: 'options'}, [
      h('label', [
        h('input', {
          type: 'checkbox',
          check: state.normalize,
          onchange: onchangenormalize
        }),
        ' Average per sentence'
      ])
    ]),
    h('div', {key: 'editor', className: 'editor'}, [
      h('div', {key: 'draw', className: 'draw'}, pad(all(tree, []))),
      h('textarea', {
        key: 'area',
        value: state.value,
        oninput: change,
        onpaste: change,
        onkeyup: change,
        onmouseup: change
      })
    ])
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

  function attributes(node) {
    var scale;

    if (state.normalize && node.type === 'SentenceNode') {
      scale = calcIn(node);
    }

    if (!state.normalize && node.type === 'WordNode') {
      scale = calc(node);
    }

    if (scale) {
      return {style: {backgroundColor: color(scale)}};
    }
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

function calc(node) {
  var value = normalize(node, {allowApostrophes: true}).toLowerCase();
  return cap(Math.floor(Math.log(words.indexOf(value)) / Math.log(2)) - offset);
}

function calcIn(node) {
  var total = 0;
  var count = 0;
  visit(node, 'WordNode', function (child) {
    total += calc(child);
    count++;
  });
  return total / count;
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
