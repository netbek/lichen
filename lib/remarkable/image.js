var _ = require('lodash');
var nunjucks = require('nunjucks');

module.exports = function (md) {
  md.renderer.rules.image = function (tokens, idx, options, env) {
    var src = tokens[idx].src;
    var formatSrc = _.get(md.config.remarkable.plugins, 'image.formatSrc');

    if (_.isFunction(formatSrc)) {
      src = formatSrc(src);
    }

    var url = md.penrose.getURL(src);
    var templateFile = md.findPartialTemplate('image');

    return nunjucks.render(templateFile, {
      src: url,
      alt: tokens[idx].alt,
      title: tokens[idx].title
    });
  };

  return md;
};
