var _ = require('lodash');
var nunjucks = require('nunjucks');
var parseLinkLabel = require('remarkable/lib/helpers/parse_link_label');
var parseLinkDestination = require('remarkable/lib/helpers/parse_link_destination');
var parseLinkTitle = require('remarkable/lib/helpers/parse_link_title');
var normalizeReference = require('remarkable/lib/helpers/normalize_reference');

var PUBLIC = require('penrose').PUBLIC;
var TEMPORARY = require('penrose').TEMPORARY;

// Adapted from https://github.com/jonschlinkert/remarkable/blob/e2f22eb5de6ddec4093998824e237b5be951be68/lib/rules_inline/links.js
function parse(state, silent) {
  var labelStart;
  var labelEnd;
  var label;
  var href;
  var title;
  var pos;
  var ref;
  var code;
  var oldPos = state.pos;
  var max = state.posMax;
  var start = state.pos;
  var marker = state.src.charCodeAt(start);

  if (marker !== 0x24 /* $ */ ) {
    return false;
  }

  marker = state.src.charCodeAt(++start);

  if (marker !== 0x5B /* [ */ ) {
    return false;
  }
  if (state.level >= state.options.maxNesting) {
    return false;
  }

  labelStart = start + 1;
  labelEnd = parseLinkLabel(state, start);

  // parser failed to find ']', so it's not a valid link
  if (labelEnd < 0) {
    return false;
  }

  pos = labelEnd + 1;
  if (pos < max && state.src.charCodeAt(pos) === 0x28 /* ( */ ) {
    //
    // Inline link
    //

    // [link](  <href>  "title"  )
    //        ^^ skipping these spaces
    pos++;
    for (; pos < max; pos++) {
      code = state.src.charCodeAt(pos);
      if (code !== 0x20 && code !== 0x0A) {
        break;
      }
    }
    if (pos >= max) {
      return false;
    }

    // [link](  <href>  "title"  )
    //          ^^^^^^ parsing link destination
    start = pos;
    if (parseLinkDestination(state, pos)) {
      href = state.linkContent;
      pos = state.pos;
    }
    else {
      href = '';
    }

    // [link](  <href>  "title"  )
    //                ^^ skipping these spaces
    start = pos;
    for (; pos < max; pos++) {
      code = state.src.charCodeAt(pos);
      if (code !== 0x20 && code !== 0x0A) {
        break;
      }
    }

    // [link](  <href>  "title"  )
    //                  ^^^^^^^ parsing link title
    if (pos < max && start !== pos && parseLinkTitle(state, pos)) {
      title = state.linkContent;
      pos = state.pos;

      // [link](  <href>  "title"  )
      //                         ^^ skipping these spaces
      for (; pos < max; pos++) {
        code = state.src.charCodeAt(pos);
        if (code !== 0x20 && code !== 0x0A) {
          break;
        }
      }
    }
    else {
      title = '';
    }

    if (pos >= max || state.src.charCodeAt(pos) !== 0x29 /* ) */ ) {
      state.pos = oldPos;
      return false;
    }
    pos++;
  }

  // We found the end of the link, and know for a fact it's a valid link;
  // so all that's left to do is to call tokenizer.
  if (!silent) {
    state.pos = labelStart;
    state.posMax = labelEnd;

    state.push({
      type: 'responsive_image',
      src: href,
      title: title,
      alt: state.src.substr(labelStart, labelEnd - labelStart),
      level: state.level
    });
  }

  state.pos = pos;
  state.posMax = max;

  return true;
}

module.exports = function (md) {
  md.inline.ruler.before('links', 'responsive_image', parse);

  md.renderer.rules.responsive_image = function (tokens, idx, options, env) {
    var src = tokens[idx].src;
    var formatSrc = _.get(md.config.remarkable.plugins, 'responsiveImage.formatSrc');

    if (_.isFunction(formatSrc)) {
      src = formatSrc(src);
    }

    var uri = md.config.env.dev ? md.penrose.setScheme(src, TEMPORARY) : src;
    var styleNames = [];
    var sources = [];

    _.forEach(md.config.remarkable.plugins.responsiveImage.srcset, function (source) {
      var style = md.config.imageStyles[source.style];

      if (_.isUndefined(style)) {
        return;
      }

      var url = md.penrose.getStyleURL(source.style, uri);

      styleNames.push(source.style);
      sources.push(url + ' ' + source.width + 'w');
    });

    var templateFile = md.findPartialTemplate('image');

    return nunjucks.render(templateFile, {
      dataPenroseSrc: src,
      dataPenroseStyles: styleNames.join(','),
      sizes: md.config.remarkable.plugins.responsiveImage.sizes,
      srcset: sources.join(', '),
      alt: tokens[idx].alt,
      title: tokens[idx].title
    });
  };

  return md;
};
