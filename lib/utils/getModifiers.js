var _ = require('lodash');

/**
 *
 * @param   {String} str
 * @returns {Array}
 */
module.exports = function(str) {
  return _.difference(
    _.trim(str, '-')
      .split('--')
      .slice(1),
    ['']
  );
};
