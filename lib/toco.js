var _ = require('lodash');
var cheerio = require('cheerio');
var Decimal = require('decimal.js');
var fs = require('fs');
var mkdirp = require('mkdirp');
var multiGlob = require('./util').multiGlob;
var nunjucks = require('nunjucks');
var path = require('path');
var Penrose = require('penrose').Penrose;
var Promise = require('bluebird');
var Remarkable = require('remarkable');
var toc = require('markdown-toc');
var yaml = require('js-yaml');

Promise.promisifyAll(fs);

fs.existsAsync = Promise.promisify(function exists2(path, exists2callback) {
  fs.exists(path, function callbackWrapper(exists) {
    exists2callback(null, exists);
  });
});

var mkdirpAsync = Promise.promisify(mkdirp);

var nunjucksEnv = nunjucks.configure();

/**
 *
 * @param  {String} file File basename, file basename with extension, or path
 * @param  {String} dir
 * @param  {Array} extnames
 * @return {String}
 */
function resolveFileLocation(file, dir, extnames) {
  var i, il;

  if (file.substring(0, 1) === '/' || file.substring(0, 2) === './' || file.substring(0, 3) === '../') {
    if (fs.existsSync(file)) {
      return file;
    }

    for (i = 0, il = extnames.length; i < il; i++) {
      if (fs.existsSync(file + extnames[i])) {
        return file + extnames[i];
      }
    }

    return;
  }

  if (fs.existsSync(dir + file)) {
    return dir + file;
  }

  for (i = 0, il = extnames.length; i < il; i++) {
    if (fs.existsSync(dir + file + extnames[i])) {
      return dir + file + extnames[i];
    }
  }
}

/**
 *
 * @param  {Object} config Keys: src, dist, plugins, imageStyles, penrose, env
 * @return {Toco}
 */
function Toco(config) {
  this.config = config;

  this.flags = {
    initMdParser: false // Whether markdown parser has been initialised
  };

  nunjucksEnv.addFilter('isNumber', function (value) {
    return _.isNumber(value);
  });

  nunjucksEnv.addFilter('kebabCase', function (value) {
    return _.kebabCase(value);
  });

  nunjucksEnv.addFilter('remove', function (html, selector) {
    var $ = cheerio.load(html);
    $(selector).remove();
    return $.html();
  });

  nunjucksEnv.addFilter('toDecimalPlaces', function (value, dp, rm) {
    var decimal = new Decimal(value);
    return decimal.toDecimalPlaces(dp, rm).valueOf();
  });

  // _.forEach(config.env.extensions, function (ext, name) {
  //   nunjucksEnv.addExtension(name, ext);
  // });

  var DataExtension = function () {
    this.tags = ['data'];

    this.parse = function (parser, nodes, lexer) {
      var tok = parser.nextToken();
      var args = parser.parseSignature(null, true);

      parser.advanceAfterBlockEnd(tok.value);
      parser.parseUntilBlocks('end' + tok.value);
      parser.advanceAfterBlockEnd();

      return new nodes.CallExtension(this, 'run', args);
    };

    this.run = function (context, templateFile, dataFile, dataFilter) {
      var templateFileResolved = resolveFileLocation(templateFile, config.src + '_includes/', ['.njk']);
      var dataFileResolved = resolveFileLocation(dataFile, config.src + '_data/', ['.yml']);

      if (_.isUndefined(templateFileResolved)) {
        throw new Error('Template file not found: ' + templateFile);
      }

      if (_.isUndefined(dataFileResolved)) {
        throw new Error('Data file not found: ' + dataFile);
      }

      var str = fs.readFileSync(dataFileResolved, 'utf8');
      var data = yaml.safeLoad(str);

      if (dataFilter) {
        data = _.filter(data, dataFilter);
      }

      str = nunjucks.render(templateFileResolved, {
        data: data
      });

      return new nunjucks.runtime.SafeString(str);
    };
  };

  nunjucksEnv.addExtension('data', new DataExtension);
}

Toco.prototype = {
  constructor: Toco,
  /**
   * Initialises markdown parser.
   */
  initMdParser: function () {
    if (this.flags.initMdParser) {
      return;
    }

    var md = new Remarkable({
      html: true
    });

    md.config = this.config;

    // Required by responsive image plugin.
    md.penrose = new Penrose(this.config.penrose);

    // Required by nunjucks plugin.
    md.nunjucksEnv = nunjucksEnv;

    // Plugins.
    md.use(function (remarkable) {
      remarkable.renderer.rules.heading_open = function (tokens, idx) {
        return '<h' + tokens[idx].hLevel + ' id=' + toc.slugify(tokens[idx + 1].content) + '>';
      };
    });
    md.use(require('./remarkable/image'));
    md.use(require('./remarkable/note'));
    md.use(require('./remarkable/nunjucks'));
    md.use(require('./remarkable/responsive_image'));
    md.use(require('./remarkable/video'));

    this.md = md;

    this.flags.initMdParser = true;
  },
  /**
   * Returns HTML converted from given Markdown, and a list of post-processing tasks.
   *
   * @param  {String} markdown
   * @return {Object}
   */
  renderHtml: function (markdown) {
    this.initMdParser();

    var html = this.md.render(markdown);
    var tasks = {
      penrose: []
    };
    var $ = cheerio.load(html);

    // Extract penrose tasks.
    $('img[data-penrose-src]').each(function (i, elem) {
      var $elm = $(this);
      var src = $elm.data('penroseSrc');
      var styles = $elm.data('penroseStyles');

      if (src && styles) {
        tasks.penrose.push({
          src: src,
          styleNames: _.map(styles.split(','), function (value) {
            return _.trim(value);
          })
        });
      }

      $elm.removeAttr('data-penrose-src');
      $elm.removeAttr('data-penrose-styles');
    });

    var html = $.html();

    // Block math
    // http://docs.mathjax.org/en/latest/options/tex2jax.html#the-tex2jax-preprocessor
    // @todo Implement in Markdown parser (less error-prone)
    html = html.replace(/<pre>\s*<code>\s*(\$\$|\\\[)(.*)(\$\$|\\\])\s*<\/code>\s*<\/pre>/gim, '<div>$1$2$3</div>');

    // Inline math
    // http://docs.mathjax.org/en/latest/options/tex2jax.html#the-tex2jax-preprocessor
    // @todo Implement in Markdown parser (less error-prone)
    html = html.replace(/<code>\s*(\$|\\\()(.*)(\$|\\\))\s*<\/code>/gim, '$1$2$3');

    return {
      html: html,
      tasks: tasks
    };
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
        var p = getParentNode(item.lvl - 1, nodes);
        p.childNodes.push(node);
      }
    });

    return nodes;
  },
  // /**
  //  * Returns compiled template functions.
  //  *
  //  * @param  {Array} patterns
  //  * @return {Promise}
  //  */
  // loadTemplates: function (patterns) {
  //   return multiGlob(patterns)
  //     .then(function (files) {
  //       var templateFiles = [];
  //
  //       _.forEach(files, function (file) {
  //         var extname = path.extname(file);
  //         var basename = path.basename(file, extname);
  //
  //         templateFiles.push({
  //           id: basename,
  //           path: file
  //         });
  //       });
  //
  //       return Promise.mapSeries(templateFiles, function (templateFile) {
  //         templateFile.data = fs.readFileAsync(templateFile.path, 'utf8');
  //
  //         return Promise.props(templateFile);
  //       });
  //     })
  //     .then(function (templateFiles) {
  //       var templateFunctions = {};
  //
  //       _.forEach(templateFiles, function (templateFile) {
  //         templateFunctions[templateFile.id] = nunjucks.compile(templateFile.data, nunjucksEnv);
  //       });
  //
  //       return Promise.resolve(templateFunctions);
  //     });
  // },
  /**
   *
   * @return {Promise}
   */
  buildHtml: function () {
    var self = this;
    var config = this.config;
    var penrose = new Penrose(this.config.penrose);

    // Find markdown source files.
    return multiGlob([path.resolve(config.src, '**', '*.md')], {
        ignore: path.resolve(config.src, '_**', '*.md') // Exclude partials directories
      })
      .then(function (files) {
        // Load markdown source files.
        var markdownFiles = [];

        _.forEach(files, function (file) {
          markdownFiles.push({
            path: file
          });
        });

        return Promise.mapSeries(markdownFiles, function (markdownFile) {
          markdownFile.data = fs.readFileAsync(markdownFile.path, 'utf8');

          return Promise.props(markdownFile);
        });
      })
      .then(function (files) {
        // Extract metadata and body, and convert markdown to HTML.
        return Promise.mapSeries(files, function (file) {
          var splitText = file.data.toString().split(/\n\n/);
          var meta = yaml.safeLoad(_.trim(splitText[0], '\n-'));
          var markdown = splitText.splice(1, splitText.length - 1).join('\n\n');

          var result = self.renderHtml(markdown);

          var lead = _.get(meta, 'lead');
          var leadHtml = '';
          if (!_.isUndefined(lead)) {
            leadHtml = self.renderHtml(lead).html;
          }

          var tocFile = path.resolve(config.src, '_includes', 'toc.njk');
          var tocHtml = nunjucks.render(tocFile, {
            nodes: self.renderToc(markdown)
          });

          file.meta = meta;
          file.html = result.html;
          file.tasks = result.tasks;
          file.leadHtml = leadHtml;
          file.tocHtml = tocHtml;

          return Promise.props(file);
        });
      })
      .then(function (pages) {
        // Run penrose tasks.
        var tasks = [];

        _.forEach(pages, function (page) {
          _.forEach(page.tasks.penrose, function (task) {
            _.forEach(task.styleNames, function (styleName) {
              var style = config.imageStyles[styleName];

              tasks.push({
                style: style,
                src: task.src,
                dist: penrose.getDerivativePath(styleName, task.src, config.penrose.srcBase)
              });
            });
          });
        });

        return Promise.mapSeries(tasks, function (task) {
            return penrose.createDerivative(task.style, task.src, task.dist);
          })
          .then(function () {
            return Promise.resolve(pages);
          });
      })
      .then(function (pages) {
        var srcResolvedLen = path.resolve(config.src).length;

        // Build list of files to write.
        var files = [];

        // Build sitemap.
        var sitemap = [];

        _.forEach(pages, function (page) {
          var distPath = _.trim(page.path.substring(srcResolvedLen), '/'); // Remove src path from start of path, and trim slashes
          var extname = path.extname(distPath);
          var basename = path.basename(distPath, extname);
          var dirname = path.dirname(distPath);

          page.rawPath = path.resolve(config.dist, dirname, basename + '.html');
          page.path = '/' + path.relative(path.resolve(config.dist, '..'), page.rawPath);

          sitemap.push({
            path: page.path,
            title: _.get(page.meta, 'title')
          });
        });

        _.forEach(pages, function (page) {
          var layoutId = _.get(page.meta, 'layout', 'default');
          var layoutFile = path.resolve(config.src, '_layouts', layoutId + '.njk');

          files.push({
            path: page.rawPath,
            data: nunjucks.render(layoutFile, {
              env: config.env || {},
              // http://toolchain.gitbook.com/plugins/api.html#page-instance
              page: {
                path: page.path,
                title: _.get(page.meta, 'title'),
                lead: page.leadHtml,
                content: page.html,
                toc: page.tocHtml
              },
              sitemap: sitemap
            })
          });
        });

        // Write to files.
        return Promise.mapSeries(files, function (file) {
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
  Toco: Toco
};
