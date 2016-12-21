var _ = require('lodash');
var nunjucks = require('nunjucks');

module.exports = function (md) {
  md.renderer.rules.fence_custom.template = function (tokens, idx, options, env, instance) {
    var content = tokens[idx].content;
    var template = nunjucks.compile(content, md.nunjucksEnv);

    return template.render();
  };

  return md;
};
