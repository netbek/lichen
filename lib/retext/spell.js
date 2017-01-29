var _ = require('lodash');
var fs = require('fs');
var isLiteral = require('nlcst-is-literal');
var nodehun = require('nodehun');
var path = require('path');
var Promise = require('bluebird');
var quote = require('quotation');
var toString = require('nlcst-to-string');
var visit = require('unist-util-visit');

var dictionariesDir = path.resolve(__dirname, '..', '..', 'dictionaries');
var affPath = path.resolve(dictionariesDir, 'en_GB' + '.aff');
var dicPath = path.resolve(dictionariesDir, 'en_GB' + '.dic');
var aff = fs.readFileSync(affPath);
var dic = fs.readFileSync(dicPath);
var dictionary = new nodehun(aff, dic);

var globalCache = [];

function spell(retext, options) {
  var source = 'retext-spell';

  var ignore = _.get(options, 'ignore', []);
  var ignoreDigits = _.get(options, 'ignoreDigits', true);
  var ignoreLiteral = _.get(options, 'ignoreLiteral', true);
  var ignoreUnits = _.get(options, 'ignoreUnits', true);
  var ignoreEmails = _.get(options, 'ignoreEmails', true);
  var checkAllOccurrences = _.get(options, 'checkAllOccurrences', false);

  /**
   *
   * @param  {String} word
   * @return {Boolean}
   */
  function shouldIgnore(word) {
    return _.includes(ignore, word) || (ignoreDigits && /^\d+$/.test(word));
  }

  /**
   *
   * @param  {String} word
   * @return {Promise}
   */
  function checkSpelling(word) {
    return new Promise(function (resolve, reject) {
      dictionary.spellSuggestions(word, function (err, correct, suggestions, origWord) {
        if (err) {
          reject(err);
        }
        else if (correct) {
          resolve(true);
        }
        else {
          resolve({
            word: word,
            suggestions: suggestions
          });
        }
      });
    });
  }

  return function (tree, file) {
    var nodes = [];

    // @see https://github.com/sparkartgroup/quality-docs (MIT license)
    if (ignoreEmails || ignoreUnits) {
      visit(tree, 'WordNode', function (node, index, parent) {
        var word = toString(node);

        // @todo Optimise
        var units = ['GB', 'MB', 'KB', 'K', 'am', 'pm', 'in', 'ft', '-', 'x'];
        var unitFilter = new RegExp('^\\d+(' + units.join('|') + ')+\\d*(' + units.join('|') + ')*$', 'i');
        var emailFilter = new RegExp('^[-a-z0-9~!$%^&*_=+}{\'?]+(\.[-a-z0-9~!$%^&*_=+}{\'?]+)*@([a-z0-9_][-a-z0-9_]*(\.[-a-z0-9_]+)*\.(aero|arpa|biz|com|coop|edu|gov|info|int|mil|museum|name|net|org|pro|travel|mobi|[a-z][a-z])|([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}))(:[0-9]{1,5})?$', 'i');

        if ((ignoreEmails && emailFilter.test(word)) || (ignoreUnits && unitFilter.test(word))) {
          parent.children[index] = {
            type: 'SourceNode',
            value: word,
            position: node.position
          };
        }
      });
    }

    visit(tree, 'WordNode', function (node, index, parent) {
      var word = toString(node);

      if (!checkAllOccurrences && globalCache.indexOf(word) > -1) {
        return;
      }

      if (ignoreLiteral && isLiteral(parent, index)) {
        return;
      }

      if (shouldIgnore(word)) {
        return;
      }

      nodes.push(node);

      if (!checkAllOccurrences) {
        globalCache.push(word);
      }
    });

    return Promise.mapSeries(nodes, function (node) {
      var word = toString(node);

      return checkSpelling(word)
        .then(function (result) {
          if (true !== result) {
            var reason = quote(result.word, '`') + ' is misspelt';

            if (result.suggestions.length) {
              reason += '; did you mean ' + quote(result.suggestions, '`').join(', ') + '?';
            }

            var message = file.message(reason, node, source);
            message.source = source;
          }

          return Promise.resolve();
        });
    });
  };
}

module.exports = spell;
