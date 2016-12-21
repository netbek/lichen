var _ = require('lodash');
var nunjucks = require('nunjucks');

module.exports = function (md) {
  md.renderer.rules.fence_custom.note = function (tokens, idx, options, env, instance) {
    var templateFile = md.findPartialTemplate('note');

    return nunjucks.render(templateFile, {
      content: tokens[idx].content
    });
  };

  return md;
};
