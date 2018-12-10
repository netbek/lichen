const _ = require('lodash');
const cheerio = require('cheerio');
const fs = require('fs-extra');
const mathjax = require('mathjax-node/lib/mj-page.js');
const nunjucks = require('nunjucks');
const path = require('path');
const {Penrose} = require('penrose');
const Promise = require('bluebird');

// Builds.
const {DEV, PROD} = require('../lichen');

// Formats.
const {PNG, TEX} = require('penrose');

Promise.promisifyAll(fs);

fs.existsAsync = Promise.promisify(function exists2(path, exists2callback) {
  fs.exists(path, function callbackWrapper(exists) {
    exists2callback(null, exists);
  });
});

mathjax.config({
  displayErrors: false,
  displayMessages: false,
  undefinedCharError: false
});

module.exports = function(config) {
  var penrose = new Penrose(config.penrose);

  /**
   *
   * @param  {string} outputFormat
   * @param  {string} uri
   * @returns {string}
   */
  function resolveDistPath(outputFormat, uri) {
    var scheme = penrose.getScheme(uri);

    if (_.isUndefined(scheme)) {
      var build = config.env.dev ? DEV : PROD;
      var target = penrose.getTarget(uri);

      return path.join(
        config.files.dist[build].path,
        'math',
        outputFormat,
        target
      );
    }

    return uri;
  }

  /**
   *
   * @param  {string} uri
   * @returns {string}
   */
  function resolveDistUrl(uri) {
    var scheme = penrose.getScheme(uri);

    if (_.isUndefined(scheme)) {
      var build = config.env.dev ? DEV : PROD;
      var target = penrose.getTarget(uri);
      var urlBase = _.get(config.files.dist[build], 'urlBase', '');

      if (urlBase.length && target.substring(0, urlBase.length) === urlBase) {
        target = target.substring(urlBase.length);
      }

      return path.join(config.files.dist[build].url, target);
    }

    return uri;
  }

  function Hook() {}

  Hook.prototype = {
    constructor: Hook,
    /**
     *
     * @param {string} html
     * @returns {Promise}
     */
    run: function(html) {
      return new Promise(function(resolve, reject) {
        mathjax.typeset(
          {
            addPreview: false,
            html: html,
            inputs: ['TeX'],
            removeJax: false,
            renderer: 'SVG'
          },
          function(result) {
            if (result.errors) {
              reject(result.errors);
            } else {
              var $ = cheerio.load(result.html);

              $(
                '#MathJax_SVG_styles, .MathJax_SVG, .MathJax_SVG_Display'
              ).remove();
              $('#MathJax_SVG_glyphs')
                .parent()
                .remove();

              var tasks = [];

              $('script[type^="math/tex"]').each(function(i, elm) {
                var $this = $(this);
                var inline = $this.attr('type').indexOf('mode=display') < 0;
                var input = $this.text();
                var inputFormat = TEX;
                var outputFormat = PNG;
                var filename = penrose.getMathFilename({
                  input: input,
                  inputFormat: inputFormat,
                  outputFormat: outputFormat
                });
                var distPath = resolveDistPath(outputFormat, filename);
                var distUrl = resolveDistUrl(distPath);
                var alt = input.replace(/\s/g, ' '); // Replace newline and other whitespace with space.

                var templatName = 'math';
                var templateFile = config.findPartialTemplate(templatName);

                if (_.isUndefined(templateFile)) {
                  throw new Error('Partial template not found: ' + templatName);
                }

                var html = nunjucks.render(templateFile, {
                  inline: inline,
                  src: distUrl,
                  alt: alt
                });

                tasks.push({
                  input: input,
                  inputFormat: inputFormat,
                  output: distPath,
                  outputFormat: outputFormat
                });

                $this.replaceWith(html);
              });

              var html = $.html();

              Promise.mapSeries(tasks, function(task) {
                var outputResolved = penrose.resolvePath(task.output);

                return fs.existsAsync(outputResolved).then(function(exists) {
                  if (exists) {
                    return Promise.resolve(true);
                  }

                  return penrose.createMathFile(task);
                });
              }).then(function() {
                resolve(html);
              });
            }
          }
        );
      });
    }
  };

  return new Hook(config);
};
