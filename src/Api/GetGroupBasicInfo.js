// @flow

const app = require('../shared/Express');
const databaseref = require('../shared/Firebase');
const authentication = require('../shared/Authentication');
const result = require('../shared/RequestResult');
const tokenManager = require('../shared/TokenManager');

app.get('/api/get_group_basic_info', function(req, res){
    var token = req.query.token;

    var auth = authentication.permissions(token);
    if(!authentication.admin && !authentication.read){
         res.status(result.requestforbidden).send(result.invalidtoken + ' token could not be authenticated');
        return;
    }

    tokenManager.incrementTokenCalls(token);

    var school_identifier = req.query.school_identifier;
    var guid = req.query.guid;

    if(!guid){
        res.status(result.requestbad).send('invalid parameters: no guid');
        return;
    }

    if(!school_identifier){
        res.status(result.requestbad).send('invalid parameters: no school identifier');
        return;
    }

    databaseref.child('schools/' + school_identifier + '/groups/' + guid).once('value').then(function(snapshot){
            if(snapshot.val()) {
              
              var num_members = 0;
              
              if (snapshot.val()['members']) {
                num_members = Object.keys(snapshot.val()['members']).length;
              }
              
              var basic_info = {
                name: snapshot.val()['name'],
                short_name: snapshot.val()['short_name'],
                color: snapshot.val()['color'],
                group_id: snapshot.val()['group_id'],
                member_count: num_members
              };
              res.status(result.requestsuccessful).send(basic_info);
            }
            else {
                res.status(result.requestsuccessful).send({});
              }
        })
        .catch(function(error){
            res.status(result.requestbad).send(error);
            console.log(error);
    });

});
