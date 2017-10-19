var gulp = require('gulp');

// Pug
var pug = require('gulp-pug');
var fs = require('fs');
var data = require('gulp-data');
var path = require('path');

// CSS
var sass = require('gulp-sass')
var sassGlob = require('gulp-sass-glob');
var postcss = require('gulp-postcss');
var autoprefixer = require('autoprefixer');
var cleanCSS = require('gulp-clean-css');

// JS
var concat = require('gulp-concat');
var uglify = require('gulp-uglify');

// Image
var imagemin = require('gulp-imagemin');

// Iconfont
var iconfont = require('gulp-iconfont');
var consolidate = require('gulp-consolidate');

// Styleguide
var aigis = require('gulp-aigis');

// Utility
var cache = require('gulp-cached');
var changed  = require('gulp-changed');
var sourcemaps = require('gulp-sourcemaps');
var runSequence = require('run-sequence');
var browserSync = require('browser-sync');
var ssi = require("browsersync-ssi");
var plumber = require('gulp-plumber');
var notify = require("gulp-notify");
var rimraf = require('rimraf');

/**
 * 開発用ディレクトリ
 */
var develop = {
  'root': 'develop/',
  'html': ['develop/**/*.pug', '!develop/**/_*.pug'],
  'data': 'develop/_data/',
  'css': 'develop/**/*.scss',
  'styleguideWatch': ['develop/**/*.scss', 'develop/**/*.md'],
  'jquery': 'develop/assets/js/*.js',
  'libJs': 'develop/assets/js/lib/**/*.js',
  'siteJs': 'develop/assets/js/namespace/**/*.js',
  'jsWatch': 'develop/**/*.js',
  'image': 'develop/assets/img/**/*.{png,jpg,gif,svg}',
  'imageWatch': 'develop/assets/img/**/*',
  'iconfont': 'develop/assets/icon/**/*.svg',
  'iconfontWath': ['develop/assets/icon/**/*.svg', 'develop/assets/icon/template/_Icon.scss'],
  'public': 'public/**/*'
};

/**
 * テスト用ディレクトリ
 */
var test = {
  'root': 'test/',
  'image': 'test/assets/img/',
  'js': 'test/assets/js/',
  'iconfont': 'test/assets/font/'
};

/**
 * 公開用ディレクトリ
 */
var release = {
  'root': 'htdocs/'
};

/**
 * `.pug`を`.html`にコンパイルします。
 * JSONとページごとのルート相対パスの格納、ルート相対パスを使ったincludeの設定をします。
 */
gulp.task('html', function() {
  // JSONファイルの読み込み。
  var locals = {
    'site': JSON.parse(fs.readFileSync(develop.data + 'site.json'))
  };
  locals.ja = {
    // 日本語サイト共通のデータです。
    'site': JSON.parse(fs.readFileSync(develop.data + 'ja/site.json'))
  };
  locals.en = {
    // 英語サイト共通のデータです。
    'site': JSON.parse(fs.readFileSync(develop.data + 'en/site.json'))
  };
  return gulp.src(develop.html)
  // エラーでタスクを止めない
  .pipe(plumber({errorHandler: notify.onError("Error: <%= error.message %>")}))
  .pipe(data(function(file) {
    // 各ページのルート相対パスを格納します。
    locals.pageAbsolutePath = '/' + path.relative(file.base, file.path.replace(/.pug$/, '.html')).replace(/index\.html$/, '');
      return locals;
  }))
  .pipe(cache('html'))
  .pipe(pug({
    // `locals`に渡したデータを各Pugファイルで取得できます。
    locals: locals,
    // ルート相対パスでincludeが使えるようになります。
    // example: /assets/pug/_layout
    basedir: 'develop',
    // Pugファイルの整形。
    pretty: true
  }))
  .pipe(gulp.dest(test.root))
  .pipe(browserSync.reload({stream: true}));
});

/**
 * `.scss`を`.css`にコンパイルします。
 */
gulp.task('css', function(){
  var plugins = [
    autoprefixer({
      // ベンダープレフィックスの付与
      // https://github.com/ai/browserslist#browsers
      // 条件によって対応できるブラウザを確認できる（カンマ区切りで指定を記述する）
      //  http://browserl.ist/
      browsers: [
        // すべてのブラウザの最新1バージョン
        'last 1 version',
        // 日本で3%以上のシェアがあるバージョン
        '> 3% in JP',
        // IE9以上
        'ie >= 9',
        // iOS8以上
        'iOS >= 8',
        // Android4.4以上
        'Android >= 4.4'
      ]
    })
  ];
  return gulp.src(develop.css)
  // globパターンでのインポート機能を追加
  .pipe(sassGlob())
  .pipe(sourcemaps.init())
  .pipe(sass({
    outputStyle: 'expanded'
  }).on('error', sass.logError))
  .pipe(plumber({errorHandler: notify.onError("Error: <%= error.message %>")}))
  .pipe(postcss(plugins))
  .pipe(cleanCSS())
  .pipe(sourcemaps.write('.'))
  .pipe(gulp.dest(test.root))
  .pipe(browserSync.reload({stream: true}));
});

/**
 * jQueryをreleaseディレクトリに出力します。
 */
gulp.task('jquery', function() {
  return gulp.src(develop.jquery, {base: develop.root})
  .pipe(gulp.dest(test.root))
  .pipe(browserSync.reload({stream: true}));
});

/**
 * サイト共通のJSファイルを連結・圧縮します。
 */
gulp.task('libJs', function() {
  return gulp.src(develop.libJs)
  .pipe(sourcemaps.init())
  // ファイルを連結します。
  .pipe(concat('lib.js'))
  // ファイルを圧縮します。
  .pipe(uglify({preserveComments: 'license'}))
  .pipe(sourcemaps.write('.'))
  .pipe(gulp.dest(test.js))
  .pipe(browserSync.reload({stream: true}));
});

/**
 * ModuleごとのJSファイルを連結・圧縮します。
 */
gulp.task('siteJs', function() {
  return gulp.src(develop.siteJs)
  .pipe(sourcemaps.init())
  .pipe(concat('site.js'))
  .pipe(uglify({preserveComments: 'license'}))
  .pipe(sourcemaps.write('.'))
  .pipe(gulp.dest(test.js))
  .pipe(browserSync.reload({stream: true}));
});

/**
 * 画像を圧縮します。
 */
gulp.task('image', function() {
  return gulp.src(develop.image)
  .pipe(changed(test.image))
  // TODO: gulp-imageminのv3.2.0だとエラーが起きてしまうので、v2.4.0で固定しています。
  // https://github.com/imagemin/imagemin/issues/237
  .pipe(plumber({
    errorHandler: function(err) {
      console.log(err.messageFormatted);
      this.emit('end');
    }
  }))
  .pipe(imagemin({
    // jpgをロスレス圧縮（画質を落とさず、メタデータを削除）。
    progressive: true,
    // gifをインターレースgifにします。
    interlaced: true,
    // PNGファイルの圧縮率（7が最高）を指定します。
    optimizationLevel: 7
  }))
  .pipe(gulp.dest(test.image))
  .pipe(browserSync.reload({stream: true}));
});

/**
 * アイコンフォントを作成します。
 * `develop/assets/icon`にSVGファイルを保存すると、
 * `test/assets/font`ディレクトリにフォントファイルが、
 * `develop/assets/css/SiteWide`ディレクトリに専用のscssファイルが生成されます。
 */
gulp.task('iconfont', function() {
  // シンボルフォント名を指定します。
  var fontName = 'iconfont';
  return gulp.src(develop.iconfont)
  .pipe(iconfont({
    fontName: fontName,
    formats: ['ttf', 'eot', 'woff', 'svg'],
  }))
  .on('glyphs', function(codepoints, opt) {
    var options = {
      glyphs: codepoints,
      fontName: fontName,
      // Sassファイルからfontファイルまでの相対パスを指定します。
      fontPath: '../font/',
    };
    // CSSのテンプレートからSassファイルを生成します。
    gulp.src('develop/assets/icon/template/_Icon.scss')
    .pipe(consolidate('lodash', options))
    // Sassファイルの生成するパスを指定します。
    .pipe(gulp.dest('develop/assets/css/base/mixin/'));
  })
  // fontファイルを出力するパスを指定します。
  .pipe(gulp.dest(test.iconfont));
});

/**
 * スタイルガイドを生成します。
 */
gulp.task('styleguide', function() {
  return gulp.src('./aigis/aigis_config.yml')
    .pipe(aigis());
});

/**
 * Gulpの処理を通さないディレクトリです。
 * テスト用のディレクトリにコピーします。
 */
gulp.task('public', function() {
  return gulp.src(develop.public)
  .pipe(gulp.dest(test.root));
});

/**
 * テスト用のディレクトリを削除します。
 */
gulp.task('clean:test', function (cb) {
  return rimraf(test.root, cb);
});

/**
 * 本番公開用のディレクトリを削除します。
 */
gulp.task('clean:release', function (cb) {
  return rimraf(release.root, cb);
});

/**
 * テスト用のディレクトリをコピーします。
 */
gulp.task('copy:test', function() {
  return gulp.src(test.root + '**/*')
  .pipe(gulp.dest(release.root));
});

/**
 * 本番公開用のディレクトリをコピーします。
 */
gulp.task('copy:release', function() {
  return gulp.src(test.root + '**/*')
  .pipe(gulp.dest('docs/'));
});

/**
 * 一連のタスクを処理します。
 */
gulp.task('build', function() {
  runSequence(
    ['iconfont'],
    ['html', 'css', 'styleguide', 'jquery', 'libJs', 'siteJs', 'image', 'public']
  )
});

/**
 * ローカルサーバーを起動します。
 */
gulp.task('browser-sync', function() {
  browserSync({
    server: {
      // SSIを利用する場合はmiddlewareのコメントアウトを解除します。
      // middleware: [
      //   ssi({
      //     baseDir: test.root,
      //     ext: ".html"
      //   })
      // ],
      baseDir: test.root
    },
    // 画面を共有するときにスクロールやクリックなどをミラーリングしたくない場合はfalseにします。
    ghostMode: true,
    // ローカルIPアドレスでサーバーを立ち上げます。
    open: 'external',
    // サーバー起動時に表示するページを指定します。
    // startPath: '/styleguide/',
    // falseに指定すると、サーバー起動時にポップアップを表示させません。
    notify: false
  });
});

/**
 * ファイルを監視します。
 */
gulp.task('watch', ['build'], function() {
  gulp.watch(develop.html, ['html']);
  gulp.watch(develop.css, ['css']);
  gulp.watch(develop.styleguideWatch, ['styleguide']);
  gulp.watch(develop.jsWatch, ['jquery']);
  gulp.watch(develop.jsWatch, ['libJs']);
  gulp.watch(develop.jsWatch, ['siteJs']);
  gulp.watch(develop.imageWatch, ['image']);
  gulp.watch(develop.iconfontWath, ['iconfont']);
  gulp.watch(develop.public, ['public']);
});


/**
 * 開発に使用するタスクです。
 * `gulp`タスクにbrowser-syncを追加します。
 * ローカルサーバーを起動し、リアルタイムに更新を反映させます。
 */
gulp.task('default', ['clean:test'], function() {
  runSequence(
    'watch',
    'browser-sync'
  )
});

/**
 * 本番公開用のファイルを出力します。
 */
gulp.task('release', function() {
  runSequence(
    ['clean:test'],
    ['clean:release'],
    ['iconfont'],
    ['html', 'css', 'styleguide', 'jquery', 'libJs', 'siteJs', 'image', 'public'],
    'copy:test'
  )
});
