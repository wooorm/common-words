import doc from 'global/document.js'
import win from 'global/window.js'
import createElement from 'virtual-dom/create-element.js'
import diff from 'virtual-dom/diff.js'
import patch from 'virtual-dom/patch.js'
import h from 'virtual-dom/h.js'
import {unified} from 'unified'
import retextEnglish from 'retext-english'
import {visit} from 'unist-util-visit'
import {normalize} from 'nlcst-normalize'
import debounce from 'debounce'
import mean from 'compute-mean'
import median from 'compute-median'
import mode from 'compute-mode'
import {words} from './words.js'

const darkQuery = '(prefers-color-scheme: dark)'

const offset = 7
const min = 3
const processor = unified().use(retextEnglish)
const main = doc.querySelectorAll('main')[0]
const templates = [...doc.querySelectorAll('template')]

const averages = {
  mean,
  median,
  mode: modeMean
}

const state = {
  template: optionForTemplate(templates[0]),
  value: valueForTemplate(templates[0]),
  average: 'mean',
  normalize: false
}

let tree = render(state)
let dom = main.appendChild(createElement(tree))

win.matchMedia(darkQuery).addListener(onchange)

function onchangevalue(ev) {
  const previous = state.value
  const next = ev.target.value

  if (previous !== next) {
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
  const target = ev.target.selectedOptions[0]
  const node = doc.querySelector('[data-label="' + target.textContent + '"]')
  state.template = optionForTemplate(node)
  state.value = valueForTemplate(node)
  onchange()
}

function onchangeaverage(ev) {
  state.average = ev.target.value.toLowerCase()
  onchange()
}

function onchange() {
  const next = render(state)
  dom = patch(dom, diff(tree, next))
  tree = next
}

function resize() {
  dom.querySelector('textarea').rows = rows(dom.querySelector('.draw'))
}

function render(state) {
  const dark = win.matchMedia(darkQuery).matches
  const tree = processor.runSync(processor.parse(state.value))
  const change = debounce(onchangevalue, 4)
  let key = 0
  let unselected = true
  const options = templates.map((template, index) => {
    const selected = optionForTemplate(template) === state.template

    if (selected) {
      unselected = false
    }

    return h('option', {key: index, selected}, optionForTemplate(template))
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
    state.normalize ? null : h('section', list(dark)),
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
    const children = node.children
    const length = children.length
    let index = -1
    let results = []

    while (++index < length) {
      results = results.concat(one(children[index], parentIds.concat(index)))
    }

    return results
  }

  function one(node, parentIds) {
    let result = 'value' in node ? node.value : all(node, parentIds)
    const attrs = attributes(node)
    const id = parentIds.join('-') + '-' + key

    if (attrs) {
      result = h('span', Object.assign({key: id, id}, attrs), result)
      key++
    }

    return result
  }

  function attributes(node) {
    let scale

    if (state.normalize && node.type === 'SentenceNode') {
      scale = calcIn(node)
    }

    if (!state.normalize && node.type === 'WordNode') {
      scale = calc(node)
    }

    if (scale) {
      return {style: {backgroundColor: color(scale, dark)}}
    }
  }

  // Trailing white-space in a `textarea` is shown, but not in a `div` with
  // `white-space: pre-wrap`.
  // Add a `br` to make the last newline explicit.
  function pad(nodes) {
    const tail = nodes[nodes.length - 1]

    if (typeof tail === 'string' && tail.charAt(tail.length - 1) === '\n') {
      nodes.push(h('br', {key: 'break'}))
    }

    return nodes
  }
}

function calc(node) {
  const value = normalize(node)
  return cap(Math.floor(Math.log(words.indexOf(value)) / Math.log(2)) - offset)
}

function calcIn(node) {
  const values = []
  visit(node, 'WordNode', (child) => {
    values.push(calc(child))
  })
  return averages[state.average](values)
}

function list(dark) {
  let index = offset + min - 1
  const nodes = []
  let previous = 0

  while (++index) {
    const value = 2 ** index
    const capped = cap(index - offset)
    let message

    if (capped === 1) {
      message = previous + ' and less common'
    } else if (previous) {
      message = previous + ' to ' + value
    } else {
      message = 'Top ' + value + ' words'
    }

    nodes.push(
      h(
        'li',
        {
          style: {
            backgroundColor: color(capped, dark),
            color: (dark ? capped < 0.6 : capped > 0.6) ? 'white' : 'black'
          }
        },
        message
      )
    )

    if (value > words.length) {
      break
    }

    previous = value
  }

  return h('ol.colors', nodes)
}

function color(scale, dark) {
  const x = dark ? 255 : 0
  const rgb = [x, x, x].join(', ')
  return 'rgba(' + rgb + ', ' + scale + ')'
}

function cap(scale) {
  if (scale > 10 || Number.isNaN(scale)) {
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
      Number.parseInt(win.getComputedStyle(node).lineHeight, 10)
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
