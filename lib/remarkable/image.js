var _ = require('lodash');
var nunjucks = require('nunjucks');
var path = require('path');

var DEV = require('../lichen').DEV;
var PROD = require('../lichen').PROD;

module.exports = function(md) {
  /**
   *
   * @param  {string} uri
   * @returns {string}
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
   * @param  {string} uri
   * @returns {string}
   */
  function resolveDistUrl(uri) {
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

  md.renderer.rules.image = function(tokens, idx, options, env) {
    var srcPath = resolveSrcPath(tokens[idx].src);
    var distUrl = resolveDistUrl(srcPath);
    var templateFile = md.findPartialTemplate('image');

    return nunjucks.render(templateFile, {
      src: distUrl,
      alt: tokens[idx].alt,
      title: tokens[idx].title
    });
  };

  return md;
};
