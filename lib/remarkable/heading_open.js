var toc = require('markdown-toc');

module.exports = function (md) {
  md.renderer.rules.heading_open = function (tokens, idx) {
    return '<h' + tokens[idx].hLevel + ' id=' + toc.slugify(tokens[idx + 1].content) + '>';
  };

  return md;
};
