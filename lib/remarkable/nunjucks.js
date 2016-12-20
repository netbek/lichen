var _ = require('lodash');
var nunjucks = require('nunjucks');
var path = require('path');

module.exports = function (md) {
  md.renderer.rules.fence_custom.nunjucks = function (tokens, idx, options, env, instance) {
    var content = tokens[idx].content;
    var template = nunjucks.compile(content, md.nunjucksEnv);

    return _.unescape(template.render());
  };

  return md;
};
