const JasmineWebpackPlugin = require('jasmine-webpack-plugin');
const path = require("path");
const webpack = require("webpack");


function resolve(filePath) {
  return path.join(__dirname, filePath)
}

module.exports = {
  entry: ['./test/specRoot.js'],
  // ... more configuration
  plugins: [new JasmineWebpackPlugin()],
  resolve: {
    modules: [
      resolve("../node_modules/")
      ,resolve("./test/")
    ]
  },
}
