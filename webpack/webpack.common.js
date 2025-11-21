/* eslint-env node */
const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = {
    entry: {
        'shared': [
            path.resolve(__dirname, '../dev/shared/js/main.js'),
            path.resolve(__dirname, '../dev/shared/css/main.scss'),
        ],
        'rarea': {
            import: [
                path.resolve(__dirname, '../dev/rarea/js/main.js'),
                path.resolve(__dirname, '../dev/rarea/css/main.scss'),
            ],
            dependOn: 'shared',
        },
        'parea': {
            import: [
                path.resolve(__dirname, '../dev/parea/js/main.js'),
                path.resolve(__dirname, '../dev/parea/css/main.scss'),
            ],
            dependOn: 'shared',
        },
        'solar': {
            import: [
                path.resolve(__dirname, '../dev/modules/solar/js/main.js'),
                path.resolve(__dirname, '../dev/modules/solar/css/main.scss'),
            ],
        },
    },
    output: {
        filename: '[name]/build.js',
        path: path.resolve(__dirname, '../dev/pub'),
        libraryTarget: 'umd',
    },
    resolve: {
        alias: {
            rarea: path.resolve(__dirname, '../dev/rarea'),
            parea: path.resolve(__dirname, '../dev/parea'),
            shared: path.resolve(__dirname, '../dev/shared'),
            solar: path.resolve(__dirname, '../dev/modules/solar'),
        },
        extensions: ['.js', '.ts'],
        extensionAlias: {
            '.js': ['.ts', '.js'],
        },
        symlinks: false,
    },
    plugins: [
        new MiniCssExtractPlugin({
            filename: '[name]/build.css',
        }),

        new CopyWebpackPlugin({
            patterns: [
                {
                    globOptions: { ignore: ['**/*.scss', '**/*.css'] },
                    from: path.resolve(__dirname, '../dev/parea/css/'),
                    to: 'parea/',
                },
                {
                    globOptions: { ignore: ['**/*.scss', '**/*.css'] },
                    from: path.resolve(__dirname, '../dev/rarea/css/'),
                    to: 'rarea/',
                },
            ],
        }),
    ],
    module: {
        rules: [
            {
                test: /\.(js|ts)$/i,
                loader: 'babel-loader',
                exclude: /node_modules/,
            },
            {
                test: /\.js$/,
                enforce: 'pre',
                use: ['source-map-loader'],
            },
            {
                test: /\.s[ac]ss$/i,
                use: [
                    { loader: MiniCssExtractPlugin.loader },
                    { loader: 'css-loader', options: { url: false } },
                    {
                        loader: 'sass-loader',
                        options: {
                            api: 'modern',
                            sassOptions: {
                                outputStyle: 'compressed',
                            },
                        },
                    },
                ],
            },
            {
                test: /\.(eot|svg|ttf|woff|woff2|png|jpg|gif)$/i,
                type: 'asset',
            },
        ],
    },
};
