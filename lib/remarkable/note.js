var _ = require('lodash');
var nunjucks = require('nunjucks');
var path = require('path');

module.exports = function (md) {
  md.renderer.rules.fence_custom.note = function (tokens, idx, options, env, instance) {
    var templateFile = path.resolve(md.config.src, '_includes', 'note.njk');

    return nunjucks.render(templateFile, {
      content: tokens[idx].content
    });
  };

  return md;
};
