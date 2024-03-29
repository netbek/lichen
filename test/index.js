var _ = require('lodash');
var chai = require('chai');
var {assert} = chai;
var chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
var fs = require('fs-extra');
var globby = require('globby');
var path = require('path');
var Promise = require('bluebird');
var {Penrose} = require('penrose');
var {Lichen} = require('..');

var {DEV, PROD, POST_RENDER_HTML} = require('..');

describe('Lichen', function () {
  var dirAbs = process.cwd() + '/';
  var testDir = __dirname.substring(process.cwd().length + 1) + '/';
  var testDirAbs = __dirname + '/';

  var config = {
    imageStyles: {
      600: {
        actions: [
          {
            name: 'resize',
            width: 600
          }
        ],
        quality: 80
      },
      900: {
        actions: [
          {
            name: 'resize',
            width: 900
          }
        ],
        quality: 80
      },
      1200: {
        actions: [
          {
            name: 'resize',
            width: 1200
          }
        ],
        quality: 80
      },
      1800: {
        actions: [
          {
            name: 'resize',
            width: 1800
          }
        ],
        quality: 80
      },
      2400: {
        actions: [
          {
            name: 'resize',
            width: 2400
          }
        ],
        quality: 80
      },
      3600: {
        actions: [
          {
            name: 'resize',
            width: 3600
          }
        ],
        quality: 80
      }
    },
    linkchecker: {
      baseURL: 'http://www.example.com',
      ignoreFragments: true,
      schemes: ['http', 'https']
    },
    penrose: {
      math: {
        ex: 12
      }
    },
    retext: {
      selectors: {
        whitelist: [
          'p',
          'li',
          'h1',
          'h2',
          'h3',
          'h4',
          'th',
          'td',
          'dl',
          'figcaption'
        ],
        blacklist: ['pre', 'code']
      },
      rules: {
        contractions: {
          allowLiterals: false,
          straight: false
        },
        diacritics: {
          ignore: []
        },
        equality: {
          ignore: [],
          noBinary: true
        },
        indefiniteArticle: {},
        intensify: {
          ignore: []
        },
        passive: {},
        profanities: {
          ignore: []
        },
        quotes: {
          preferred: 'smart',
          smart: ['“”', '‘’'],
          straight: ['"', "'"]
        },
        readability: {
          age: 16,
          threshold: 4 / 7,
          minWords: 5
        },
        redundantAcronyms: {},
        repeatedWords: {},
        sentenceSpacing: {
          preferred: 1
        },
        simplify: {
          ignore: []
        },
        spell: {
          checkAllOccurrences: false,
          ignore: [],
          ignoreCurrency: true,
          ignoreDigits: true,
          ignoreEmail: true,
          ignoreFQDN: true,
          ignoreLiteral: true,
          ignoreUnits: true,
          ignoreURL: true
        }
      }
    },
    lichen: {
      // Derivative images, rendered LaTeX, transpiled JS examples
      files: {
        src: {
          path: testDir + 'data/files/'
        },
        dist: {
          // Development (editor) build
          dev: {
            path: testDir + 'data/temp/files/',
            url: '/'
          },
          // Production build
          prod: {
            path: testDir + 'data/files/',
            url: '/'
          }
        },
        temp: {
          path: testDir + 'data/temp/'
        }
      },
      // Markdown content, YAML data, Nunjucks templates, rendered HTML
      pages: {
        src: {
          path: testDir + 'data/src/'
        },
        dist: {
          // Development (editor) build
          dev: {
            path: testDir + 'data/temp/',
            url: '/'
          },
          // Production build
          prod: {
            path: testDir + 'data/dist/',
            url: '/'
          }
        }
      },
      remarkable: {
        rulesConfig: {
          image: {},
          responsiveImage: {
            sizes: '100vw', // '(min-width: 960px) 240px, 100vw',
            srcset: [
              {
                style: '600',
                width: 600
              },
              {
                style: '1200',
                width: 1200
              }
            ]
          }
        }
      },
      webpack: {
        mode: 'production',
        externals: {
          jquery: 'jQuery',
          react: 'React',
          'react-dom': 'ReactDOM'
        },
        resolve: {
          extensions: ['.js', '.jsx']
        },
        module: {
          rules: [
            // React
            {
              test: /\.jsx$/,
              exclude: /node_modules/,
              loader: 'babel-loader?cacheDirectory',
              options: {
                presets: ['@babel/preset-env', '@babel/preset-react']
              }
            }
          ]
        }
      },
      hooks: []
    }
  };

  /**
   * Deletes test output files.
   *
   * @returns {Promise}
   */
  function deleteOutput() {
    var dirs = [];

    _.forEach(config.lichen.files.dist, function (build) {
      dirs.push(path.join(build.path, 'js'));
      dirs.push(path.join(build.path, 'math'));
      dirs.push(path.join(build.path, 'styles'));
    });

    _.forEach(config.lichen.pages.dist, function (build) {
      dirs.push(path.join(build.path));
    });

    _.forEach(config.lichen.pages.temp, function (build) {
      dirs.push(path.join(build.path));
    });

    return Promise.mapSeries(dirs, (dir) => fs.remove(dir));
  }

  beforeEach(function (done) {
    deleteOutput().then(function () {
      done();
    });
  });

  after(function (done) {
    deleteOutput().then(function () {
      done();
    });
  });

  var penrose = new Penrose(config.penrose);

  var lichenConfig = _.assign({}, config.lichen, {
    imageStyles: config.imageStyles,
    penrose: config.penrose
  });
  var lichen = new Lichen(lichenConfig);

  describe('findContentTemplate', function () {
    it('Should return absolute path to index template', function () {
      var actual = lichen.findContentTemplate('index');
      var expected = dirAbs + 'templates/index.njk';

      assert.equal(actual, expected);
    });

    it('Should return absolute path to template for default single view of any content type', function () {
      var actual = lichen.findContentTemplate('single');
      var expected = dirAbs + 'templates/single.njk';

      assert.equal(actual, expected);
    });

    it('Should return absolute path to template for default single view of any content type for given theme', function () {
      var actual = lichen.findContentTemplate('single', undefined, 'alpha');
      var expected = testDirAbs + 'data/src/themes/alpha/templates/single.njk';

      assert.equal(actual, expected);
    });

    it('Should return absolute path to template for default view if that view does not exist for given content type', function () {
      var actual = lichen.findContentTemplate('single', 'post');
      var expected = dirAbs + 'templates/single.njk';

      assert.equal(actual, expected);
    });

    it('Should return absolute path to template for default view if that view does not exist for given theme', function () {
      var actual = lichen.findContentTemplate('single', undefined, 'omega');
      var expected = dirAbs + 'templates/single.njk';

      assert.equal(actual, expected);
    });

    it('Should return absolute path to template for view that does exist for given content type', function () {
      var actual = lichen.findContentTemplate('list', 'post');
      var expected = testDirAbs + 'data/src/templates/post/list.njk';

      assert.equal(actual, expected);
    });

    it('Should return absolute path to template for view that does exist for given content type and theme', function () {
      var actual = lichen.findContentTemplate('list', 'post', 'alpha');
      var expected =
        testDirAbs + 'data/src/themes/alpha/templates/post/list.njk';

      assert.equal(actual, expected);
    });
  });

  describe('findPartialTemplate', function () {
    it('Should return absolute path to template for image', function () {
      var actual = lichen.findPartialTemplate('image');
      var expected = dirAbs + 'templates/_partials/image.njk';

      assert.equal(actual, expected);
    });
  });

  describe('buildContent', function () {
    this.timeout(0);

    it('Should build content', function () {
      var actual = function () {
        return lichen.buildContent().then(function () {
          return globby([lichenConfig.pages.dist[PROD].path + '**/*'], {
            onlyFiles: true
          });
        });
      };

      var expected = [
        lichenConfig.pages.dist[PROD].path + 'index.html',
        lichenConfig.pages.dist[PROD].path + 'post/first.html'
      ];

      return assert.eventually.deepEqual(actual(), expected);
    });

    it('Should build only content for omega theme', function () {
      var themeName = 'omega';
      var lichenConfig = _.assign({}, config.lichen, {
        imageStyles: config.imageStyles,
        linkchecker: config.linkchecker,
        penrose: config.penrose,
        retext: config.retext,
        env: {
          dev: true // Development build
        }
      });

      // Write pages to theme directory
      lichenConfig.pages.dist[DEV].path += themeName + '/';

      // Math typesetting
      lichenConfig.hooks.push({
        event: POST_RENDER_HTML,
        hook: 'math'
      });

      // Spell and grammar checking
      lichenConfig.hooks.push({
        event: POST_RENDER_HTML,
        hook: 'retext'
      });

      // Link checking
      lichenConfig.hooks.push({
        event: POST_RENDER_HTML,
        hook: 'linkchecker'
      });

      var lichen = new Lichen(lichenConfig);

      var actual = function () {
        return lichen
          .buildContent({
            themes: [themeName]
          })
          .then(function () {
            return globby([config.lichen.pages.dist[DEV].path + '**/*'], {
              onlyFiles: true
            });
          });
      };

      var expected = [config.lichen.pages.dist[DEV].path + 'index.html'];

      return assert.eventually.deepEqual(actual(), expected);
    });
  });
});
