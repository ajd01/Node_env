require('babel-register')()
//If moka see .css file just see like empty funciton
require.extensions['.css'] = function() {}