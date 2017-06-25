// @flow

const app = require('../shared/Express');
const databaseref = require('../shared/Firebase');
const authentication = require('../shared/Authentication');
const result = require('../shared/RequestResult');
const tokenManager = require('../shared/TokenManager');

app.post('/api/add_school', function (req, res) {
    var token = req.query.token;

    var auth = authentication.permissions(token);
    if (!authentication.admin) {
        res.status(result.requestforbidden).send(result.invalidtoken);
        return;
    }

    var name = req.body['name'];
    var full_name = req.body['full_name'];
    var domain = req.body['domain'];
    var school_identifier = req.body['school_identifier'];

    if (!name) {
        res.status(result.requestbad).send("invalid parameters: no name");
        return;
    }

    if (!full_name) {
        res.status(result.requestbad).send("invalid parameters: no full name");
        return;
    }

    if (!domain) {
        res.status(result.requestbad).send("invalid parameters: no domain");
        return;
    }

    if (!school_identifier) {
        res.status(result.requestbad).send("invalid parameters: no school identifier");
        return;
    }

    databaseref.child('schools/' + school_identifier + '/name').once('value').then(function (snapshot) {
        if (!snapshot.val()) {

            var school = {
                name: name,
                full_name: full_name,
                domain: domain,
                school_identifier: school_identifier
            };

            databaseref.child('schools/' + school_identifier).set(school);

            var info = {
                full_name: full_name,
                domain: domain
            };

            databaseref.child('app_settings/allowed_domains/' + school_identifier).set(info);

            res.status(result.requestsuccessful).send(result.schooladded);
        }
        else {
            res.status(result.requestduplicate).send(
                result.invalidparams + ' school exists ' + snapshot.val()
            );
            return;
        }

    }).catch(error => console.log(error));
});