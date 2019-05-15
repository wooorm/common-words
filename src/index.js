var fs = require('fs')
var doc = require('global/document')
var win = require('global/window')
var createElement = require('virtual-dom/create-element')
var diff = require('virtual-dom/diff')
var patch = require('virtual-dom/patch')
var h = require('virtual-dom/h')
var unified = require('unified')
var english = require('retext-english')
var visit = require('unist-util-visit')
var normalize = require('nlcst-normalize')
var debounce = require('debounce')
var xtend = require('xtend')
var mean = require('compute-mean')
var median = require('compute-median')
var mode = require('compute-mode')

var words = fs.readFileSync('src/words.txt', 'utf8').split(',')

var offset = 7
var min = 3
var processor = unified().use(english)
var main = doc.querySelectorAll('main')[0]
var templates = [].slice.call(doc.querySelectorAll('template'))

var averages = {
  mean: mean,
  median: median,
  mode: modeMean
}

var state = {
  template: optionForTemplate(templates[0]),
  value: valueForTemplate(templates[0]),
  average: 'mean',
  normalize: false
}

var tree = render(state)
var dom = main.appendChild(createElement(tree))

function onchangevalue(ev) {
  var prev = state.value
  var next = ev.target.value

  if (prev !== next) {
    state.value = ev.target.value
    state.template = null
    onchange()
  }
}

function onchangenormalize(ev) {
  state.normalize = ev.target.checked
  onchange()
}

function onchangetemplate(ev) {
  var target = ev.target.selectedOptions[0]
  var node = doc.querySelector('[data-label="' + target.textContent + '"]')
  state.template = optionForTemplate(node)
  state.value = valueForTemplate(node)
  onchange()
}

function onchangeaverage(ev) {
  state.average = ev.target.value.toLowerCase()
  onchange()
}

function onchange() {
  var next = render(state)
  dom = patch(dom, diff(tree, next))
  tree = next
}

function resize() {
  dom.querySelector('textarea').rows = rows(dom.querySelector('.draw'))
}

function render(state) {
  var tree = processor.runSync(processor.parse(state.value))
  var change = debounce(onchangevalue, 4)
  var key = 0
  var unselected = true
  var options = templates.map(function(template, index) {
    var selected = optionForTemplate(template) === state.template

    if (selected) {
      unselected = false
    }

    return h(
      'option',
      {key: index, selected: selected},
      optionForTemplate(template)
    )
  })

  setTimeout(resize, 4)

  return h('div', [
    h('section.highlight', [h('h1', {key: 'title'}, 'common words')]),
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
    ]),
    state.normalize ? null : h('section', list()),
    h('section.highlight', [
      h('p', {key: 'byline'}, [
        'Use common words. Common words are more powerful and less pretentious. ',
        h('em', 'Stop'),
        ' is stronger than ',
        h('em', 'discontinue'),
        '.'
      ]),
      h('p', {key: 'intro'}, [
        'The demo highlights words by how rare they are in English, ',
        'exponentially. If they are “redacted”, chances are your readers ',
        'don’t understand them either.'
      ]),
      h('p', {key: 'ps'}, [
        'You can edit the text above, or ',
        h('label', [
          'pick a template: ',
          h(
            'select',
            {key: 'template', onchange: onchangetemplate},
            [
              unselected
                ? h('option', {key: '-1', selected: unselected}, '--')
                : null
            ].concat(options)
          )
        ])
      ]),
      h('p', {key: 4}, [
        h(
          'label',
          ['Average ']
            .concat(
              state.normalize
                ? [
                    '(',
                    h('select', {key: 'average', onchange: onchangeaverage}, [
                      h(
                        'option',
                        {key: 0, selected: state.average === 'mean'},
                        'mean'
                      ),
                      h(
                        'option',
                        {key: 1, selected: state.average === 'median'},
                        'median'
                      ),
                      h(
                        'option',
                        {key: 2, selected: state.average === 'mode'},
                        'mode'
                      )
                    ]),
                    ')'
                  ]
                : []
            )
            .concat([
              ' per sentence: ',
              h('input', {
                type: 'checkbox',
                checked: state.normalize,
                onchange: onchangenormalize
              })
            ])
        )
      ])
    ]),
    h('section.credits', {key: 'credits'}, [
      h('p', [
        h('a', {href: 'https://github.com/wooorm/common-words'}, 'GitHub'),
        ' • ',
        h(
          'a',
          {href: 'https://github.com/wooorm/common-words/blob/src/license'},
          'MIT'
        ),
        ' • ',
        h('a', {href: 'https://wooorm.com'}, '@wooorm')
      ])
    ])
  ])

  function all(node, parentIds) {
    var children = node.children
    var length = children.length
    var index = -1
    var results = []

    while (++index < length) {
      results = results.concat(one(children[index], parentIds.concat(index)))
    }

    return results
  }

  function one(node, parentIds) {
    var result = 'value' in node ? node.value : all(node, parentIds)
    var attrs = attributes(node)
    var id = parentIds.join('-') + '-' + key

    if (attrs) {
      result = h('span', xtend({key: id, id: id}, attrs), result)
      key++
    }

    return result
  }

  function attributes(node) {
    var scale

    if (state.normalize && node.type === 'SentenceNode') {
      scale = calcIn(node)
    }

    if (!state.normalize && node.type === 'WordNode') {
      scale = calc(node)
    }

    if (scale) {
      return {style: {backgroundColor: color(scale)}}
    }
  }

  // Trailing white-space in a `textarea` is shown, but not in a `div` with
  // `white-space: pre-wrap`.
  // Add a `br` to make the last newline explicit.
  function pad(nodes) {
    var tail = nodes[nodes.length - 1]

    if (typeof tail === 'string' && tail.charAt(tail.length - 1) === '\n') {
      nodes.push(h('br', {key: 'break'}))
    }

    return nodes
  }
}

function calc(node) {
  var value = normalize(node, {allowApostrophes: true}).toLowerCase()
  return cap(Math.floor(Math.log(words.indexOf(value)) / Math.log(2)) - offset)
}

function calcIn(node) {
  var values = []
  visit(node, 'WordNode', function(child) {
    values.push(calc(child))
  })
  return averages[state.average](values)
}

function list() {
  var index = offset + min - 1
  var nodes = []
  var prev = 0
  var val
  var capped
  var message

  while (++index) {
    val = Math.pow(2, index)
    capped = cap(index - offset)

    if (capped === 1) {
      message = prev + ' and less common'
    } else if (prev) {
      message = prev + ' to ' + val
    } else {
      message = 'Top ' + val + ' words'
    }

    nodes.push(
      h(
        'li',
        {
          style: {
            backgroundColor: color(capped),
            color: capped > 0.6 ? 'white' : 'black'
          }
        },
        message
      )
    )

    if (val > words.length) {
      break
    }

    prev = val
  }

  return h('ol.colors', nodes)
}

function color(scale) {
  return 'rgba(0, 0, 0, ' + scale + ')'
}

function cap(scale) {
  if (scale > 10 || isNaN(scale)) {
    scale = 10
  }

  return scale > min ? scale / 10 : 0
}

function rows(node) {
  if (!node) {
    return
  }

  return Math.ceil(
    node.getBoundingClientRect().height /
      parseInt(win.getComputedStyle(node).lineHeight, 10)
  )
}

function optionForTemplate(template) {
  return template.dataset.label
}

function valueForTemplate(template) {
  return template.innerHTML + '\n\n— ' + optionForTemplate(template)
}

function modeMean(value) {
  return mean(mode(value))
}
