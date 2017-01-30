var _ = require('lodash');
var chalk = require('chalk');
var cheerio = require('cheerio');
var contractions = require('retext-contractions');
var diacritics = require('retext-diacritics');
var english = require('retext-english');
var equality = require('retext-equality');
var indefiniteArticle = require('retext-indefinite-article');
var intensify = require('retext-intensify');
var passive = require('retext-passive');
var profanities = require('retext-profanities');
var Promise = require('bluebird');
var quotes = require('retext-quotes');
var readability = require('retext-readability');
var redundantAcronyms = require('retext-redundant-acronyms');
var repeatedWords = require('retext-repeated-words');
var retext = require('retext');
var sentenceSpacing = require('retext-sentence-spacing');
var simplify = require('retext-simplify');
var spell = require('../retext/spell');

module.exports = function (config) {
  var blacklist = config.retext.selectors.blacklist.join(', ');
  var whitelist = config.retext.selectors.whitelist.join(', ');

  var flags = {
    english: false
  };
  var plugins = [];
  _.forEach(config.retext.rules, function (options, name) {
    if ('contractions' === name) {
      if (!flags.english) {
        plugins.push([english]);
      }
      flags.english = true;

      // [Options]{@link https://github.com/wooorm/retext-contractions#api}
      plugins.push([contractions, options]);
    }
    else if ('diacritics' === name) {
      // [Options]{@link https://github.com/wooorm/retext-diacritics#api}
      plugins.push([diacritics, options]);
    }
    else if ('equality' === name) {
      // [Options]{@link https://github.com/wooorm/retext-equality#api}
      plugins.push([equality, options]);
    }
    else if ('indefiniteArticle' === name) {
      if (!flags.english) {
        plugins.push([english]);
      }
      flags.english = true;

      // [Options]{@link https://github.com/wooorm/retext-indefinite-article#api}
      plugins.push([indefiniteArticle]);
    }
    else if ('intensify' === name) {
      // [Options]{@link https://github.com/wooorm/retext-intensify#api}
      plugins.push([intensify, options]);
    }
    else if ('passive' === name) {
      // [Options]{@link https://github.com/wooorm/retext-passive#api}
      plugins.push([passive]);
    }
    else if ('profanities' === name) {
      // [Options]{@link https://github.com/wooorm/retext-profanities#api}
      plugins.push([profanities, options]);
    }
    else if ('quotes' === name) {
      if (!flags.english) {
        plugins.push([english]);
      }
      flags.english = true;

      // [Options]{@link https://github.com/wooorm/retext-quotes#api}
      plugins.push([quotes, options]);
    }
    else if ('readability' === name) {
      // [Options]{@link https://github.com/wooorm/retext-readability#api
      plugins.push([readability, options]);
    }
    else if ('redundantAcronyms' === name) {
      // [Options]{@link https://github.com/wooorm/retext-redundant-acronyms#api
      plugins.push([redundantAcronyms]);
    }
    else if ('repeatedWords' === name) {
      if (!flags.english) {
        plugins.push([english]);
      }
      flags.english = true;

      // [Options]{@link https://github.com/wooorm/retext-repeated-words#api
      plugins.push([repeatedWords]);
    }
    else if ('sentenceSpacing' === name) {
      // [Options]{@link https://github.com/wooorm/retext-sentence-spacing#api
      plugins.push([sentenceSpacing, options]);
    }
    else if ('simplify' === name) {
      // [Options]{@link https://github.com/wooorm/retext-simplify#api
      plugins.push([simplify, options]);
    }
    else if ('spell' === name) {
      // [Options]{@link https://github.com/wooorm/retext-spell#api
      plugins.push([spell, options]);
    }
    else {
      throw new Error('Rule `' + name + '` is not supported');
    }
  });

  /**
   *
   * @param  {String} text
   * @param  {String} filePath
   * @return {Promise}
   */
  function checkChunk(text, filePath) {
    return new Promise(function (resolve, reject) {
      retext()
        .use(plugins)
        .process(text, function (err, file) {
          if (file.messages.length) {
            var messages = _.map(file.messages, function (message) {
              return {
                source: message.source,
                message: message.message
              };
            });

            messages = _.uniqWith(messages, _.isEqual);

            if (filePath) {
              console.log('Spelling and grammar suggestions', chalk.cyan(filePath));
            }
            else {
              console.log('Spelling and grammar suggestions');
            }

            console.log('  ' + text);

            _.forEach(messages, function (message) {
              var color = 'retext-spell' === message.source ? 'yellow' : 'green';
              console.log(chalk[color]('   - ' + message.message));
            });
          }

          resolve();
        });
    });
  }

  function Hook() {}

  Hook.prototype = {
    constructor: Hook,
    /**
     *
     * @param {String} html
     * @param {String} filePath
     * @return {Promise}
     */
    run: function (html, filePath) {
      return new Promise(function (resolve, reject) {
        var $ = cheerio.load(html);

        if (blacklist) {
          $(blacklist).remove();
        }

        var chunks = $(whitelist).map(function (i, el) {
          var text = $(this).text();

          // Replace newline characters with single space character.
          text = text.replace(/(\r\n|\n|\r)+/gm, ' ');

          // Replace multiple whitespace characters with single space character.
          text = text.replace(/\s+/g, ' ');

          text = text.trim();

          return text;
        }).get();

        // Remove empty chunks.
        chunks = _.filter(chunks, function (chunk) {
          return chunk.length > 0;
        });

        Promise.mapSeries(chunks, function (chunk) {
            return checkChunk(chunk, filePath);
          })
          .then(function () {
            resolve(html);
          });
      });
    }
  };

  return new Hook();
};
