var _ = require('lodash');
var nunjucks = require('nunjucks');

module.exports = function (md) {
  md.renderer.rules.image = function (tokens, idx, options, env) {
    var templateFile = md.findPartialTemplate('image');

    return nunjucks.render(templateFile, {
      src: tokens[idx].src,
      alt: tokens[idx].alt,
      title: tokens[idx].title
    });
  };

  return md;
};
