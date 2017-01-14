var _ = require('lodash');
var escapeHtml = require('remarkable/lib/common/utils').escapeHtml;
var nunjucks = require('nunjucks');
var path = require('path');

var DEV = require('../toco').DEV;
var PROD = require('../toco').PROD;
var PNG = require('penrose').PNG;
var TEX = require('penrose').TEX;

module.exports = function (md) {
  /**
   *
   * @param  {String} outputFormat
   * @param  {String} uri
   * @return {String}
   */
  function resolveDistPath(outputFormat, uri) {
    var scheme = md.penrose.getScheme(uri);

    if (_.isUndefined(scheme)) {
      var build = md.config.env.dev ? DEV : PROD;
      var target = md.penrose.getTarget(uri);

      return path.join(md.config.files.dist[build].path, 'math', outputFormat, target);
    }

    return uri;
  }

  /**
   *
   * @param  {String} uri
   * @return {String}
   */
  function resolveDistURL(uri) {
    var scheme = md.penrose.getScheme(uri);

    if (_.isUndefined(scheme)) {
      var build = md.config.env.dev ? DEV : PROD;
      var target = md.penrose.getTarget(uri);

      return md.config.files.dist[build].url + target;
    }

    return uri;
  }

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

      var distPath = resolveDistPath(PNG, filename);
      var distURL = resolveDistURL(distPath);
      var alt = input.replace(/\s/g, ' '); // Replace newline and other whitespace with space.
      var templateFile = md.findPartialTemplate('math');

      return nunjucks.render(templateFile, {
        mathInput: input,
        mathInputFormat: inputFormat,
        mathOutput: distPath,
        mathOutputFormat: outputFormat,
        inline: inline,
        src: distURL,
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
