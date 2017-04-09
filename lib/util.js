var _ = require('lodash');
var fs = require('fs-extra');
var glob = require('glob');
var globPromise = require('glob-promise');
var gutil = require('gulp-util');
var path = require('path');
var Promise = require('bluebird');
var tokenizeArgString = require('yargs-parser/lib/tokenize-arg-string');
var webpack = require('webpack');
var yargsParser = require('yargs-parser');

var mediaUrlPatternsByType = {
  'vimeo': [
    'vimeo\.com/(\\d+)',
    'vimeo\.com/video/(\\d+)',
    'vimeo\.com/groups/.+/videos/(\\d+)',
    'vimeo\.com/channels/.+#(\\d+)'
  ],
  'youtube': [
    'youtube\.com/watch[#\?].*?v=([^"\& ]+)',
    'youtube\.com/embed/([^"\&\? ]+)',
    'youtube\.com/v/([^"\&\? ]+)',
    'youtube\.com/\?v=([^"\& ]+)',
    'youtu\.be/([^"\&\? ]+)',
    'gdata\.youtube\.com/feeds/api/videos/([^"\&\? ]+)'
  ]
};

var mediaUrlPatterns = [];
_.forEach(mediaUrlPatternsByType, function (patterns, type) {
  _.forEach(patterns, function (pattern) {
    mediaUrlPatterns.push({
      pattern: pattern,
      type: type
    });
  });
});

/**
 *
 * @param  {Array} patterns
 * @param  {Object} options
 * @return {Promise}
 */
function multiGlobAsync(patterns, options) {
  var matches = [];

  return Promise.mapSeries(patterns, function (pattern) {
      return globPromise(pattern, options)
        .then(function (files) {
          matches = matches.concat(files);
        });
    })
    .then(function () {
      return Promise.resolve(matches);
    });
}

/**
 *
 * @param  {Array} patterns
 * @param  {Object} options
 * @return {Array}
 */
function multiGlobSync(patterns, options) {
  var matches = [];

  _.forEach(patterns, function (pattern) {
    matches = matches.concat(glob.sync(pattern, options));
  });

  return matches;
}

/**
 *
 * @param  {String} str
 * @return {Array}
 */
function parseFenceParams(str) {
  return yargsParser(_.map(tokenizeArgString(str), function (str, index) {
    if (index > 0 && str.substring(0, 1) != '-') {
      var pos = str.indexOf('=');
      var key, delim;

      if (pos < 0) {
        key = str;
        delim = (key.length === 1 ? '-' : '--');

        return delim + key;
      }

      key = str.substring(0, pos);
      delim = (key.length === 1 ? '-' : '--');

      var value = str.substring(pos + 1);
      if (value.length) {
        value = '="' + value + '"';
      }

      return delim + key + value;
    }

    return str;
  }).join(' '));
}

/**
 * Parses a YouTube or Vimeo URL and returns media ID and type.
 *
 * @param  {String} url
 * @param  {String} type
 * @return {String}
 */
function parseMediaUrl(url, type) {
  var i;
  var len;
  var matches;

  // If type is not given, then check all patterns until a match is found.
  if (_.isUndefined(type)) {
    var mediaUrlPattern;

    for (i = 0, len = mediaUrlPatterns.length; i < len; i++) {
      mediaUrlPattern = mediaUrlPatterns[i];
      matches = url.match(new RegExp(mediaUrlPattern.pattern, 'i'));

      if (_.isArray(matches) && matches[1]) {
        return {
          mediaId: matches[1],
          type: mediaUrlPattern.type
        };
      }
    }

    return {};
  }

  // If type is given, then check all patterns of that type until a match is found.
  var patterns = mediaUrlPatternsByType[type];

  for (i = 0, len = patterns.length; i < len; i++) {
    matches = url.match(new RegExp(patterns[i], 'i'));

    if (_.isArray(matches) && matches[1]) {
      return {
        mediaId: matches[1],
        type: type
      };
    }
  }

  return {};
}

/**
 *
 * @param   {Object} config
 * @returns {Promise}
 */
function runWebpack(config) {
  return new Promise(function (resolve, reject) {
    webpack(config, function (err, stats) {
      if (err) {
        gutil.log('[webpack]', err);
      }

      gutil.log('[webpack]', stats.toString({
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
      }));

      resolve();
    });
  });
}

/**
 *
 * @param  {String} str
 * @return {Array}
 */
function getModifiers(str) {
  return _.difference(_.trim(str, '-').split('--').slice(1), ['']);
}

/**
 *
 * @param  {String} str
 * @return {String}
 */
function stripModifiers(str) {
  return _.trim(str, '-').split('--')[0];
}

/**
 *
 * @param  {String} file File basename, file basename with extension, or path
 * @param  {Array} dirs
 * @param  {Array} extnames
 * @return {String}
 */
function findFile(file, dirs, extnames) {
  var i, il, j, jl, dir, extname, str;

  if (file.substring(0, 1) === '/' || file.substring(0, 2) === './' || file.substring(0, 3) === '../') {
    if (fs.existsSync(file)) {
      return file;
    }

    for (i = 0, il = extnames.length; i < il; i++) {
      extname = extnames[i];
      str = file + extname;
      if (fs.existsSync(str)) {
        return str;
      }
    }

    return;
  }

  for (i = 0, il = dirs.length; i < il; i++) {
    dir = dirs[i];
    str = path.resolve(dir, file);
    if (fs.existsSync(str)) {
      return str;
    }
  }

  for (i = 0, il = dirs.length; i < il; i++) {
    dir = dirs[i];
    for (j = 0, jl = extnames.length; j < jl; j++) {
      extname = extnames[j];
      str = path.resolve(dir, file + extname);
      if (fs.existsSync(str)) {
        return str;
      }
    }
  }
}

module.exports = {
  /**
   * Constants
   */
  VIMEO: 'vimeo',
  YOUTUBE: 'youtube',
  findFile: findFile,
  getModifiers: getModifiers,
  multiGlobAsync: multiGlobAsync,
  multiGlobSync: multiGlobSync,
  parseFenceParams: parseFenceParams,
  parseMediaUrl: parseMediaUrl,
  runWebpack: runWebpack,
  stripModifiers: stripModifiers
};
