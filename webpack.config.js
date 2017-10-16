var path = require("path");
var webpack = require("webpack");

function resolve(filePath) {
  return path.join(__dirname, filePath)
}

var isProduction = process.argv.indexOf("-p") >= 0;
console.log("Bundling for " + (isProduction ? "production" : "development") + "...");

module.exports = {
  devtool: "source-map",
  entry: ["./src/index.js"],
  output: {
    filename: "bundle.js",
    path: resolve("./static"),
  },
  resolve: {
    modules: [
      resolve("./node_modules/")
    ]
  },
  devServer: {
    contentBase: resolve('./static'),
    port: 8080
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['env'],
            plugins: []
          }
        },
      }
    ]
  }
};
