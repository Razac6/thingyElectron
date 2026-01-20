import path from 'path';
import webpack from 'webpack';
import { merge } from 'webpack-merge';
import TerserPlugin from 'terser-webpack-plugin';
import CopyPlugin from 'copy-webpack-plugin';
import baseConfig from './webpack.config.base';
import webpackPaths from './webpack.paths';

const rootPath = webpackPaths.rootPath;
const extensionPath = path.join(rootPath, 'chrome-extension');
const extensionSrcPath = path.join(extensionPath, 'src');
const extensionDistPath = path.join(extensionPath, 'dist');

const configuration: webpack.Configuration = {
  devtool: 'source-map',

  mode: 'production',

  // Target 'web' because this runs in the browser, not Node/Electron
  target: 'web',

  entry: {
    content: path.join(extensionSrcPath, 'content.ts'),
    background: path.join(extensionSrcPath, 'background.ts'),
  },

  output: {
    path: extensionDistPath,
    filename: '[name].js',
    clean: true, // Clean the dist folder before build
    // Override base config's commonjs2 library type which causes "module is not defined" in browser
    library: {
      type: 'self', 
    },
    publicPath: '',
    globalObject: 'self',
  },

  optimization: {
    minimizer: [
      new TerserPlugin({
        parallel: true,
        extractComments: false,
      }),
    ],
  },

  plugins: [
    new webpack.EnvironmentPlugin({
      NODE_ENV: 'production',
    }),
    new CopyPlugin({
      patterns: [
        { from: path.join(extensionPath, 'manifest.json'), to: extensionDistPath },
        { from: path.join(extensionPath, 'blocked.html'), to: extensionDistPath },
        { from: path.join(extensionPath, 'assets'), to: path.join(extensionDistPath, 'assets') },
      ],
    }),
  ],
};

export default merge(baseConfig, configuration);
