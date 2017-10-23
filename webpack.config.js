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
      //@todo: webpack and babel would be great if they didn't break every
      //  other week, comment this out because Chrome can run es6 but not
      //  after babel is finished with it, getting:
      //  Uncaught ReferenceError: regeneratorRuntime is not defined
      //  with no working solution found here:
      //  https://github.com/babel/babel-loader/issues/484
      // {
      //   test: /\.js$/,
      //   exclude: /node_modules/,
      //   use: {
      //     loader: 'babel-loader',
      //     options: {
      //       presets: [
      //         ["env", {
      //           "targets": {
      //             "browsers": ["last 2 versions"]
      //           }
      //         }]
      //       ],
      //       plugins: []
      //     }
      //   },
      // }
    ]
  }
};
