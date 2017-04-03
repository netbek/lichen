var _ = require('lodash');
var cheerio = require('cheerio');
var fs = require('fs-extra');
var multiGlob = require('./util').multiGlob;
var nunjucks = require('nunjucks');
var path = require('path');
var Penrose = require('penrose').Penrose;
var Promise = require('bluebird');
var Remarkable = require('remarkable');
var runWebpack = require('./util').runWebpack;
var sanitizeFilename = require('sanitize-filename');
var toc = require('markdown-toc');
var vm = require('vm');
var webpack = require('webpack');
var yaml = require('js-yaml');
var yamlFrontMatter = require('yaml-front-matter');

// Builds.
var DEV = 'dev';
var PROD = 'prod';

// Event hooks.
var PRE_RENDER_HTML = 'preRenderHtml';
var POST_RENDER_HTML = 'postRenderHtml';
var POST_RENDER_TEMPLATE = 'postRenderTemplate';

Promise.promisifyAll(fs);

fs.existsAsync = Promise.promisify(function exists2(path, exists2callback) {
  fs.exists(path, function callbackWrapper(exists) {
    exists2callback(null, exists);
  });
});

var contentDirname = 'content';
var contentExtnames = [
  'md'
];

var dataDirname = 'data';
var dataExtnames = [
  'js',
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
  'js': 'js',
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
 * @return {Lichen}
 */
function Lichen(config) {
  this.config = _.assign({}, {
    data: {},
    env: {
      dev: false // {Boolean} Set to `true` for production build
    },
    hooks: [],
    nunjucks: {
      filters: {}
    },
    patterns: {
      contentDistPath: '{{ file.dirname }}/{{ file.basename }}.{{ renderExtname }}'
    },
    penrose: undefined,
    remarkable: {
      plugins: {}
    },
    // @todo Use more appropriate/descriptive name than `themes`
    themes: [],
    // @see https://github.com/jonschlinkert/markdown-toc#options
    toc: {
      firsth1: true, // {Boolean} Exclude the first h1-level heading
      maxdepth: 6 // {Number} Use headings whose depth is at most maxdepth
    },
    webpack: undefined
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

  nunjucksEnv.addFilter('kebabCase', function (data) {
    return _.kebabCase(data);
  });

  nunjucksEnv.addFilter('markdown', function (data) {
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

  nunjucksEnv.addFilter('sanitizeFilename', function (data) {
    return sanitizeFilename(data);
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

  nunjucksEnv.addExtension('render', new RenderExtension());

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

  var penrose = new Penrose(this.config.penrose);

  var md = new Remarkable({
    html: true
  });

  md.config = this.config;
  md.findPartialTemplate = findPartialTemplate;
  md.penrose = penrose;
  md.nunjucksEnv = nunjucksEnv;

  md.use(function (remarkable) {
    remarkable.renderer.rules.heading_open = function (tokens, idx) {
      return '<h' + tokens[idx].hLevel + ' id=' + toc.slugify(tokens[idx + 1].content) + '>';
    };
  });
  md.use(require('./remarkable/backticks')); // Required by `math` plugin
  md.use(require('./remarkable/example'));
  md.use(require('./remarkable/fences')); // Required by `math` plugin
  md.use(require('./remarkable/image'));
  md.use(require('./remarkable/math'));
  md.use(require('./remarkable/note'));
  md.use(require('./remarkable/responsive_image'));
  md.use(require('./remarkable/template'));
  md.use(require('./remarkable/video'));

  this.md = md;
  this.nunjucksEnv = nunjucksEnv;
  this.penrose = penrose;
}

Lichen.prototype = {
  constructor: Lichen,
  /**
   *
   * @param   {String} path
   * @param   {Mixed} value
   */
  setConfig: function (path, value) {
    _.set(this.config, path, value);
  },
  /**
   *
   * @param  {String} event
   * @param  {String} build Constant: DEV, PROD
   * @return {Array}
   */
  loadHooks: function (event, build) {
    var config = this.config;

    config.findPartialTemplate = function (templateName) {
      return this.findPartialTemplate(templateName);
    }.bind(this);

    var hooks = _.filter(this.config.hooks, function (hook) {
      return event === hook.event && build === _.get(hook, 'build', build);
    });

    return _.map(hooks, function (hook) {
      var hookFn;

      if (_.isFunction(hook.hook)) {
        hookFn = hook.hook;
      }
      else if (_.isString(hook.hook)) {
        hookFn = require('./hooks/' + hook.hook);
      }
      else {
        throw new Error('Value of `hook` property should be of type Function or String');
      }

      return hookFn(config);
    });
  },
  /**
   *
   * @param  {String} data
   * @param  {String} filePath
   * @param  {Array} hooks
   * @return {Promise}
   */
  runHooks: function (data, filePath, hooks) {
    return Promise.mapSeries(hooks, function (hook) {
        return hook.run(data, filePath)
          .then(function (result) {
            data = result;
          });
      })
      .then(function () {
        return Promise.resolve(data);
      });
  },
  /**
   * Returns HTML converted from given Markdown, and a list of post-processing tasks.
   *
   * @param  {String} markdown
   * @param  {String} filePath
   * @return {Promise}
   */
  renderHtml: function (markdown, filePath) {
    var config = this.config;
    var preRenderHtmlHooks = this.loadHooks(PRE_RENDER_HTML, config.env.dev ? DEV : PROD);
    var postRenderHtmlHooks = this.loadHooks(POST_RENDER_HTML, config.env.dev ? DEV : PROD);
    var tasks = {
      penrose: [],
      webpack: []
    };

    // Run pre-Markdown to HTML hooks.
    return this.runHooks(_.clone(markdown), filePath, preRenderHtmlHooks)
      .then(function (result) {
        // Convert Markdown to HTML.
        result = this.md.render(result);

        var $ = cheerio.load(result);

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

        // Extract Webpack tasks.
        $('script[type="text/babel"]').each(function () {
          var $elm = $(this);
          var id = $elm.data('webpackId');
          var lang = $elm.data('webpackLang');
          var src = $elm.data('webpackSrc');
          var data = _.trim($elm.html());

          tasks.webpack.push({
            id: id,
            lang: lang,
            src: src,
            data: data
          });

          $elm.empty();
          $elm.removeAttr('data-webpack-id');
          $elm.removeAttr('data-webpack-lang');
          $elm.removeAttr('data-webpack-src');
          $elm.removeAttr('type');
          $elm.attr('src', src);
        });

        result = $.html();

        // Run post-Markdown to HTML hooks.
        return this.runHooks(result, filePath, postRenderHtmlHooks);
      }.bind(this))
      .then(function (result) {
        return Promise.resolve({
          html: result,
          tasks: tasks
        });
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
      else if (item.lvl <= options.maxdepth) {
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
    var src = _.get(this.config.pages.src, 'templates.path', this.config.pages.src.path);
    var templateDirs = [];

    // If theme and content type given.
    if (!_.isUndefined(themeName) && !_.isUndefined(contentType)) {
      templateDirs = templateDirs.concat([
        path.resolve(src, themesDirname, themeName, templatesDirname, contentType) + '/',
        path.resolve(src, themesDirname, themeName, templatesDirname) + '/',
        path.resolve(src, templatesDirname, contentType) + '/',
        path.resolve(__dirname, '..', templatesDirname, contentType) + '/'
      ]);
    }
    // If theme given.
    else if (!_.isUndefined(themeName)) {
      templateDirs = templateDirs.concat([
        path.resolve(src, themesDirname, themeName, templatesDirname) + '/'
      ]);
    }
    // If content type given.
    else if (!_.isUndefined(contentType)) {
      templateDirs = templateDirs.concat([
        path.resolve(src, templatesDirname, contentType) + '/',
        path.resolve(__dirname, '..', templatesDirname, contentType) + '/'
      ]);
    }

    templateDirs = templateDirs.concat([
      path.resolve(src, templatesDirname) + '/',
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
    var src = _.get(this.config.pages.src, 'templates.path', this.config.pages.src.path);
    var templateDirs = [
      path.resolve(src, templatesDirname, partialsDirname) + '/',
      path.resolve(__dirname, '..', templatesDirname, partialsDirname) + '/'
    ];

    var extnames = _.map(templateExtnames, function (extname) {
      return '.' + extname;
    });

    return findFile(templateName, templateDirs, extnames);
  },
  /**
   *
   * @param   {Object} file
   * @returns {Object}
   */
  getContentSrcPaths: function (file) {
    var config = this.config;

    var basePath = _.get(config.pages.src, 'content.base');
    if (_.isUndefined(basePath)) {
      basePath = path.resolve(config.pages.src.path, contentDirname);
    }
    else {
      basePath = path.resolve(basePath);
    }

    var relPath = _.trim(file.path.substring(basePath.length), '/');
    var extname = path.extname(relPath);
    var basename = stripModifiers(path.basename(relPath, extname));
    var dirname = path.dirname(relPath);

    return {
      relPath: relPath,
      extname: extname,
      basename: basename,
      dirname: dirname
    };
  },
  /**
   *
   * @param   {Object} file
   * @returns {Object}
   */
  getContentDistPaths: function (file) {
    var config = this.config;
    var build = config.env.dev ? DEV : PROD;
    var buildDistPath = config.pages.dist[build].path;
    var buildDistURL = config.pages.dist[build].url;

    var distPath = nunjucks.renderString(config.patterns.contentDistPath, {
      file: file,
      renderExtname: renderExtname
    });
    distPath = path.resolve(buildDistPath, distPath);

    var distURL = buildDistURL + path.relative(path.resolve(buildDistPath), distPath);

    return {
      distPath: distPath,
      distURL: distURL
    };
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
    var src;

    if (_.isUndefined(config.pages.src.data)) {
      src = _.map(dataExtnames, function (extname) {
        return path.resolve(config.pages.src.path, dataDirname, '**', '*.' + extname);
      });
    }
    else {
      src = _.map(dataExtnames, function (extname) {
        return path.resolve(config.pages.src.data.path, '**', '*.' + extname);
      });
    }

    return this.loadFiles(src)
      .then(function (files) {
        var data = {};

        _.forEach(files, function (file) {
          var extname = path.extname(file.path);
          var basename = path.basename(file.path, extname);
          extname = _.trim(extname, '.').toLowerCase();
          var format = extnameFormatMap[extname];

          if (format === 'js') {
            var script = new vm.Script(file.data);
            var sandbox = {
              module: {
                exports: {}
              },
              require: require
            };
            var context = new vm.createContext(sandbox);
            script.runInNewContext(context);
            data[basename] = sandbox.module.exports;
          }
          else if (format === 'json') {
            data[basename] = JSON.parse(file.data);
          }
          else if (format === 'yaml') {
            data[basename] = yaml.safeLoad(file.data);
          }
          else {
            throw new Error('Cannot load data of files with extension `' + extname + '`');
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
    var src;

    if (_.isUndefined(config.pages.src.content)) {
      src = _.map(contentExtnames, function (extname) {
        return path.resolve(config.pages.src.path, contentDirname, '**', '*.' + extname);
      });
    }
    else {
      src = _.map(config.pages.src.content.glob, function (pattern) {
        return path.resolve(pattern);
      });
    }

    // Load markdown source files.
    return this.loadFiles(src)
      .then(function (files) {
        // Extract front matter and content.
        return Promise.mapSeries(files, function (file) {
          _.forEach(this.getContentSrcPaths(file), function (value, key) {
            file[key] = value;
          });

          var frontMatter = yamlFrontMatter.loadFront(file.data);
          var meta = _.pick(frontMatter, _.difference(_.keys(frontMatter), ['__content']));
          var content = frontMatter.__content;

          // If themes is not given in front matter, then infer from filename and config.
          if (_.isUndefined(meta.themes)) {
            var extname = path.extname(file.relPath);
            var basename = path.basename(file.relPath, extname);
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
            var dirname = path.dirname(file.relPath);
            var firstSegment = dirname.split('/')[0];

            if (firstSegment.length && firstSegment !== '.' && firstSegment !== '..') {
              meta.type = firstSegment;
            }
          }

          if (_.isUndefined(meta.template)) {
            meta.template = 'single';
          }

          file.meta = meta;
          file.content = content;

          _.forEach(this.getContentDistPaths(file), function (value, key) {
            file[key] = value;
          });

          return Promise.props(file);
        }.bind(this));
      }.bind(this))
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
    // Load site content.
    return this.loadContent(filter)
      .then(function (files) {
        var links = _.map(files, function (file) {
          return {
            path: file.distURL,
            title: _.get(file.meta, 'title')
          };
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
    var penrose = this.penrose;
    var postRenderTemplateHooks = this.loadHooks(POST_RENDER_TEMPLATE, config.env.dev ? DEV : PROD);
    var self = this;

    this.nunjucksEnv.addGlobal('env', config.env || {});

    // Load site data.
    return this.loadData()
      .then(function (data) {
        var site = {
          data: _.assign({}, config.data, data)
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
              content: self.renderHtml(file.content, file.relPath),
              lead: _.isUndefined(lead) ? {
                html: ''
              } : self.renderHtml(lead, file.relPath),
              toc: nunjucks.render(tocTemplateFile, {
                nodes: self.renderToc(file.content, config.toc)
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
        // Run Penrose tasks.
        return Promise.mapSeries(files, function (file) {
            return Promise.mapSeries(file.tasks.penrose, function (task) {
              var distResolved = penrose.resolvePath(task.dist);

              return fs.existsAsync(distResolved)
                .then(function (exists) {
                  if (exists) {
                    return Promise.resolve(true);
                  }

                  var style = config.imageStyles[task.style];

                  return penrose.createDerivative(style, task.src, task.dist);
                });
            });
          })
          .then(function () {
            return Promise.resolve(files);
          });
      })
      .then(function (files) {
        // Run Webpack tasks.
        return Promise.mapSeries(files, function (file) {
            return Promise.mapSeries(file.tasks.webpack, function (task) {
              var extname = path.extname(task.src);
              var basename = path.basename(task.src, extname);
              var dirname = path.dirname(task.src);
              var jsxPath = path.resolve(dirname, basename + '.jsx');

              // Builds list of JSXElement modules to require.
              var modules = [];
              var matches = task.data.match(/<\s*(\w+)/g);

              _.forEach(matches, function (match) {
                var moduleName = _.trim(match, '<');
                var modulePath = _.get(config.webpack.modules, moduleName);

                if (_.isUndefined(modulePath) || _.find(modules, {
                    name: moduleName
                  })) {
                  return;
                }

                modules.push({
                  name: moduleName,
                  path: path.resolve(modulePath)
                });
              });

              var templateFile = self.findPartialTemplate('example.jsx');
              var data = nunjucks.render(templateFile, {
                modules: modules,
                element: task.data,
                containerId: task.id
              });

              return fs.outputFileAsync(jsxPath, data, 'utf8')
                .then(function () {
                  // Resolves with entry point for example.
                  return Promise.resolve({
                    name: basename,
                    path: jsxPath
                  });
                });
            });
          })
          .then(function (arr) {
            var webpackEntries = [];

            _.forEach(arr, function (values) {
              webpackEntries = webpackEntries.concat(values);
            });

            if (webpackEntries.length) {
              config.webpack.entry = {};

              _.forEach(webpackEntries, function (entry) {
                config.webpack.entry[entry.name] = entry.path;
              });

              config.webpack.output = {
                filename: path.join(config.files.dist[build].path, 'js', '[name].js')
              };

              config.webpack.plugins = [
                new webpack.optimize.CommonsChunkPlugin(path.join(config.files.dist[build].path, 'js', 'shared.js'))
              ];

              return runWebpack(config.webpack)
                .then(function () {
                  // Remove temporary JSX files.
                  return Promise.mapSeries(webpackEntries, function (entry) {
                    return fs.removeAsync(entry.path);
                  });
                })
                .then(function () {
                  return Promise.resolve(files);
                });
            }

            return Promise.resolve(files);
          });
      })
      .then(function (files) {
        // Render templates.
        return Promise.mapSeries(files, function (file) {
          var templateFile = self.findContentTemplate(file.meta.template, file.meta.type, file.meta.theme);

          if (_.isUndefined(templateFile)) {
            throw new Error('Content template not found: ' + file.meta.template + ', ' + file.meta.type + ', ' + file.meta.theme);
          }

          var context = {
            // http://toolchain.gitbook.com/plugins/api.html#page-instance
            page: _.assign({
              content: file.html,
              lead: file.leadHtml,
              path: file.distURL,
              toc: file.tocHtml
            }, _.pick(file.meta, _.difference(_.keys(file.meta), [
              'content',
              'lead',
              'path',
              'toc'
            ])))
          };

          var data = nunjucks.render(templateFile, context);

          return Promise.resolve({
            path: file.distPath,
            relPath: file.relPath,
            data: data
          });
        });
      })
      .then(function (files) {
        // Run post-render template hooks.
        return Promise.mapSeries(files, function (file) {
          return Promise.props({
            path: file.path,
            data: self.runHooks(file.data, file.relPath, postRenderTemplateHooks)
          });
        });
      })
      .then(function (files) {
        // Write to files.
        return Promise.mapSeries(files, function (file) {
          return fs.outputFileAsync(file.path, file.data, 'utf8');
        });
      });
  }
};

module.exports = {
  DEV: DEV,
  PROD: PROD,
  PRE_RENDER_HTML: PRE_RENDER_HTML,
  POST_RENDER_HTML: POST_RENDER_HTML,
  POST_RENDER_TEMPLATE: POST_RENDER_TEMPLATE,
  Lichen: Lichen
};
