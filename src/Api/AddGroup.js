// @flow

const app = require('../shared/Express');
const databaseref = require('../shared/Firebase');
const authentication = require('../shared/Authentication');
const result = require('../shared/RequestResult');
const tokenManager = require('../shared/TokenManager');
var randomcolor = require('randomcolor');

app.post('/api/add_group', function (req, res) {
    var token = req.query.token;

    var auth = authentication.permissions(token);
    if (!authentication.admin) {
        res.status(result.requestforbidden).send(result.invalidtoken);
        return;
    }

    var name = req.body['name'];
    var short_name = req.body['short_name'];
    var school_identifier = req.body['school_identifier'];
    var details = req.body['details'];

    if (!name) {
        res.status(result.requestbad).send(result.invalidparams + ' no name');
        return;
    }

    if (!short_name) {
        res.status(result.requestbad).send(result.invalidparams+ ' no short name');
        return;
    }

    if (!school_identifier) {
        res.status(result.requestbad).send(result.invalidparams + ' no school identifier');
        return;
    }

    if (!details) {
        res.status(result.requestbad).send(result.invalidparams + ' no details');
        return;
    }

    var group = {
        name: name,
        short_name: short_name,
        color: randomcolor(),
        details: details
    };

    var newGroupRef = databaseref.child('schools/' + school_identifier + '/groups').push(group);
    var guid = newGroupRef.key;

    newGroupRef.child('group_id').set(guid);
    databaseref.child('schools/' + school_identifier + '/search_groups_array/' + guid).set(name + " " + short_name);

    res.status(result.requestsuccessful).send('Group ' + name + 'added');
});