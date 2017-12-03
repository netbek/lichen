var _ = require('lodash');

/**
 *
 * @param   {string} str
 * @returns {string}
 */
module.exports = function(str) {
  return _.trim(str, '-').split('--')[0];
};
