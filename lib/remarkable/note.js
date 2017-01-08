var _ = require('lodash');
var nunjucks = require('nunjucks');
var parseFenceParams = require('../util').parseFenceParams;

module.exports = function (md) {
  md.renderer.rules.fence_custom.note = function (tokens, idx, options, env, instance) {
    var params = parseFenceParams(tokens[idx].params);
    var templateFile = md.findPartialTemplate('note');

    return nunjucks.render(templateFile, {
      content: tokens[idx].content,
      params: params
    });
  };

  return md;
};
