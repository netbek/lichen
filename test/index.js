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

var DEV = require('..').DEV;
var PROD = require('..').PROD;

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
      'math': {
        ex: 12
      }
    },
    'toco': {
      // Derivative images, rendered LaTeX
      'files': {
        'src': {
          'path': testDir + 'data/files/'
        },
        'dist': {
          // Development (editor) build
          'dev': {
            'path': testDir + 'data/temp/files/',
            'url': '/'
          },
          // Production build
          'prod': {
            'path': testDir + 'data/files/',
            'url': '/'
          }
        }
      },
      // Markdown content, YAML data, Nunjucks templates, rendered HTML
      'pages': {
        'src': {
          'path': testDir + 'data/src/'
        },
        'dist': {
          // Development (editor) build
          'dev': {
            'path': testDir + 'data/temp/',
            'url': '/'
          },
          // Production build
          'prod': {
            'path': testDir + 'data/dist/',
            'url': '/'
          }
        }
      },
      'remarkable': {
        'plugins': {
          'image': {},
          'math': {
            typeset: false
          },
          'responsiveImage': {
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
    var dirs = [];

    _.forEach(config.toco.files.dist, function (build) {
      dirs.push(path.join(build.path, 'math'));
      dirs.push(path.join(build.path, 'styles'));
    });

    _.forEach(config.toco.pages.dist, function (build) {
      dirs.push(path.join(build.path));
    });

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
            return multiGlob([tocoConfig.pages.dist[PROD].path + '**/*'], {
              nodir: true
            });
          });
      };

      var expected = [
        tocoConfig.pages.dist[PROD].path + 'index.html',
        tocoConfig.pages.dist[PROD].path + 'post/first.html'
      ];

      return assert.eventually.deepEqual(actual(), expected);
    });

    it('Should build only content for alpha theme', function () {
      var themeName = 'alpha';
      var tocoConfig = _.assign({}, config.toco, {
        imageStyles: config.imageStyles,
        penrose: config.penrose,
        env: {
          dev: true // Development build
        }
      });

      // Write pages to theme directory
      tocoConfig.pages.dist[DEV].path += themeName + '/';

      // Enable math typesetting
      tocoConfig.remarkable.plugins.math.typeset = true;

      var toco = new Toco(tocoConfig);

      var actual = function () {
        return toco.buildContent({
            themes: [themeName]
          })
          .then(function () {
            return multiGlob([config.toco.pages.dist[DEV].path + '**/*'], {
              nodir: true
            });
          });
      };

      var expected = [
        config.toco.pages.dist[DEV].path + 'index.html'
      ];

      return assert.eventually.deepEqual(actual(), expected);
    });
  });
});
