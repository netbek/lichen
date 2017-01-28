var _ = require('lodash');
var chalk = require('chalk');
var cheerio = require('cheerio');
var dictionary = require('dictionary-en-gb');
var equality = require('retext-equality');
var intensify = require('retext-intensify');
var Promise = require('bluebird');
var readability = require('retext-readability');
var retext = require('retext');
var simplify = require('retext-simplify');
var spell = require('retext-spell');
var toString = require('nlcst-to-string');
var visit = require('unist-util-visit');

module.exports = function (config) {
  var blacklist = config.retext.selectors.blacklist.join(', ');
  var whitelist = config.retext.selectors.whitelist.join(', ');

  var spellConfig = _.assign(_.cloneDeep(config.retext.rules.spell), {
    dictionary: dictionary
  });

  /**
   *
   * @param  {String} text
   * @param  {String} filePath
   * @return {Promise}
   */
  function checkText(text, filePath) {
    if (!text.length) {
      return Promise.resolve();
    }

    return new Promise(function (resolve, reject) {
      retext()
        .use(readability, config.retext.rules.readability)
        .use(simplify)
        .use(intensify)
        .use(equality, config.retext.rules.equality)
        .use(function () {
          // @see https://github.com/sparkartgroup/quality-docs (MIT license)
          return function (tree) {
            visit(tree, 'WordNode', function (node, index, parent) {
              var word = toString(node);

              var unitArr = config.retext.units || ['GB', 'MB', 'KB', 'K', 'am', 'pm', 'in', 'ft'];
              unitArr = unitArr.concat(['-', 'x']); // Add ranges and dimensions to RegExp
              var units = unitArr.join('|');

              // Ignore email addresses and the following types of non-words:
              // 500GB, 8am-6pm, 10-11am, 1024x768, 3x5in, etc
              var unitFilter = new RegExp('^\\d+(' + units + ')+\\d*(' + units + ')*$', 'i');
              var emailFilter = new RegExp('^[-a-z0-9~!$%^&*_=+}{\'?]+(\.[-a-z0-9~!$%^&*_=+}{\'?]+)*@([a-z0-9_][-a-z0-9_]*(\.[-a-z0-9_]+)*\.(aero|arpa|biz|com|coop|edu|gov|info|int|mil|museum|name|net|org|pro|travel|mobi|[a-z][a-z])|([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}))(:[0-9]{1,5})?$', 'i');
              if (emailFilter.test(word) || unitFilter.test(word)) {
                parent.children[index] = {
                  type: 'SourceNode',
                  value: word,
                  position: node.position
                };
              }
            });
          };
        })
        .use(spell, spellConfig)
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

        var values = $(whitelist).map(function (i, el) {
          var text = $(this).text();

          // Replace newline characters with single space character.
          text = text.replace(/(\r\n|\n|\r)+/gm, ' ');

          // Replace multiple whitespace characters with single space character.
          text = text.replace(/\s+/g, ' ');

          text = text.trim();

          return text;
        }).get();

        Promise.mapSeries(values, function (text) {
            return checkText(text, filePath);
          })
          .then(function () {
            resolve(html);
          });
      });
    }
  };

  return new Hook();
};
