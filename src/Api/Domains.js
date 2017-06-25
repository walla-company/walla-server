// @flow

const app = require('../shared/Express');
const databaseref = require('../shared/Firebase');
const authentication = require('../shared/Authentication');
const result = require('../shared/RequestResult');

var domains = databaseref.child('app_settings/allowed_domains');
domains.on('value', (snapshot) => domains = snapshot.val());

app.get('/api/domains', function (req, res) {
    var token = req.query.token;

    var auth = authentication.permissions(token);
    if (!authentication.read && !authentication.admin) {
        res.status(result.requestforbidden).send(result.invalidtoken);
        return;
    }

    // HACK(anesu): server wasn't returning correct list
    // TODO(anesu): figure out why server not returning correct list
    if (domains.au.domain)
        domains.au.domain = "au.edu"

    res.send(domains)
});

app.get('/api/is_domain_allowed', function (req, res) {
    var token = req.query.token;

    var auth = authentication.permissions(token);
    if (!authentication.read && !authentication.admin) {
        res.status(result.requestforbidden).send(result.invalidtoken);
        return;
    }

    var domain = req.query.domain;

    if (!domain) {
        res.status(result.requestbad).send(result.invalidparams);
    }

    if (domainAllowed(domain)) {
        res.send({ 'allowed': true });
        return;
    }

    res.send({ 'allowed': false });

});

function domainAllowed(domain) {
    var key;
    for(key in domains){
        if(domains[key]['domain'] == domain) return true;
    }

    return false;
};

module.exports = {
    domainAllowed: domainAllowed,
}
