/// <reference lib="dom" />
/* eslint-env browser */

/**
 * @typedef {import('virtual-dom').VNode} VNode
 * @typedef {import('virtual-dom').VProperties} VProperties
 * @typedef {import('nlcst').Parent} NlcstParent
 * @typedef {import('nlcst').Root} NlcstRoot
 * @typedef {import('nlcst').Content} NlcstContent
 * @typedef {NlcstRoot | NlcstContent} NlcstNode
 *
 * @typedef {'mean'|'median'|'mode'} Average
 *
 * @typedef State
 * @property {string|null} template
 * @property {string} value
 * @property {Average} average
 * @property {boolean} normalize
 */

import virtualDom from 'virtual-dom'
import {unified} from 'unified'
import retextEnglish from 'retext-english'
import {visit} from 'unist-util-visit'
import {normalize} from 'nlcst-normalize'
import debounce from 'debounce'
// @ts-expect-error: untyped.
import mean from 'compute-mean'
// @ts-expect-error: untyped.
import median from 'compute-median'
// @ts-expect-error: untyped.
import mode from 'compute-mode'
import {words} from './words.js'

const {create, h, diff, patch} = virtualDom

const darkQuery = '(prefers-color-scheme: dark)'

const offset = 7
const min = 3
const processor = unified().use(retextEnglish)
const main = document.querySelector('main')
const templates = Array.from(document.querySelectorAll('template'))

if (!main) {
  throw new Error('Expected `<main>`')
}

/** @type {Record<Average, (value: Array<number>) => number>} */
const averages = {
  mean,
  median,
  mode: modeMean
}

/**
 * @type {State}
 */
const state = {
  template: optionForTemplate(templates[0]),
  value: valueForTemplate(templates[0]),
  average: 'mean',
  normalize: false
}

let tree = render(state)
let dom = main.appendChild(create(tree))

window.matchMedia(darkQuery).addListener(onchange)

/**
 * @param {KeyboardEvent|MouseEvent|ClipboardEvent} ev
 */
function onchangevalue(ev) {
  if (
    ev &&
    ev.target &&
    'value' in ev.target &&
    typeof ev.target.value === 'string'
  ) {
    const previous = state.value
    const next = ev.target.value

    if (previous !== next) {
      state.value = ev.target.value
      state.template = null
      onchange()
    }
  }
}

/**
 * @param {Event} ev
 */
function onchangenormalize(ev) {
  if (ev && ev.target && ev.target instanceof HTMLInputElement) {
    state.normalize = ev.target.checked
    onchange()
  }
}

/**
 * @param {Event} ev
 */
function onchangetemplate(ev) {
  if (ev && ev.target && ev.target instanceof HTMLSelectElement) {
    const target = ev.target.selectedOptions[0]
    const node = document.querySelector(
      '[data-label="' + target.textContent + '"]'
    )

    if (node && node instanceof HTMLTemplateElement) {
      state.template = optionForTemplate(node)
      state.value = valueForTemplate(node)
      onchange()
    }
  }
}

/**
 * @param {Event} ev
 */
function onchangeaverage(ev) {
  if (
    ev &&
    ev.target &&
    'value' in ev.target &&
    typeof ev.target.value === 'string'
  ) {
    state.average = /** @type {Average} */ (ev.target.value.toLowerCase())
    onchange()
  }
}

function onchange() {
  const next = render(state)
  dom = patch(dom, diff(tree, next))
  tree = next
}

function resize() {
  const textarea = dom.querySelector('textarea')
  const draw = dom.querySelector('.draw')
  if (!textarea) throw new Error('Expected `textarea` `dom`')
  if (!draw) throw new Error('Expected `.draw` in `dom`')
  const result = rows(draw)
  if (result !== undefined) textarea.rows = result
}

/**
 * @param {State} state
 * @returns {VNode}
 */
function render(state) {
  const dark = window.matchMedia(darkQuery).matches
  const tree = processor.runSync(processor.parse(state.value))
  const change = debounce(onchangevalue, 4)
  let key = 0
  let unselected = true
  const options = templates.map((template, index) => {
    const selected = optionForTemplate(template) === state.template

    if (selected) {
      unselected = false
    }

    return h(
      'option',
      {key: String(index), selected},
      optionForTemplate(template)
    )
  })

  setTimeout(resize, 4)

  return h('div', [
    h('section.highlight', [h('h1', {key: 'title'}, 'common words')]),
    h('div', {key: 'editor', className: 'editor'}, [
      h('div', {key: 'draw', className: 'draw'}, pad(all(tree, []))),
      h(
        'textarea',
        {
          key: 'area',
          value: state.value,
          oninput: change,
          onpaste: change,
          onkeyup: change,
          onmouseup: change
        },
        []
      )
    ]),
    state.normalize ? '' : h('section', [list(dark)]),
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
          h('select', {key: 'template', onchange: onchangetemplate}, [
            unselected
              ? h('option', {key: '-1', selected: unselected}, '--')
              : '',
            ...options
          ])
        ])
      ]),
      h('p', {key: '4'}, [
        h('label', [
          'Average ',
          ...(state.normalize
            ? [
                '(',
                h('select', {key: 'average', onchange: onchangeaverage}, [
                  h(
                    'option',
                    {key: '0', selected: state.average === 'mean'},
                    'mean'
                  ),
                  h(
                    'option',
                    {key: '1', selected: state.average === 'median'},
                    'median'
                  ),
                  h(
                    'option',
                    {key: '2', selected: state.average === 'mode'},
                    'mode'
                  )
                ]),
                ')'
              ]
            : []),
          ' per sentence: ',
          h(
            'input',
            {
              type: 'checkbox',
              checked: state.normalize,
              onchange: onchangenormalize
            },
            []
          )
        ])
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

  /**
   * @param {NlcstParent} node
   * @param {Array<number>} parentIds
   * @returns {Array<VNode|string>}
   */
  function all(node, parentIds) {
    const children = node.children
    const length = children.length
    let index = -1
    /** @type {Array<VNode|string>} */
    const results = []

    while (++index < length) {
      const ids = [...parentIds, index]
      const result = one(children[index], ids)

      if (Array.isArray(result)) {
        results.push(...result)
      } else {
        results.push(result)
      }
    }

    return results
  }

  /**
   * @param {NlcstNode} node
   * @param {Array<number>} parentIds
   * @returns {string|VNode|Array<VNode|string>}
   */
  function one(node, parentIds) {
    /** @type {string|VNode|Array<VNode|string>} */
    let result = 'value' in node ? node.value : all(node, parentIds)
    const attrs = attributes(node)
    const id = parentIds.join('-') + '-' + key

    if (attrs) {
      result = h('span', Object.assign({key: id, id}, attrs), result)
      key++
    }

    return result
  }

  /**
   * @param {NlcstNode} node
   * @returns {VProperties|void}
   */
  function attributes(node) {
    /** @type {number|undefined} */
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

  /**
   * Trailing white-space in a `textarea` is shown, but not in a `div` with
   * `white-space: pre-wrap`.
   * Add a `br` to make the last newline explicit.
   *
   * @param {Array<VNode|string>} nodes
   * @returns {Array<VNode|string>}
   */
  function pad(nodes) {
    const tail = nodes[nodes.length - 1]

    if (typeof tail === 'string' && tail.charAt(tail.length - 1) === '\n') {
      nodes.push(h('br', {key: 'break'}, []))
    }

    return nodes
  }
}

/**
 * @param {NlcstNode} node
 * @returns {number}
 */
function calc(node) {
  const value = normalize(node)
  return cap(Math.floor(Math.log(words.indexOf(value)) / Math.log(2)) - offset)
}

/**
 * @param {NlcstNode} node
 * @returns {number}
 */
function calcIn(node) {
  /** @type {Array<number>} */
  const values = []
  visit(node, 'WordNode', (child) => {
    values.push(calc(child))
  })

  return averages[state.average](values)
}

/**
 * @param {boolean} dark
 * @returns {VNode}
 */
function list(dark) {
  let index = offset + min - 1
  /** @type {Array<VNode>} */
  const nodes = []
  let previous = 0

  while (++index) {
    const value = 2 ** index
    const capped = cap(index - offset)
    /** @type {string} */
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

/**
 * @param {number} scale
 * @param {boolean} dark
 * @returns {string}
 */
function color(scale, dark) {
  const x = dark ? 255 : 0
  const rgb = [x, x, x].join(', ')
  return 'rgba(' + rgb + ', ' + scale + ')'
}

/**
 * @param {number} scale
 * @returns {number}
 */
function cap(scale) {
  if (scale > 10 || Number.isNaN(scale)) {
    scale = 10
  }

  return scale > min ? scale / 10 : 0
}

/**
 * @param {Element|null} node
 * @returns {number|void}
 */
function rows(node) {
  if (!node || node.nodeType !== document.ELEMENT_NODE) {
    return
  }

  return Math.ceil(
    node.getBoundingClientRect().height /
      Number.parseInt(window.getComputedStyle(node).lineHeight, 10)
  )
}

/**
 * @param {HTMLTemplateElement} template
 * @returns {string}
 */
function optionForTemplate(template) {
  const label = template.dataset.label
  if (!label) throw new Error('Expected `data-label` on `<template>`')
  return label
}

/**
 * @param {HTMLTemplateElement} template
 * @returns {string}
 */
function valueForTemplate(template) {
  return template.innerHTML + '\n\n— ' + optionForTemplate(template)
}

/**
 * @param {Array<number>} value
 * @returns {number}
 */
function modeMean(value) {
  return mean(mode(value))
}
