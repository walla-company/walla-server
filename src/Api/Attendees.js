// @flow

const app = require('../shared/Express');
const databaseref = require('../shared/Firebase');
const authentication = require('../shared/Authentication');
const result = require('../shared/RequestResult');
const tokenManager = require('../shared/TokenManager');
const domains = require('./Domains');

app.get('/api/attendees', function(req, res){
    var token = req.query.token;

    var auth = authentication.permissions(token);
    if(!authentication.read && !authentication.admin){
         res.status(result.requestforbidden).send(result.invalidtoken + ' token could not be authenticated');
        return;
    }

    var school = req.query.domain;
    if(!school){
        res.status(result.requestbad).send('invalid parameters: no domain');
        return;
    }

    if(!domains.domainAllowed(school)){
        res.status(result.requestbad).send('domain ' + school + ' is not allowed');
        return;
    }

    var event = req.query.event;
    if(!event){
        res.status(result.requestbad).send('invalid parameters: no event key');
        return;
    }

    var attendees = [];
    databaseref.child(school).child('attendees').child(event).once('value')
        .then(function(snapshot){
            var att = snapshot.val();
            sendUsersAttending(att, [], school, res);


        }).catch(error => console.log(error));

});

function sendUsersAttending(att, attendees, school, res){
    var key = Object.keys(att)[0];
    if(!key){
        res.status(result.requestbad).send('could not retrieve data');
        return;
    }

    delete att[key];

    databaseref.child(school).child('users/' + key).once('value').then(function(snapshot){
        attendees.push(snapshot.val());

        if(Object.keys(att).length == 0){
             res.status(result.requestsuccessful).send(attendees);
        }else{
            sendUsersAttending(att, attendees, school, res);
        }
     }).catch(function(error){
        console.log(error)
     })
}
