/*
 * @Author: Do not edit
 * @Date: 2025-06-14 12:04:47
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-06-14 19:30:48
 * @FilePath: \Code\picMap_backend\webpack.config.js
 * @Description: 
 */
const path = require('path');
const nodeExternals = require('webpack-node-externals');

module.exports = {
  entry: './bin/www',
  target: 'node',
  // output: {
  //   path: path.resolve(__dirname, 'dist'),
  //   filename: 'app.bundle.mjs',      // 必须 .mjs
  //   module: true,                    // 启用 ESModule 输出
  //   library: {
  //     type: 'module'                 // 输出为 ESModule
  //   }
  // },
  // experiments: {
  //   outputModule: true               // 必须启用
  // },
  // externals: [nodeExternals()],
  externals: [require('webpack-node-externals')()],
  output: {
    filename: 'app.bundle.js', // .js 或 .cjs
    libraryTarget: 'commonjs2'
  },
  mode: 'production'
};