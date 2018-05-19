// const Promise = require("bluebird");
const pug = require('pug');
var path = require('path');

// Server for local testing
const express = require('express');
var app = express();
app.use(express.static(path.join(__dirname, 'public')));
// respond with "hello world" when a GET request is made to the homepage
app.get('/', function (req, res) {
	var render = pug.compileFile('layout.pug');
	res.send(render())
});

app.listen(3000, () => console.log('Example app listening on port 3000!'))

// exports.handle = (event, context, callback) => {
// }