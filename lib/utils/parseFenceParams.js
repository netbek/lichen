var _ = require('lodash');
var tokenizeArgString = require('yargs-parser/lib/tokenize-arg-string');
var yargsParser = require('yargs-parser');

/**
 *
 * @param   {string} str
 * @returns {Array}
 */
module.exports = function(str) {
  return yargsParser(
    _.map(tokenizeArgString(str), function(str, index) {
      if (index > 0 && str.substring(0, 1) != '-') {
        var pos = str.indexOf('=');
        var key, delim;

        if (pos < 0) {
          key = str;
          delim = key.length === 1 ? '-' : '--';

          return delim + key;
        }

        key = str.substring(0, pos);
        delim = key.length === 1 ? '-' : '--';

        var value = str.substring(pos + 1);
        if (value.length) {
          value = '="' + value + '"';
        }

        return delim + key + value;
      }

      return str;
    }).join(' ')
  );
};
