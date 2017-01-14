var _ = require('lodash');
var cheerio = require('cheerio');
var fs = require('fs-extra');
var mkdirp = require('mkdirp');
var multiGlob = require('./util').multiGlob;
var nunjucks = require('nunjucks');
var path = require('path');
var Penrose = require('penrose').Penrose;
var Promise = require('bluebird');
var Remarkable = require('remarkable');
var toc = require('markdown-toc');
var yaml = require('js-yaml');
var yamlFrontMatter = require('yaml-front-matter');

var DEV = 'dev';
var PROD = 'prod';

Promise.promisifyAll(fs);

fs.existsAsync = Promise.promisify(function exists2(path, exists2callback) {
  fs.exists(path, function callbackWrapper(exists) {
    exists2callback(null, exists);
  });
});

var mkdirpAsync = Promise.promisify(mkdirp);

var contentDirname = 'content';
var contentExtnames = [
  'md'
];

var dataDirname = 'data';
var dataExtnames = [
  'json',
  'yaml',
  'yml'
];

var themesDirname = 'themes';
var templatesDirname = 'templates';
var partialsDirname = '_partials';
var templateExtnames = [
  'njk'
];

var renderExtname = 'html';

var extnameFormatMap = {
  'json': 'json',
  'yaml': 'yaml',
  'yml': 'yaml'
};

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
 * @param  {Object} config
 * @return {Toco}
 */
function Toco(config) {
  this.config = _.assign({}, {
    env: {
      dev: false // {Boolean} Set to `true` for production build
    },
    nunjucks: {
      filters: {}
    },
    remarkable: {
      plugins: {}
    },
    themes: [] // @todo Use more appropriate/descriptive name than `themes`
  }, config);

  var findPartialTemplate = function (templateName) {
    return this.findPartialTemplate(templateName);
  }.bind(this);

  var templateDirs = [];

  if (_.isUndefined(this.config.templateDirs)) {
    templateDirs = templateDirs.concat([
      path.resolve(this.config.pages.src.path, themesDirname),
      path.resolve(this.config.pages.src.path, templatesDirname)
    ]);
  }
  else {
    templateDirs = templateDirs.concat(this.config.templateDirs);
  }

  templateDirs.push(path.resolve(__dirname, '..', templatesDirname));

  var nunjucksEnv = nunjucks.configure(templateDirs);

  _.forEach(this.config.nunjucks.filters, function (filter, filterName) {
    nunjucksEnv.addFilter(filterName, filter);
  });

  nunjucksEnv.addFilter('markdown', function (data, selector) {
    var md = new Remarkable({
      html: true
    });
    return md.render(data);
  });

  nunjucksEnv.addFilter('remove', function (data, selector) {
    var $ = cheerio.load(data);
    $(selector).remove();
    return $.html();
  });

  // Render partial template with data. Similar to `include` tag.
  var RenderExtension = function () {
    this.tags = ['render'];

    this.parse = function (parser, nodes, lexer) {
      var tok = parser.nextToken();
      var args = parser.parseSignature(null, true);
      parser.advanceAfterBlockEnd(tok.value);

      var body = parser.parseUntilBlocks('end' + tok.value);
      parser.advanceAfterBlockEnd();

      return new nodes.CallExtension(this, 'run', args, [body]);
    };

    this.run = function (context, templateFile, ctx) {
      var body = _.last(arguments);
      var filter = (arguments[3] === body ? undefined : arguments[3]);

      templateFile = findPartialTemplate(templateFile);

      var data;

      if (_.isUndefined(filter)) {
        data = ctx;
      }
      else {
        data = _.filter(ctx, filter);
      }

      if (!_.isPlainObject(data)) {
        data = {
          data: data
        };
      }

      var str = nunjucks.render(templateFile, data);

      return new nunjucks.runtime.SafeString(str);
    };
  };

  nunjucksEnv.addExtension('render', new RenderExtension);

  nunjucksEnv.addGlobal('getJSON', function (src) {
    if (!fs.existsSync(src)) {
      return;
    }

    var str = fs.readFileSync(src, 'utf8');

    return JSON.parse(str);
  });

  nunjucksEnv.addGlobal('getYAML', function (src) {
    if (!fs.existsSync(src)) {
      return;
    }

    var str = fs.readFileSync(src, 'utf8');

    return yaml.safeLoad(str);
  });

  var md = new Remarkable({
    html: true
  });

  md.config = this.config;
  md.findPartialTemplate = findPartialTemplate;
  md.penrose = new Penrose(this.config.penrose);
  md.nunjucksEnv = nunjucksEnv;

  md.use(function (remarkable) {
    remarkable.renderer.rules.heading_open = function (tokens, idx) {
      return '<h' + tokens[idx].hLevel + ' id=' + toc.slugify(tokens[idx + 1].content) + '>';
    };
  });
  md.use(require('./remarkable/backticks')); // Required by `math` plugin
  md.use(require('./remarkable/fences')); // Required by `math` plugin
  md.use(require('./remarkable/image'));
  md.use(require('./remarkable/math'));
  md.use(require('./remarkable/note'));
  md.use(require('./remarkable/responsive_image'));
  md.use(require('./remarkable/template'));
  md.use(require('./remarkable/video'));

  this.md = md;
  this.nunjucksEnv = nunjucksEnv;
}

Toco.prototype = {
  constructor: Toco,
  /**
   * Returns HTML converted from given Markdown, and a list of post-processing tasks.
   *
   * @param  {String} markdown
   * @return {Promise}
   */
  renderHtml: function (markdown) {
    var config = this.config;
    var penrose = new Penrose(config.penrose);
    var html = this.md.render(markdown);
    var tasks = {
      mathjax: [],
      penrose: []
    };
    var $ = cheerio.load(html);

    // Extract MathJax tasks.
    $('[data-math-output]').each(function () {
      var $elm = $(this);
      var $input = $('[data-math-input]', $elm);
      var input = _.unescape($input.html());
      var inputFormat = $elm.data('mathInputFormat');
      var output = $elm.data('mathOutput');
      var outputFormat = $elm.data('mathOutputFormat');

      tasks.mathjax.push({
        input: input,
        inputFormat: inputFormat,
        output: output,
        outputFormat: outputFormat
      });

      $elm.removeAttr('data-math-input-format');
      $elm.removeAttr('data-math-output');
      $elm.removeAttr('data-math-output-format');
      $input.remove();
    });

    // Extract Penrose tasks.
    $('img[data-responsive-image-src]').each(function () {
      var $elm = $(this);
      var src = $elm.data('responsiveImageSrc');
      var styles = $elm.data('responsiveImageStyles').trim().split(' ');

      for (var i = 0, il = styles.length; i < il; i += 2) {
        tasks.penrose.push({
          style: styles[i],
          src: src,
          dist: styles[i + 1]
        });
      }

      $elm.removeAttr('data-responsive-image-src');
      $elm.removeAttr('data-responsive-image-styles');
    });

    html = $.html();

    return Promise.resolve({
      html: html,
      tasks: tasks
    });
  },
  /**
   * Returns table of contents converted from given Markdown.
   *
   * @param  {String} markdown
   * @param  {Object} options
   * @return {Object}
   */
  renderToc: function (markdown, options) {
    var nodes = [];

    function getParentNode(level, jsonTree) {
      var i = 0;
      var node = jsonTree[jsonTree.length - 1];

      if (!node) {
        return;
      }

      while (i < level - 1) {
        var childNodes = node.childNodes;
        node = childNodes[childNodes.length - 1];
        i++;
      }

      if (!node.childNodes) {
        node.childNodes = [];
      }

      return node;
    }

    function Node(title, link) {
      this.title = title;
      this.link = link || '';
    }

    var items = toc(markdown, options).json;

    _.forEach(items, function (item) {
      var node = new Node(item.content, '#' + item.slug);

      if (item.lvl - 1 === 0) {
        nodes.push(node);
      }
      else {
        var parentNode = getParentNode(item.lvl - 1, nodes);

        if (parentNode) {
          parentNode.childNodes.push(node);
        }
      }
    });

    return nodes;
  },
  /**
   *
   * @param  {String} templateName File basename, file basename with extension, or path
   * @param  {String} contentType
   * @param  {String} themeName
   * @return {String}
   */
  findContentTemplate: function (templateName, contentType, themeName) {
    var templateDirs = [];

    // If theme and content type given.
    if (!_.isUndefined(themeName) && !_.isUndefined(contentType)) {
      templateDirs = templateDirs.concat([
        path.resolve(this.config.pages.src.path, themesDirname, themeName, templatesDirname, contentType) + '/',
        path.resolve(this.config.pages.src.path, themesDirname, themeName, templatesDirname) + '/',
        path.resolve(this.config.pages.src.path, templatesDirname, contentType) + '/',
        path.resolve(__dirname, '..', templatesDirname, contentType) + '/'
      ]);
    }
    // If theme given.
    else if (!_.isUndefined(themeName)) {
      templateDirs = templateDirs.concat([
        path.resolve(this.config.pages.src.path, themesDirname, themeName, templatesDirname) + '/'
      ]);
    }
    // If content type given.
    else if (!_.isUndefined(contentType)) {
      templateDirs = templateDirs.concat([
        path.resolve(this.config.pages.src.path, templatesDirname, contentType) + '/',
        path.resolve(__dirname, '..', templatesDirname, contentType) + '/'
      ]);
    }

    templateDirs = templateDirs.concat([
      path.resolve(this.config.pages.src.path, templatesDirname) + '/',
      path.resolve(__dirname, '..', templatesDirname) + '/'
    ]);

    var extnames = _.map(templateExtnames, function (extname) {
      return '.' + extname;
    });

    return findFile(templateName, templateDirs, extnames);
  },
  /**
   *
   * @param  {String} templateName File basename, file basename with extension, or path
   * @return {String}
   */
  findPartialTemplate: function (templateName) {
    var templateDirs = [
      path.resolve(this.config.pages.src.path, templatesDirname, partialsDirname) + '/',
      path.resolve(__dirname, '..', templatesDirname, partialsDirname) + '/'
    ];

    var extnames = _.map(templateExtnames, function (extname) {
      return '.' + extname;
    });

    return findFile(templateName, templateDirs, extnames);
  },
  /**
   *
   * @param  {Array} src
   * @return {Promise}
   */
  loadFiles: function (src) {
    return multiGlob(src)
      .then(function (matched) {
        var files = [];

        _.forEach(matched, function (file) {
          files.push({
            path: file
          });
        });

        return Promise.mapSeries(files, function (file) {
          file.data = fs.readFileAsync(file.path, 'utf8');

          return Promise.props(file);
        });
      });
  },
  /**
   * Loads site data.
   *
   * @return {Promise}
   */
  loadData: function () {
    var config = this.config;
    var src = _.map(dataExtnames, function (extname) {
      return path.resolve(config.pages.src.path, dataDirname, '**', '*.' + extname);
    });

    return this.loadFiles(src)
      .then(function (files) {
        var data = {};

        _.forEach(files, function (file) {
          var extname = path.extname(file.path);
          var basename = path.basename(file.path, extname);
          extname = _.trim(extname, '.').toLowerCase();
          var format = extnameFormatMap[extname];

          if (format === 'json') {
            data[basename] = JSON.parse(file.data);
          }
          else if (format === 'yaml') {
            data[basename] = yaml.safeLoad(file.data);
          }
        });

        return Promise.resolve(data);
      });
  },
  /**
   * Loads site content.
   *
   * @param  {Object} filter
   * @return {Promise}
   */
  loadContent: function (filter) {
    var config = this.config;
    var src = _.map(contentExtnames, function (extname) {
      return path.resolve(config.pages.src.path, contentDirname, '**', '*.' + extname);
    });
    var srcPathAbs = path.resolve(config.pages.src.path, contentDirname);

    // Load markdown source files.
    return this.loadFiles(src)
      .then(function (files) {
        // Extract front matter and content.
        return Promise.mapSeries(files, function (file) {
          var frontMatter = yamlFrontMatter.loadFront(file.data);
          var meta = _.pick(frontMatter, _.difference(_.keys(frontMatter), ['__content']));
          var content = frontMatter.__content;

          var relPath = _.trim(file.path.substring(srcPathAbs.length), '/');

          // If themes is not given in front matter, then infer from filename and config.
          if (_.isUndefined(meta.themes)) {
            var extname = path.extname(relPath);
            var basename = path.basename(relPath, extname);
            var modifiers = getModifiers(basename);

            if (modifiers.length) {
              meta.themes = modifiers;
            }
            else {
              meta.themes = config.themes;
            }
          }

          // If content type is not given in front matter, then infer from path.
          if (_.isUndefined(meta.type)) {
            var dirname = path.dirname(relPath);
            var firstSegment = dirname.split('/')[0];

            if (firstSegment.length && firstSegment !== '.' && firstSegment !== '..') {
              meta.type = firstSegment;
            }
          }

          if (_.isUndefined(meta.template)) {
            // if (_.isUndefined(meta.type)) {
            //   var extname = path.extname(relPath);
            //   var basename = path.basename(relPath, extname);
            //
            //   meta.template = basename;
            // }
            // else {
            //   meta.template = 'single';
            // }
            meta.template = 'single';
          }

          file.relPath = relPath;
          file.meta = meta;
          file.content = content;

          return Promise.props(file);
        });
      })
      .then(function (files) {
        if (!_.isUndefined(filter)) {
          // Filter by themes
          if (_.isArray(filter.themes) && filter.themes.length) {
            files = _.filter(files, function (file) {
              return _.isArray(file.meta.themes) && file.meta.themes.length && _.intersection(filter.themes, file.meta.themes).length;
            });
          }
        }

        return Promise.resolve(files);
      });
  },
  /**
   *
   * @param  {Object} filter
   * @return {Promise}
   */
  buildSitemap: function (filter) {
    var config = this.config;
    var build = config.env.dev ? DEV : PROD;
    var distPath = config.pages.dist[build].path;
    var distURL = config.pages.dist[build].url;

    // Load site content.
    return this.loadContent(filter)
      .then(function (files) {
        var links = [];

        _.forEach(files, function (file) {
          var extname = path.extname(file.relPath);
          var basename = stripModifiers(path.basename(file.relPath, extname));
          var dirname = path.dirname(file.relPath);
          var absPath = path.resolve(distPath, dirname, basename + '.' + renderExtname);
          var url = distURL + path.relative(path.resolve(distPath), absPath);

          links.push({
            path: url,
            title: _.get(file.meta, 'title')
          });
        });

        return Promise.resolve(links);
      });
  },
  /**
   *
   * @param  {Object} filter
   * @return {Promise}
   */
  buildContent: function (filter) {
    var config = this.config;
    var build = config.env.dev ? DEV : PROD;
    var distPath = config.pages.dist[build].path;
    var distURL = config.pages.dist[build].url;
    var penrose = new Penrose(config.penrose);
    var self = this;

    this.nunjucksEnv.addGlobal('env', config.env || {});

    // Load site data.
    return this.loadData()
      .then(function (data) {
        var site = {
          data: data
        };

        self.nunjucksEnv.addGlobal('site', site);

        // Load site content.
        return self.loadContent(filter);
      })
      .then(function (files) {
        // Convert markdown to HTML
        return Promise.mapSeries(files, function (file) {
          var lead = _.get(file.meta, 'lead');

          var tocTemplateName = 'toc';
          var tocTemplateFile = self.findPartialTemplate(tocTemplateName);

          if (_.isUndefined(tocTemplateFile)) {
            throw new Error('Partial template not found: ' + tocTemplateName);
          }

          return Promise.props({
              content: self.renderHtml(file.content),
              lead: _.isUndefined(lead) ? {
                html: ''
              } : self.renderHtml(lead),
              toc: nunjucks.render(tocTemplateFile, {
                nodes: self.renderToc(file.content)
              })
            })
            .then(function (result) {
              file.html = result.content.html;
              file.tasks = result.content.tasks;
              file.leadHtml = result.lead.html;
              file.tocHtml = result.toc;

              return Promise.resolve(file);
            });
        });
      })
      .then(function (files) {
        // Run MathJax tasks.
        return Promise.mapSeries(files, function (file) {
            return Promise.mapSeries(file.tasks.mathjax, function (task) {
              var outputResolved = penrose.resolvePath(task.output);

              return fs.existsAsync(outputResolved)
                .then(function (exists) {
                  if (exists) {
                    return Promise.resolve(true);
                  }

                  return penrose.createMathFile(task);
                });
            });
          })
          .then(function () {
            return Promise.resolve(files);
          });
      })
      .then(function (files) {
        // Run Penrose tasks.
        return Promise.mapSeries(files, function (file) {
            return Promise.mapSeries(file.tasks.penrose, function (task) {
              var distResolved = penrose.resolvePath(task.dist);

              return fs.existsAsync(distResolved)
                .then(function (exists) {
                  if (exists) {
                    return Promise.resolve(true);
                  }

                  return penrose.createDerivative(task.style, task.src, task.dist);
                });
            });
          })
          .then(function () {
            return Promise.resolve(files);
          });
      })
      .then(function (files) {
        // Build list of files to write.
        var writeFiles = [];

        _.forEach(files, function (file) {
          var extname = path.extname(file.relPath);
          var basename = stripModifiers(path.basename(file.relPath, extname));
          var dirname = path.dirname(file.relPath);
          var absPath = path.resolve(distPath, dirname, basename + '.' + renderExtname);
          var url = distURL + path.relative(path.resolve(distPath), absPath);
          var templateFile = self.findContentTemplate(file.meta.template, file.meta.type, file.meta.theme);

          if (_.isUndefined(templateFile)) {
            throw new Error('Content template not found: ' + file.meta.template + ', ' + file.meta.type + ', ' + file.meta.theme);
          }

          writeFiles.push({
            path: absPath,
            data: nunjucks.render(templateFile, {
              // http://toolchain.gitbook.com/plugins/api.html#page-instance
              page: _.assign({
                content: file.html,
                lead: file.leadHtml,
                path: url,
                toc: file.tocHtml
              }, _.pick(file.meta, _.difference(_.keys(file.meta), [
                'content',
                'lead',
                'path',
                'toc'
              ])))
            })
          });
        });

        // Write to files.
        return Promise.mapSeries(writeFiles, function (file) {
          var dirname = path.dirname(file.path);

          return mkdirpAsync(dirname)
            .then(function () {
              return fs.writeFileAsync(file.path, file.data, 'utf8');
            });
        });
      });
  }
};

module.exports = {
  DEV: DEV,
  PROD: PROD,
  Toco: Toco
};
