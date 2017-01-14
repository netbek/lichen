var _ = require('lodash');
var nunjucks = require('nunjucks');
var path = require('path');
var parseLinkLabel = require('remarkable/lib/helpers/parse_link_label');
var parseLinkDestination = require('remarkable/lib/helpers/parse_link_destination');
var parseLinkTitle = require('remarkable/lib/helpers/parse_link_title');
var normalizeReference = require('remarkable/lib/helpers/normalize_reference');

var DEV = require('../toco').DEV;
var PROD = require('../toco').PROD;

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
  /**
   *
   * @param  {String} uri
   * @return {String}
   */
  function resolveSrcPath(uri) {
    var scheme = md.penrose.getScheme(uri);

    if (_.isUndefined(scheme)) {
      var target = md.penrose.getTarget(uri);

      return path.join(md.config.files.src.path, target);
    }

    return uri;
  }

  /**
   *
   * @param  {String} styleName
   * @param  {String} uri
   * @return {String}
   */
  function resolveDistPath(styleName, uri) {
    var scheme = md.penrose.getScheme(uri);

    if (_.isUndefined(scheme)) {
      var build = md.config.env.dev ? DEV : PROD;
      var target = md.penrose.getTarget(uri);

      var dirname = path.dirname(target);
      var extname = path.extname(target);
      var basename = path.basename(target, extname);

      // Replace whitespace that prevents parsing of data attribute
      // `data-responsive-image-styles` (see image macro) that's used to pass
      // args to Penrose.
      basename = basename.replace(/\s/g, '-');

      return path.join(md.config.files.dist[build].path, 'styles', styleName, dirname, basename + extname);
    }

    return uri;
  }

  /**
   *
   * @param  {String} uri
   * @return {String}
   */
  function resolveDistURL(uri) {
    var scheme = md.penrose.getScheme(uri);

    if (_.isUndefined(scheme)) {
      var build = md.config.env.dev ? DEV : PROD;
      var target = md.penrose.getTarget(uri);
      var urlBase = _.get(md.config.files.dist[build], 'urlBase', '');

      if (urlBase.length && target.substring(0, urlBase.length) === urlBase) {
        target = target.substring(urlBase.length);
      }

      return path.join(md.config.files.dist[build].url, target);
    }

    return uri;
  }

  md.inline.ruler.before('links', 'responsive_image', parse);

  md.renderer.rules.responsive_image = function (tokens, idx, options, env) {
    var srcPath = resolveSrcPath(tokens[idx].src);
    var sources = [];
    var styles = [];

    _.forEach(md.config.remarkable.plugins.responsiveImage.srcset, function (source) {
      var style = md.config.imageStyles[source.style];

      if (_.isUndefined(style)) {
        return;
      }

      var distPath = resolveDistPath(source.style, tokens[idx].src);
      var distURL = resolveDistURL(distPath);

      sources.push(distURL + ' ' + source.width + 'w');
      styles.push(source.style);
      styles.push(distPath);
    });

    var templateFile = md.findPartialTemplate('image');

    return nunjucks.render(templateFile, {
      dataResponsiveImageSrc: srcPath,
      dataResponsiveImageStyles: styles,
      sizes: md.config.remarkable.plugins.responsiveImage.sizes,
      srcset: sources.join(', '),
      alt: tokens[idx].alt,
      title: tokens[idx].title
    });
  };

  return md;
};
