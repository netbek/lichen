var _ = require('lodash');
var chai = require('chai');
var assert = chai.assert;
var chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
var del = require('del');
var multiGlob = require('../lib/util').multiGlob;
var path = require('path');
var Penrose = require('penrose').Penrose;
var Promise = require('bluebird');
var Toco = require('..').Toco;

var PUBLIC = require('penrose').PUBLIC;
var TEMPORARY = require('penrose').TEMPORARY;

describe('Toco', function () {
  var dirAbs = process.cwd() + '/';
  var testDir = __dirname.substring(process.cwd().length + 1) + '/';
  var testDirAbs = __dirname + '/';

  var config = {
    'imageStyles': {
      '600': {
        'actions': [{
          'name': 'resize',
          'width': 600
        }],
        'quality': 80
      },
      '900': {
        'actions': [{
          'name': 'resize',
          'width': 900
        }],
        'quality': 80
      },
      '1200': {
        'actions': [{
          'name': 'resize',
          'width': 1200
        }],
        'quality': 80
      },
      '1800': {
        'actions': [{
          'name': 'resize',
          'width': 1800
        }],
        'quality': 80
      },
      '2400': {
        'actions': [{
          'name': 'resize',
          'width': 2400
        }],
        'quality': 80
      },
      '3600': {
        'actions': [{
          'name': 'resize',
          'width': 3600
        }],
        'quality': 80
      }
    },
    'penrose': {
      'schemes': {
        'public': {
          'path': testDir + 'data/files/'
        },
        'temporary': {
          'path': testDir + 'data/temp/files/'
        }
      },
      'math': {
        ex: 12
      }
    },
    'toco': {
      'src': testDir + 'data/src/',
      'dist': testDir + 'data/dist/',
      'temp': testDir + 'data/temp/',
      'remarkable': {
        'plugins': {
          'image': {
            formatSrc: function (uri) {
              var scheme = penrose.getScheme(uri);

              // If URI has no scheme, then add public scheme.
              if (_.isUndefined(scheme)) {
                return PUBLIC + '://' + uri;
              }

              return uri;
            }
          },
          'math': {
            formatSrc: function (uri) {
              var scheme = penrose.getScheme(uri);

              // If URI has no scheme, then add public scheme.
              if (_.isUndefined(scheme)) {
                return PUBLIC + '://' + uri;
              }

              return uri;
            },
            typeset: false
          },
          'responsiveImage': {
            formatSrc: function (uri) {
              var scheme = penrose.getScheme(uri);

              // If URI has no scheme, then add public scheme.
              if (_.isUndefined(scheme)) {
                return PUBLIC + '://' + uri;
              }

              return uri;
            },
            sizes: '100vw', // '(min-width: 960px) 240px, 100vw',
            srcset: [{
              style: '600',
              width: 600
            }, {
              style: '1200',
              width: 1200
            }]
          }
        }
      }
    }
  };

  /**
   * Deletes test output files.
   *
   * @return {Promise}
   */
  function deleteOutput() {
    var dirs = _.map(config.penrose.schemes, function (scheme) {
      return scheme.path + 'styles/';
    }).concat([
      config.toco.dist,
      config.toco.temp
    ]);

    return del(dirs);
  }

  beforeEach(function (done) {
    deleteOutput()
      .then(function () {
        done();
      });
  });

  after(function (done) {
    deleteOutput()
      .then(function () {
        done();
      });
  });

  var penrose = new Penrose(config.penrose);

  var tocoConfig = _.assign({}, config.toco, {
    imageStyles: config.imageStyles,
    penrose: config.penrose
  });
  var toco = new Toco(tocoConfig);

  describe('findContentTemplate', function () {
    it('Should return absolute path to index template', function () {
      var actual = toco.findContentTemplate('index');
      var expected = dirAbs + 'templates/index.njk';

      assert.equal(actual, expected);
    });

    it('Should return absolute path to template for default single view of any content type', function () {
      var actual = toco.findContentTemplate('single');
      var expected = dirAbs + 'templates/single.njk';

      assert.equal(actual, expected);
    });

    it('Should return absolute path to template for default single view of any content type for given theme', function () {
      var actual = toco.findContentTemplate('single', undefined, 'alpha');
      var expected = testDirAbs + 'data/src/themes/alpha/templates/single.njk';

      assert.equal(actual, expected);
    });

    it('Should return absolute path to template for default view if that view does not exist for given content type', function () {
      var actual = toco.findContentTemplate('single', 'post');
      var expected = dirAbs + 'templates/single.njk';

      assert.equal(actual, expected);
    });

    it('Should return absolute path to template for default view if that view does not exist for given theme', function () {
      var actual = toco.findContentTemplate('single', undefined, 'omega');
      var expected = dirAbs + 'templates/single.njk';

      assert.equal(actual, expected);
    });

    it('Should return absolute path to template for view that does exist for given content type', function () {
      var actual = toco.findContentTemplate('list', 'post');
      var expected = testDirAbs + 'data/src/templates/post/list.njk';

      assert.equal(actual, expected);
    });

    it('Should return absolute path to template for view that does exist for given content type and theme', function () {
      var actual = toco.findContentTemplate('list', 'post', 'alpha');
      var expected = testDirAbs + 'data/src/themes/alpha/templates/post/list.njk';

      assert.equal(actual, expected);
    });
  });

  describe('findPartialTemplate', function () {
    it('Should return absolute path to template for image', function () {
      var actual = toco.findPartialTemplate('image');
      var expected = dirAbs + 'templates/_partials/image.njk';

      assert.equal(actual, expected);
    });
  });

  describe('buildContent', function () {
    it('Should build content', function () {
      var actual = function () {
        return toco.buildContent()
          .then(function () {
            return multiGlob([tocoConfig.dist + '**/*'], {
              nodir: true
            });
          });
      };

      var expected = [
        tocoConfig.dist + 'index.html',
        tocoConfig.dist + 'post/first.html'
      ];

      return assert.eventually.deepEqual(actual(), expected);
    });

    it('Should build only content for alpha theme', function () {
      var themeName = 'alpha';
      var tocoConfig = _.assign({}, config.toco, {
        dist: config.toco.dist + themeName + '/',
        temp: config.toco.temp + themeName + '/',
        imageStyles: config.imageStyles,
        penrose: config.penrose,
        env: {
          dev: true
        }
      });
      _.set(tocoConfig, 'remarkable.plugins.math.typeset', true);
      var toco = new Toco(tocoConfig);

      var actual = function () {
        return toco.buildContent({
            themes: [themeName]
          })
          .then(function () {
            return multiGlob([tocoConfig.temp + '**/*'], {
              nodir: true
            });
          });
      };

      var expected = [
        tocoConfig.temp + 'index.html'
      ];

      return assert.eventually.deepEqual(actual(), expected);
    });
  });
});
