var gutil = require('gulp-util');

/**
 *
 * @param  {Object} stats
 */
module.exports = function(stats) {
  gutil.log(
    '[webpack]',
    stats.toString({
      colors: gutil.colors.supportsColor,
      hash: false,
      timings: false,
      chunks: false,
      chunkModules: false,
      modules: false,
      children: true,
      version: true,
      cached: false,
      cachedAssets: false,
      reasons: false,
      source: false,
      errorDetails: false
    })
  );
};
