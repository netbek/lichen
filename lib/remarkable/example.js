var _ = require('lodash');
var nunjucks = require('nunjucks');
var parseFenceParams = require('../util').parseFenceParams;
var path = require('path');
var prismLangAliases = {
  html: 'markup'
};

var DEV = require('../lichen').DEV;
var PROD = require('../lichen').PROD;

module.exports = function (md) {
  /**
   *
   * @param  {String} uri
   * @return {String}
   */
  function resolveDistPath(uri) {
    var build = md.config.env.dev ? DEV : PROD;

    return path.join(md.config.files.dist[build].path, 'js', uri);
  }

  md.renderer.rules.fence_custom.example = function (tokens, idx, options, env, instance) {
    var params = parseFenceParams(tokens[idx].params);
    params.lang = params.lang.toLowerCase();
    var templateFile = md.findPartialTemplate('example');
    var prismLang = _.get(prismLangAliases, params.lang, params.lang);
    var code = Prism.highlight(tokens[idx].content, Prism.languages[prismLang]);
    var id = _.uniqueId('example-');
    var distPath = resolveDistPath(id + '.js');

    return nunjucks.render(templateFile, {
      id: id,
      src: distPath,
      content: tokens[idx].content,
      params: params,
      code: code
    });
  };

  return md;
};
