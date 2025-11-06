module.exports = {
    globDirectory: 'dist/',
    globPatterns: [
        '**/*.{js,css,html,ico,png,svg,json}'
    ],
    swDest: 'dist/sw.js',
    clientsClaim: true,
    skipWaiting: true,
};