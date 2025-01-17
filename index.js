const svgson = require('svgson').default
const { renderToStaticMarkup } = require('react-dom/server')
const { createElement: e } = require('react')
const pretty = require('pretty')
const Element = require('./createElement')
const svgo = require('svgo')

const svgoDefaultConfig = {
  plugins: [
    { removeStyleElement: true },
    { removeScriptElement: true },
    { removeViewBox: false },
    { removeTitle: false },
    {
      removeAttrs: {
        attrs: [
          'svg:fill:none',
          '(class|style)',
          // 'svg:width',
          // 'svg:height',
          'aria-labelledby',
          'aria-describedby',
          'xmlns:xlink',
          'data-name',
        ],
      },
    },
    {
      addFill: {
        name: "addFill",
        type: "perItem",
        active: true,
        fn: (item) => {
          if (!item?.content) {
            return
          }
          item.content = item.content.map((el) => {
            if (el.elem === "path") {
              if (el.attrs?.stroke) {
                el.attrs.stroke.value = "currentColor"
                el.attrs.fill = {
                  name: 'fill',
                  value: 'transparent',
                  prefix: '', local: 'fill'
                }
              }
              else if (el.attrs?.fill) {
                el.attrs.fill.value = "currentColor"
              }

            }

            return el
          })
        },
      },
    }
  ],
  multipass: true,
}

const optimizeSVG = (input, config) => {
  return new svgo(config).optimize(input).then(({ data }) => data)
}

const processWithSvgson = (data, { optimize, svgoConfig, transformNode }) => {
  const svgsonConfig = {
    optimize,
    camelcase: true,
    transformNode,
    svgoConfig,
  }
  return svgson(data, svgsonConfig)
}
const replaceTag = (icon) => ({ ...icon, name: 'symbol' })
const createIcon = (obj, key) => e(Element, { obj, key })
const createSprite = (icons) => {
  return e('svg', { width: 0, height: 0, className: 'hidden' }, icons)
}
const getId = (obj) => obj['data-iconid']
const createRef = (id, className) => {
  return e(
    'svg',
    { className: className !== '' ? className : null },
    e('use', { xlinkHref: `#${id}` })
  )
}
const markup = (elem) => renderToStaticMarkup(elem)

const generateSprite = (result, { tidy, className }) => {
  const multiResult = Array.isArray(result)
  const icons = multiResult
    ? result.map(replaceTag).map(createIcon)
    : createIcon(replaceTag(result))
  const refs = multiResult
    ? result.map(getId).map((id) => createRef(id, className))
    : createRef(getId(result), className)
  const sprite = createSprite(icons)
  const spriteOutput = markup(sprite)
  const refsOutput = markup(refs)
  const spriteDefs = tidy ? pretty(spriteOutput) : spriteOutput
  const spriteRefs = tidy ? pretty(refsOutput) : refsOutput
  return {
    defs: spriteDefs,
    refs: "",
  }
}

module.exports = async (
  input,
  {
    tidy = false,
    optimize = true,
    svgoConfig = svgoDefaultConfig,
    processId = (n) => `Icon_${n}`,
    className = '',
  } = {}
) => {
  let n = 0
  const transformNode = (node) => {
    if (node.name === 'svg') {
      const id = processId(n++)
      const { viewBox, width, height, ...extra } = node.attributes
      let defViewBox = viewBox || `0 0 ${width} ${height}`
      return {
        ...node,
        attributes: {
          ...extra,
          viewBox: defViewBox,
          id,
        },
        'data-iconid': id,
      }
    }
    return node
  }

  let icons = []
  let optimized = []
  if (optimize) {
      for (const icon of input) {
        const iconOpt = await optimizeSVG(icon, svgoConfig)
        optimized.push(iconOpt)
      }
      icons = optimized
  } else {
    icons = input
  }

  icons = icons.join(' ')

  const processed = await processWithSvgson(icons, {
    transformNode,
  })

  return await generateSprite(processed, { tidy, className })
}
