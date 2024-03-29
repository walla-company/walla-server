// @flow

var express = require('express');
var bodyParser = require('body-parser');

const app = express();
const localPort = 8080;

app.set('port', (process.env.PORT || localPort));

app.use(express.static(__dirname + '/public'));

app.use(bodyParser.json());
// CORS
app.use(function(req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', '*');
    res.header('Access-Control-Allow-Headers', 'Content-Type');

    next();
});
// views is directory for all template files
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');

app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});

module.exports = app;
