// @flow

const app = require('../shared/Express');
const databaseref = require('../shared/Firebase');
const authentication = require('../shared/Authentication');
const result = require('../shared/RequestResult');
const tokenManager = require('../shared/TokenManager');

app.get('/api/get_user_basic_info', function(req, res){
    var token = req.query.token;

    var auth = authentication.permissions(token);
    if(!authentication.admin && !authentication.read){
         res.status(result.requestforbidden).send(result.invalidtoken + ' token could not be authenticated');
        return;
    }

    tokenManager.incrementTokenCalls(token);

    var school_identifier = req.query.school_identifier;
    var uid = req.query.uid;

    if(!uid){
        res.status(result.requestbad).send('invalid parameters: no uid');
        return;
    }

    if(!school_identifier){
        res.status(result.requestbad).send('invalid parameters: no school identifier');
        return;
    }

    databaseref.child('schools/' + school_identifier + '/users/' + uid).once('value').then(function(snapshot){
            if(snapshot.val()) {
                var basic_info = {
                  name: snapshot.val()['first_name'] + ' ' + snapshot.val()['last_name'],
                  first_name: snapshot.val()['first_name'],
                  graduation_year: snapshot.val()['graduation_year'],
                  major: snapshot.val()['major'],
                  academic_level: snapshot.val()['academic_level'],
                  hometown: snapshot.val()['hometown'],
                  profile_image_url: snapshot.val()['profile_image_url'],
                  user_id: snapshot.val()['user_id']
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
