import express from 'express';
import path from 'path';
//import open from 'open';
import webpack from 'webpack';
import config from '../webpack.config.dev'


const port = 3000 
const app = express()
const compiler = webpack(config)

app.use(require('webpack-dev-middleware')(compiler, {
  noInfo : true,
  publicPath: config.output.publicPath  
}))

app.get('/users', function (req, res) {
    res.json([
        {"id":13341313,"name":"Robert Cas","email":"Robert@mail.com"},
        {"id":13341313,"name":"Lara Cas","email":"Lara@mail.com"},
        {"id":13341313,"name":"Bini Cas","email":"Bini@mail.com"}
    ])
})

app.get('/', function (req, res) {
    res.sendFile(path.join(__dirname,'../src/index.html'))
  });
  

app.listen(port, function () {
  console.log('Example app listening on port 3000!');
});