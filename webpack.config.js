const path = require('path')
var HtmlWebpackPlugin = require('html-webpack-plugin')
var HTMLWebpackPluginConfig = new HtmlWebpackPlugin({
  template: __dirname + '/app/index.html',
  filename: 'index.html',
  inject: 'body'
});
module.exports = {
  
  entry: [
    'babel-polyfill',
    './app/index.js'
  ],
  module: {
    loaders: [
      {test: /\.js$/, exclude: /node_modules/, loader: "babel-loader"},
      {test: /\.css$/, loader: "style-loader!css-loader" },
      {test: /\.(jpe?g|png|gif|svg)$/i,loaders: [
            'file-loader?hash=sha512&digest=hex&name=[hash].[ext]',
            'image-webpack-loader?bypassOnDebug&optimizationLevel=7&interlaced=false'
        ],
    }
    ]
  },
  devServer: {
    historyApiFallback: true,
  }, 
  output: {
    filename: "index_bundle.js",
    path: __dirname + '/dist',
    publicPath: '/'
  },
  plugins: [HTMLWebpackPluginConfig]
};