const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
    entry: './src/index.js',
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'bundle.js'
    },
    plugins: [
        new HtmlWebpackPlugin({
            template: './src/index.html',
            title: 'Timeline Widget',
        }),
    ],
    devServer: {
        port: 3001 // Specify a port number to listen for requests
    },

    module: {

        rules:[
            {
                test: /\.js[x]?$/,
                exclude: /node_modules/,
                use: {
                    loader: 'babel-loader'
                }
            }]},

                    resolve: {
        modules: ["node_modules"]
    },
    target: "web",
};