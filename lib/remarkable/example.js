var _ = require('lodash');
var nunjucks = require('nunjucks');
var parseFenceParams = require('../utils/parseFenceParams');
var path = require('path');
var Prism = require('node-prismjs');

var DEV = require('../lichen').DEV;
var PROD = require('../lichen').PROD;

var prismLangAliases = {
  html: 'markup'
};

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

  md.renderer.rules.fence_custom.example = function(
    tokens,
    idx,
    options,
    env,
    instance
  ) {
    var params = parseFenceParams(tokens[idx].params);
    params.lang = params.lang.toLowerCase();
    var templateFile = md.findPartialTemplate('example');
    var prismLang = _.get(prismLangAliases, params.lang, params.lang);
    var code = Prism.highlight(tokens[idx].content, Prism.languages[prismLang]);
    var id = _.uniqueId('example-');

    var src;
    var srcPath;
    var distUrl;

    // Transpiled JS example
    if ('jsx' === params.lang) {
      src = path.join('js', id + '.js');
      srcPath = resolveSrcPath(src);
      distUrl = resolveDistUrl(srcPath);
    }

    return nunjucks.render(templateFile, {
      id: id,
      src: distUrl,
      content: tokens[idx].content,
      params: params,
      code: code
    });
  };

  return md;
};
