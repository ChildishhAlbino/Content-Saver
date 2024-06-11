'use strict';

const { merge } = require('webpack-merge');

const common = require('./webpack.common.js');
const PATHS = require('./paths');

// Merge webpack configuration files
const config = merge(common, {
  entry: {
    contentScript: PATHS.src + '/content/content.js',
    background: PATHS.src + '/background.js',
    popup: PATHS.src + '/popup.jsx',
    offscreen: PATHS.src + '/offscreen.js'
  },
});

module.exports = config;
