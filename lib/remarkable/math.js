var escapeHtml = require('remarkable/lib/common/utils').escapeHtml;

module.exports = function (md) {
  md.renderer.rules.math = function (tokens, idx, options, env) {
    var input = tokens[idx].content.trim();
    var inline = !tokens[idx].block;

    if (inline) {
      return escapeHtml('\\(' + input + '\\)');
    }

    return '<div>' + escapeHtml('\\[' + input + '\\]') + '</div>' + md.renderer.rules.getBreak(tokens, idx);
  };

  return md;
};
