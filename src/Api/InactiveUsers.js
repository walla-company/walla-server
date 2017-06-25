// @flow

const app = require('../shared/Express');
const databaseref = require('../shared/Firebase');
const authentication = require('../shared/Authentication');
const result = require('../shared/RequestResult');
const tokenManager = require('../shared/TokenManager');

app.get('/api/get_inactive_users', function (req, res) {
    var token = req.query.token;

    var auth = authentication.permissions(token);
    if (!auth.admin) {
        res.status(result.requestforbidden).send(result.invalidtoken);
        return;
    }

    tokenManager.incrementTokenCalls(token);

    var school_identifier = req.query.school_identifier;

    if (!school_identifier) {
        res.status(result.requestbad).send(result.invalidparams + ' no school identifier');
        return;
    }

    var timequery = new Date().getTime() / 1000 - 2592000;

    tokenManager.incrementTokenCalls(token);

    databaseref.child('schools/' + school_identifier + '/users/').once('value').then(function (snapshot) {
        if (snapshot.val()) {

            var inactive_users = [];

            Object.keys(snapshot.val()).forEach(function (key) {
                var user = snapshot.val()[key];

                if (user.hasOwnProperty("last_logon")) {
                    if (user["last_logon"] <= timequery) {
                        var user_info = {
                            uid: user["user_id"],
                            email: user["email"],
                            first_name: user["first_name"],
                            last_name: user["last_name"]
                        };

                        inactive_users.push(user_info);
                    }
                }
                else {
                    var user_info = {
                        uid: user["user_id"],
                        email: user["email"],
                        first_name: user["first_name"],
                        last_name: user["last_name"]
                    };

                    inactive_users.push(user_info);
                }

            });

            res.status(result.requestsuccessful).send(inactive_users);

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