/* eslint-env browser */

/// <reference lib="dom" />

/**
 * @import {Nodes, Parents, Word} from 'nlcst'
 */

import {mean, median, mode} from 'd3-array'
import {normalize} from 'nlcst-normalize'
import {ParseEnglish} from 'parse-english'
import ReactDom from 'react-dom/client'
import React from 'react'
import {SKIP, visit} from 'unist-util-visit'
import {words} from './words.js'

const $main = /** @type {HTMLElement} */ (document.querySelector('main'))
const min = 3
const offset = 7
/** @type {Record<string, string>} */
const samples = {
  'Ernest Hemingway, The Sun Also Rises': `Finally, after a couple more false klaxons, the bus started, and Robert Cohn waved good-by to us, and all the Basques waved good-by to him. As soon as we started out on the road outside of town it was cool. It felt nice riding high up and close under the trees. The bus went quite fast and made a good breeze, and as we went out along the road with the dust powdering the trees and down the hill, we had a fine view, back through the trees, of the town rising up from the bluff above the river. The Basque lying against my knees pointed out the view with the neck of a wine-bottle, and winked at us. He nodded his head.`,
  'Dr Seuss, The Cat in the Hat': `Then our mother came in
And she said to us two,
“Did you have any fun?
Tell me. What did you do?”

And Sally and I did not
know what to say.
Should we tell her
The things that went on
there that day?

Well… what would YOU do
If your mother asked you?

The Cat in the Hat
Look at me!
Look at me!
Look at me NOW!
It is fun to have fun
But you have
to know how.`,
  'Trump, Presidential Bid announcement': `Thank you. It’s true, and these are the best and the finest. When Mexico sends its people, they’re not sending their best. They’re not sending you. They’re not sending you. They’re sending people that have lots of problems, and they’re bringing those problems with us. They’re bringing drugs. They’re bringing crime. They’re rapists. And some, I assume, are good people.

  But I speak to border guards and they tell us what we’re getting. And it only makes common sense. It only makes common sense. They’re sending us not the right people.`,
  'Obama, Farewell Speech': `On Tuesday, January 10, I’ll go home to Chicago to say my grateful farewell to you, even if you can’t be there in person.

  I’m just beginning to write my remarks. But I’m thinking about them as a chance to say thank you for this amazing journey, to celebrate the ways you’ve changed this country for the better these past eight years, and to offer some thoughts on where we all go from here.
  Since 2009, we’ve faced our fair share of challenges, and come through them stronger. That’s because we have never let go of a belief that has guided us ever since our founding — our conviction that, together, we can change this country for the better. So I hope you’ll join me one last time.`
}

const parser = new ParseEnglish()

const root = ReactDom.createRoot($main)

root.render(React.createElement(Playground))

function Playground() {
  const sampleNames = Object.keys(samples)
  const dark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const [average, setAverage] = React.useState('median')
  const [sentence, setSentence] = React.useState(false)
  const [sample, setSample] = React.useState(sampleNames[0])
  const [text, setText] = React.useState(textFromSample(sample))
  const tree = parser.parse(text)
  let unselected = true
  /** @type {Array<JSX.Element>} */
  const options = []

  for (const sampleName of sampleNames) {
    const selected = textFromSample(sampleName) === text

    if (selected) unselected = false

    options.push(
      <option key={sampleName} selected={selected}>
        {sampleName}
      </option>
    )
  }

  return (
    <div>
      <section className="highlight">
        <h1>
          <code>common-words</code>
        </h1>
      </section>
      <div className="editor">
        <div className="draw">
          {all(tree)}
          {/* Trailing whitespace in a `textarea` is shown,
          but not in a `div` with `white-space: pre-wrap`;
          add a `br` to make the last newline explicit. */}
          {/\n[ \t]*$/.test(text) ? <br /> : undefined}
        </div>
        <textarea
          className="write"
          onChange={(event) => setText(event.target.value)}
          rows={text.split('\n').length + 1}
          spellCheck="false"
          value={text}
        />
      </div>
      {sentence ? undefined : <section>{list(dark)}</section>}
      <section className="highlight">
        <p>
          Use common words. Common words are more powerful and less pretentious.{' '}
          <em>Stop</em> is stronger than <em>discontinue</em>.
        </p>
        <p>
          The demo highlights words by how rare they are in English,
          exponentially. If they are “redacted”, chances are your readers don’t
          understand them either.
        </p>
        <p>
          You can edit the text above, or pick a template:{' '}
          <select
            onChange={function (event) {
              setSample(event.target.value)
              setText(textFromSample(event.target.value))
            }}
          >
            {unselected ? (
              <option disabled selected={true}>
                --
              </option>
            ) : undefined}
            {options}
          </select>
          .
        </p>
        <p>
          You can average per sentence:{' '}
          <input
            checked={sentence}
            type="checkbox"
            onChange={function (event) {
              setSentence(event.target.checked)
            }}
          />
          {sentence ? (
            <>
              {' '}
              (average:{' '}
              <select
                onChange={function (event) {
                  setAverage(event.target.value)
                }}
              >
                <option selected={average === 'mean'}>mean</option>
                <option selected={average === 'median'}>median</option>
                <option selected={average === 'mode'}>mode</option>
              </select>
              )
            </>
          ) : undefined}
          .
        </p>
      </section>
      <section className="credits">
        <p>
          <a href="https://github.com/wooorm/common-words">Fork this website</a>{' '}
          •{' '}
          <a href="https://github.com/wooorm/common-words/blob/main/license">
            MIT
          </a>{' '}
          • <a href="https://github.com/wooorm">@wooorm</a>
        </p>
      </section>
    </div>
  )

  /**
   * @param {Parents} parent
   * @returns {Array<JSX.Element | string>}
   */
  function all(parent) {
    /** @type {Array<JSX.Element | string>} */
    const results = []

    for (const child of parent.children) {
      const result = one(child)
      if (Array.isArray(result)) {
        results.push(...result)
      } else {
        results.push(result)
      }
    }

    return results
  }

  /**
   * @param {Nodes} node
   * @returns {Array<JSX.Element | string> | JSX.Element | string}
   */
  function one(node) {
    const result = 'value' in node ? node.value : all(node)
    /** @type {number | undefined} */
    let score

    if (sentence && node.type === 'SentenceNode') {
      /** @type {Array<number>} */
      const scores = []

      visit(node, 'WordNode', (child) => {
        scores.push(calculate(child))
        return SKIP
      })

      score =
        average === 'mean'
          ? mean(scores)
          : average === 'median'
            ? median(scores)
            : mode(scores)
    }

    if (!sentence && node.type === 'WordNode') {
      score = calculate(node)
    }

    if (score !== undefined) {
      return <span style={{backgroundColor: color(score, dark)}}>{result}</span>
    }

    return result
  }
}

/**
 * @param {Word} node
 * @returns {number}
 */
function calculate(node) {
  const value = normalize(node)
  return cap(Math.floor(Math.log(words.indexOf(value)) / Math.log(2)) - offset)
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
 * @param {number} scale
 * @param {boolean} dark
 * @returns {string}
 */
function color(scale, dark) {
  return 'hsl(0deg 0% ' + (dark ? 100 : 0) + '% / ' + scale * 100 + '%)'
}

/**
 * @param {string} sampleName
 * @returns {string}
 */
function textFromSample(sampleName) {
  return samples[sampleName] + '\n\n— ' + sampleName
}

/**
 * @param {boolean} dark
 * @returns {JSX.Element}
 */
function list(dark) {
  let index = offset + min - 1
  /** @type {Array<JSX.Element>} */
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
      <li
        style={{
          color: (dark ? capped < 0.6 : capped > 0.6) ? 'white' : 'black',
          backgroundColor: color(capped, dark)
        }}
      >
        {message}
      </li>
    )

    if (value > words.length) {
      break
    }

    previous = value
  }

  return <ol className="colors">{nodes}</ol>
}
