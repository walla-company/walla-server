// @flow

const app = require('../shared/Express');
const databaseref = require('../shared/Firebase');
const authentication = require('../shared/Authentication');
const result = require('../shared/RequestResult');
const tokenManager = require('../shared/TokenManager');
const mailManager = require('../shared/MailManager');

app.post('/api/request_verification', function(req, res){
    var token = req.query.token;

    var auth = authentication.permissions(token);
    if(!authentication.admin && !authentication.write){
         res.status(result.requestforbidden).send(result.invalidtoken + ' token could not be authenticated');
        return;
    }

    var school = req.body['school_identifier'];
    if(!school){
        res.status(result.requestbad).send('invalid parameters: no domain');
        return;
    }

    var email = req.body['email'];
    if(!email){
        res.status(result.requestbad).send('invalid parameters: no email');
        return;
    }

    var uid = req.body['uid'];
    if(!uid){
        res.status(result.requestbad).send('invalid parameters: no uid');
        return;
    }

    databaseref.child('schools').child(school).child('users').child(uid).child('email').set(email);
    
    mailManager.sendVerificationEmail(email, uid, school, res);
});
