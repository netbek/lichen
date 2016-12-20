var _ = require('lodash');
var nunjucks = require('nunjucks');
var path = require('path');

module.exports = function (md) {
  md.renderer.rules.image = function (tokens, idx, options, env) {
    var templateFile = path.resolve(md.config.src, '_includes', 'image.njk');

    return nunjucks.render(templateFile, {
      src: tokens[idx].src,
      alt: tokens[idx].alt,
      title: tokens[idx].title
    });
  };

  return md;
};
