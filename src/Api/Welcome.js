// @flow

const app = require('../shared/Express');
const databaseref = require('../shared/Firebase');
const authentication = require('../shared/Authentication');
const result = require('../shared/RequestResult');
const tokenManager = require('../shared/TokenManager');
const fs = require('fs');

app.get('/welcome', function(req, res){
    fs.readFile('../../html/emailverification.html', function (err, data){
        res.writeHead(200, {'Content-Type': 'text/html','Content-Length': data.length});
        res.write(data);
        res.end();
    });
});