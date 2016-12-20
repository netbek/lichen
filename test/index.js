var _ = require('lodash');
var chai = require('chai');
var assert = chai.assert;
var chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
var del = require('del');
var multiGlob = require('../lib/util').multiGlob;
var path = require('path');
var Promise = require('bluebird');
var Toco = require('..').Toco;

describe('Penrose', function () {
  var testDir = __dirname.substring(process.cwd().length + 1) + '/';

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
      'srcBase': testDir + 'data/files/',
      'dist': testDir + 'data/files/styles/'
    },
    'toco': {
      'src': testDir + 'data/src/',
      'dist': testDir + 'data/dist/',
      'plugins': {
        'responsiveImage': {
          // prependSrc: 'src/', // Prepend path to source, e.g. `img/file.jpg` in Markdown is passed to Fractal lib as `src/img/file.jpg`
          // sizes: '(min-width: 960px) 240px, 100vw',
          sizes: '100vw',
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
  };

  beforeEach(function (done) {
    // Delete test output.
    del([
        config.penrose.dist,
        config.toco.dist
      ])
      .then(function () {
        done();
      });
  });

  after(function (done) {
    // Delete test output.
    del([
        config.penrose.dist,
        config.toco.dist
      ])
      .then(function () {
        done();
      });
  });

  var toco = new Toco({
    src: config.toco.src,
    dist: config.toco.dist,
    plugins: config.toco.plugins,
    imageStyles: config.imageStyles,
    penrose: config.penrose,
    env: {
      dev: true
    }
  });

  describe('buildHtml', function () {
    it('Should build HTML', function () {
      var actual = function () {
        return toco.buildHtml()
          .then(function () {
            return multiGlob([config.toco.dist + '**/*'], {
              nodir: true
            });
          });
      };

      var expected = [config.toco.dist + 'test.html'];

      return assert.eventually.deepEqual(actual(), expected);
    });
  });
});
