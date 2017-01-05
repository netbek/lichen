var _ = require('lodash');
var autoprefixer = require('gulp-autoprefixer');
var cssmin = require('gulp-cssmin');
var gulp = require('gulp');
var rename = require('gulp-rename');
var runSequence = require('run-sequence');
var sass = require('gulp-sass');
var uglify = require('gulp-uglify');

var config = {
  'autoprefixer': {
    'browsers': [
      'last 2 versions',
      'ie >= 8',
      'ff >= 5',
      'chrome >= 20',
      'opera >= 12',
      'safari >= 4',
      'ios >= 6',
      'android >= 2',
      'bb >= 6'
    ]
  },
  'css': {
    'params': {
      'includePaths': [
        'bower_components/bourbon/app/assets/stylesheets/',
        'bower_components/breakpoint-sass/stylesheets/',
        'bower_components/mathsass/dist/',
        'bower_components/modernizr-mixin/stylesheets/',
        'bower_components/singularity/stylesheets/'
      ],
      'errLogToConsole': true
    }
  }
};

/*******************************************************************************
 * Functions
 ******************************************************************************/

/**
 *
 * @param  {String} src
 * @param  {String} dist
 * @return {Stream}
 */
function buildCss(src, dist) {
  return gulp
    .src(src)
    .pipe(sass(config.css.params).on('error', sass.logError))
    .pipe(autoprefixer(config.autoprefixer))
    .pipe(gulp.dest(dist))
    .pipe(cssmin({
      advanced: false
    }))
    .pipe(rename({
      suffix: '.min'
    }))
    .pipe(gulp.dest(dist));
}

/**
 *
 * @param  {String} src
 * @param  {String} dist
 * @return {Stream}
 */
function buildJs(src, dist) {
  return gulp
    .src(src)
    .pipe(gulp.dest(dist))
    .pipe(rename({
      suffix: '.min'
    }))
    .pipe(uglify())
    .pipe(gulp.dest(dist));
}

/*******************************************************************************
 * Tasks
 ******************************************************************************/

gulp.task('build-css', function (cb) {
  buildCss('src/css/**/*.scss', 'css/')
    .on('end', cb);
});

gulp.task('build-js', function (cb) {
  buildJs('src/js/**/*.js', 'js/')
    .on('end', cb);
});

gulp.task('build', function (cb) {
  runSequence(
    'build-css',
    'build-js',
    cb
  );
});

/*******************************************************************************
 * Default task
 ******************************************************************************/

gulp.task('default', ['build']);
