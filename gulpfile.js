const {browserslist} = require('./package.json');
var autoprefixer = require('gulp-autoprefixer');
var cssmin = require('gulp-cssmin');
var gulp = require('gulp');
var rename = require('gulp-rename');
var sass = require('gulp-sass')(require('node-sass'));
var uglify = require('gulp-uglify');

var config = {
  autoprefixer: {
    overrideBrowserslist: browserslist
  },
  css: {
    params: {
      includePaths: ['node_modules/bourbon/app/assets/stylesheets/'],
      errLogToConsole: true
    }
  }
};

/* -----------------------------------------------------------------------------
Functions
----------------------------------------------------------------------------- */

/**
 *
 * @param  {string} src
 * @param  {string} dist
 * @returns {Stream}
 */
function buildCss(src, dist) {
  return gulp
    .src(src)
    .pipe(sass(config.css.params).on('error', sass.logError))
    .pipe(autoprefixer(config.autoprefixer))
    .pipe(gulp.dest(dist))
    .pipe(
      cssmin({
        advanced: false
      })
    )
    .pipe(
      rename({
        suffix: '.min'
      })
    )
    .pipe(gulp.dest(dist));
}

/**
 *
 * @param  {string} src
 * @param  {string} dist
 * @returns {Stream}
 */
function buildJs(src, dist) {
  return gulp
    .src(src)
    .pipe(gulp.dest(dist))
    .pipe(
      rename({
        suffix: '.min'
      })
    )
    .pipe(uglify())
    .pipe(gulp.dest(dist));
}

/* -----------------------------------------------------------------------------
Tasks
----------------------------------------------------------------------------- */

gulp.task('build-css', function(cb) {
  buildCss('src/css/**/*.scss', 'css/').on('end', cb);
});

gulp.task('build-js', function(cb) {
  buildJs('src/js/**/*.js', 'js/').on('end', cb);
});

gulp.task('build', gulp.series('build-css', 'build-js'));

/* -----------------------------------------------------------------------------
Default task
----------------------------------------------------------------------------- */

gulp.task('default', gulp.series('build'));
