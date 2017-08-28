// @flow

const app = require('../shared/Express');
const databaseref = require('../shared/Firebase');
const authentication = require('../shared/Authentication');
const result = require('../shared/RequestResult');
const tokenManager = require('../shared/TokenManager');
const fs = require('fs');
const path = require('fs');

app.get('/welcome', function(req, res){
    console.log(path.join(__dirname, '../../html/emailverification.html'));
    fs.readFile(path.join(__dirname, '../../html/emailverification.html'), function (err, data){
        res.writeHead(200, {'Content-Type': 'text/html','Content-Length': data.length});
        res.write(data);
        res.end();
    });
});