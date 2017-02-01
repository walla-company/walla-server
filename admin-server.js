var express = require('express'); //npm install express --save
var bodyParser = require('body-parser');

var appAdminSecret = 'L9HteLk90'; //random secret.
var appTokenSessionTime = 60 * 60 * 1; //in seconds

module.exports = function(routesFn) {
    var appAdmin = express();
    appAdmin.set('port', ((process.env.PORT + 1) || 8081));
    appAdmin.use(bodyParser.json());

    appAdmin.use(function(req, res, next) {
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', '*');
        res.header('Access-Control-Allow-Headers', 'Content-Type');

        next();
    });

    appAdmin.listen(appAdmin.get('port'), function() {
        console.log('Admin web app is running on port', appAdmin.get('port'));
    });

    routesFn({
        appAdmin: appAdmin,
        appAdminSecret: appAdminSecret,
        appTokenSessionTime: appTokenSessionTime
    });
};