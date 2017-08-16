// @flow

const app = require('../shared/Express');
const databaseref = require('../shared/Firebase');
const authentication = require('../shared/Authentication');
const result = require('../shared/RequestResult');
const tokenManager = require('../shared/TokenManager');
const mailManager = require('../shared/MailManager');

app.post('/api/request_token', function (req, res) {
    var token = req.query.token;

    var auth = authentication.permissions(token);
    if (!authentication.admin) {
        res.status(result.requestforbidden).send("token could not be authenticated");
        return;
    }

    var owner = req.body['owner'];
    var email = req.body['email'];

    if (!owner) {
        res.status(result.requestbad).send("invalid parameters: no owner");
        return;
    }

    if (!email) {
        res.status(result.requestbad).send("invalid parameters: no email");
        return;
    }

    var r = req.query.r;
    var w = req.query.w;
    var d = req.query.d;
    var a = req.query.a;
    var v = req.query.v;

    if (!r) r = 0;
    if (!w) w = 0;
    if (!d) d = 0;
    if (!a) a = 0;
    if (!v) v = 0;

    var auth = 0;
    auth = r == 0 ? auth : (auth | authentication.read);
    auth = w == 0 ? auth : (auth | authentication.write);
    auth = d == 0 ? auth : (auth | authentication.del);
    auth = a == 0 ? auth : (auth | authentication.admin);
    auth = v == 0 ? auth : (auth | authentication.verify);

    tokenManager.incrementTokenCalls(token);

    var token = tokenManager.TokenGenerator.generate();

    var authobj = {};
    authobj[token] = {
        owner: owner,
        email: email,
        auth: auth,
        calls: 0,
    };

    databaseref.child('app_settings/api_keys').update(authobj);

    var permissions = [];
    if (auth & authentication.read) permissions.push('read');
    if (auth & authentication.write) permissions.push('write');
    if (auth & authentication.del) permissions.push('delete');
    if (auth & authentication.admin) permissions.push('admin');
    if (auth & authentication.verify) permissions.push('verify');


    mailManager.sendTokenViaEmail(token, email, owner, permissions);
    res.status(result.requestsuccessful).send("email sent");

});