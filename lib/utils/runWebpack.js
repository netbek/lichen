var gutil = require('gulp-util');
var Promise = require('bluebird');
var webpack = require('webpack');
var logWebpackSummary = require('./logWebpackSummary');

/**
 *
 * @param   {Object} config
 * @returns {Promise}
 */
module.exports = function (config) {
  return new Promise(function (resolve, reject) {
    webpack(config, function (err, stats) {
      if (err) {
        gutil.log('[webpack]', err);
      }

      logWebpackSummary(stats);

      resolve();
    });
  });
};
