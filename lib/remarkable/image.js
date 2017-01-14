var _ = require('lodash');
var nunjucks = require('nunjucks');
var path = require('path');

var DEV = require('../toco').DEV;
var PROD = require('../toco').PROD;

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
   * @param  {String} uri
   * @return {String}
   */
  function resolveDistURL(uri) {
    var scheme = md.penrose.getScheme(uri);

    if (_.isUndefined(scheme)) {
      var build = md.config.env.dev ? DEV : PROD;
      var target = md.penrose.getTarget(uri);

      return md.config.files.dist[build].url + target;
    }

    return uri;
  }

  md.renderer.rules.image = function (tokens, idx, options, env) {
    var srcPath = resolveSrcPath(tokens[idx].src);
    var distURL = resolveDistURL(srcPath);
    var templateFile = md.findPartialTemplate('image');

    return nunjucks.render(templateFile, {
      src: distURL,
      alt: tokens[idx].alt,
      title: tokens[idx].title
    });
  };

  return md;
};
