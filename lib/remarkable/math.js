var _ = require('lodash');
var escapeHtml = require('remarkable/lib/common/utils').escapeHtml;
var nunjucks = require('nunjucks');
var PNG = require('penrose').PNG;
var TEX = require('penrose').TEX;

module.exports = function (md) {
  md.renderer.rules.math = function (tokens, idx, options, env) {
    var input = tokens[idx].content.trim();
    var inline = !tokens[idx].block;

    if (md.config.remarkable.plugins.math.typeset) {
      var inputFormat = TEX;
      var outputFormat = PNG;
      var filename = md.penrose.getMathFilename({
        input: input,
        inputFormat: inputFormat,
        outputFormat: outputFormat
      });
      var output = md.penrose.getMathPath(PNG, filename);
      var formatSrc = _.get(md.config.remarkable.plugins, 'math.formatSrc');

      if (_.isFunction(formatSrc)) {
        output = formatSrc(output);
      }

      var alt = input.replace(/\s/g, ' '); // Replace newline and other whitespace with space.
      var url = md.penrose.getURL(output);
      var templateFile = md.findPartialTemplate('math');

      return nunjucks.render(templateFile, {
        mathInput: input,
        mathInputFormat: inputFormat,
        mathOutput: output,
        mathOutputFormat: outputFormat,
        inline: inline,
        src: url,
        alt: alt
      });
    }

    if (inline) {
      return escapeHtml('\\(' + input + '\\)');
    }

    return '<div>' + escapeHtml('\\[' + input + '\\]') + '</div>' + md.renderer.rules.getBreak(tokens, idx);
  };

  return md;
};
