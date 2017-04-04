var _ = require('lodash');
var nunjucks = require('nunjucks');
var parseFenceParams = require('../util').parseFenceParams;
var path = require('path');
var Prism = require('node-prismjs');

var prismLangAliases = {
  html: 'markup'
};

module.exports = function (md) {
  md.renderer.rules.fence_custom.example = function (tokens, idx, options, env, instance) {
    var params = parseFenceParams(tokens[idx].params);
    params.lang = params.lang.toLowerCase();
    var templateFile = md.findPartialTemplate('example');
    var prismLang = _.get(prismLangAliases, params.lang, params.lang);
    var code = Prism.highlight(tokens[idx].content, Prism.languages[prismLang]);
    var id = _.uniqueId('example-');

    // @todo Use dist URL as implemented in `image` plugin.
    var distPath = path.join('js', id + '.js');

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
