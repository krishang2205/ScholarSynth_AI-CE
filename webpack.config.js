const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';
  
  return {
    mode: isProduction ? 'production' : 'development',
    entry: {
      background: './src/background/background.ts',
      content: './src/content/content.ts',
      popup: './src/popup/popup.tsx'
    },
    devtool: false, // Completely disable source maps for CSP compatibility
    output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    clean: true,
    // Prevent global variable detection which can cause eval usage
    globalObject: 'this'
  },
  module: {
    rules: [
      {
        test: /\.(ts|tsx)$/,
        use: 'ts-loader',
        exclude: /node_modules/
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      },
      {
        test: /\.(png|jpg|jpeg|gif|svg)$/,
        type: 'asset/resource'
      }
    ]
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
    alias: {
      '@': path.resolve(__dirname, 'src')
    },
    fallback: {
      // Prevent dynamic requires that might use eval
      "fs": false,
      "path": false,
      "crypto": false
    }
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/popup/popup.html',
      filename: 'popup/index.html',
      chunks: ['popup']
    }),
    new CopyWebpackPlugin({
      patterns: [
        { from: 'manifest.json', to: 'manifest.json' },
        { from: 'src/icons', to: 'icons' },
        { from: 'src/content/content.css', to: 'content.css' },
        { from: 'src/popup/popup.css', to: 'popup/popup.css' }
      ]
    })
  ],
  // IMPORTANT: Disable code splitting so the background service worker remains a single file.
  // Multiple chunk files can fail to load in MV3 service workers and cause
  // "Could not establish connection. Receiving end does not exist." when
  // the onMessage listener never registers due to a chunk load error.
  optimization: {
    splitChunks: false,
    runtimeChunk: false,
    minimize: true,
    minimizer: [
      '...'
    ]
  },
  // Disable Node.js polyfills that might use eval
  node: false
};
}; 