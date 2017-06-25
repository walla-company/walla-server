// @flow

const app = require('../shared/Express');
const databaseref = require('../shared/Firebase');
const authentication = require('../shared/Authentication');
const result = require('../shared/RequestResult');
const tokenManager = require('../shared/TokenManager');

app.post('/api/delete_activity', function (req, res) {
    var token = req.query.token;

    var auth = authentication.permissions(token);
    if (!authentication.admin && !authentication.read) {
        res.status(result.requestforbidden).send(result.invalidtoken);
        return;
    }

    tokenManager.incrementTokenCalls(token);

    var school_identifier = req.body.school_identifier;
    var auid = req.body.auid;
    var uid = req.body.uid;

    if (!auid) {
        res.status(result.requestbad).send(result.invalidparams + ' no auid');
        return;
    }

    if (!school_identifier) {
        res.status(result.requestbad).send(result.invalidparams + ' no school identifier');
        return;
    }

    if (!uid) {
        res.status(result.requestbad).send(result.invalidparams + ' no uid');
        return;
    }

    databaseref.child('schools/' + school_identifier + '/activities/' + auid).child('deleted').set(true);

    databaseref.child('schools/' + school_identifier + '/activities/' + auid).once('value').then(function (snapshot) {
        if (snapshot.val()) {

            var host_id = snapshot.val()["host"];

            if (host_id == uid) {
                var host_id = snapshot.val()["host"];
            }

            res.status(result.requestsuccessful).send({});

        }
        else {
            res.status(result.requestsuccessful).send({});
        }
    })
        .catch(function (error) {
            res.status(result.requestbad).send(error);
            console.log(error);
        });
});
