// @flow

const app = require('../shared/Express');
const databaseref = require('../shared/Firebase');
const authentication = require('../shared/Authentication');
const result = require('../shared/RequestResult');
const tokenManager = require('../shared/TokenManager');

app.get('/api/verify', function(req, res){
    var token = req.query.token;

    var auth = authentication.permissions(token);
    if(!authentication.verify){
         res.status(result.requestforbidden).send(result.invalidtoken + ' token could not be authenticated');
        return;
    }

    var school = req.query.domain;
    if(!school){
        res.status(result.requestbad).send('invalid parameters: no domain');
        return;
    }

    var uid = req.query.uid;
    if(!uid){
        res.status(result.requestbad).send('invalid parameters: no uid');
        return;
    }

    var hash = req.query.hash;
    if(!hash){
        res.status(result.requestbad).send('invalid parameters: no hash');
        return;
    }
   verifyUser(school, uid, hash, res);

});

function verifyUser(school, uid, hash, res){
    databaseref.child('schools').child(school).child('users').child(uid).once('value').then(function(snapshot){
        var user = snapshot.val();
        if(user){
            var userhash = user.hash;
            if(userhash || user.verified == true){
                if(userhash == hash || user.verified == true){
                    databaseref.child('schools').child(school).child('users').child(uid).child('verified').set(true);
                    databaseref.child('schools').child(school).child('users').child(uid).child('hash').remove();
                    res.redirect('/welcome');
                }else{
                    res.status(result.requestforbidden).send(result.invalidtoken + ' could not authenticate request');
                }
            }else{
                res.status(result.requestforbidden).send(result.invalidtoken + ' could not authenticate request');
            }
        }else{
            res.status(result.requestnotfound).send('user not found');
        }
    });
}
