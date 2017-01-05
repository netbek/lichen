var _ = require('lodash');
var nunjucks = require('nunjucks');
var yargsParser = require('yargs-parser');

module.exports = function (md) {
  md.renderer.rules.fence_custom.note = function (tokens, idx, options, env, instance) {
    var params = yargsParser(tokens[idx].params, {
      'default': {
        'class': 'note'
      }
    });

    var templateFile = md.findPartialTemplate('note');

    return nunjucks.render(templateFile, {
      content: tokens[idx].content,
      params: params
    });
  };

  return md;
};
