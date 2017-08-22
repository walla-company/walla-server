// @flow

const app = require('../shared/Express');
const databaseref = require('../shared/Firebase');
const authentication = require('../shared/Authentication');
const result = require('../shared/RequestResult');
const tokenManager = require('../shared/TokenManager');
const pointsManager = require('../shared/PointsManager');

app.post('/api/update_user_profile', function(req, res){
  var token = req.query.token;

  var auth = authentication.permissions(token);
  if(!authentication.admin && !authentication.write){
       res.status(result.requestforbidden).send(result.invalidtoken + ' token could not be authenticated');
      return;
  }

  tokenManager.incrementTokenCalls(token);

  var uid = req.body['uid'];
  var school_identifier = req.body['school_identifier'];

  if(!uid){
      res.status(result.requestbad).send('invalid parameters: no uid');
      return;
  }

  if(!school_identifier){
      res.status(result.requestbad).send('invalid parameters: no school identifier');
      return;
  }

  const bodyKeys = Object.keys(req.body);

  const fieldsToUpdate = [
    'first_name',
    'last_name',
    'email',
    'description',
    'academic_level',
    'graduation_year',
    'hometown',
    'major',
    'profile_image_url',
    'reason_school',
    'signature_emoji',
    'wanna_meet',
    'goal1',
    'goal2',
    'goal3',
    'interests'
  ];
  
  fieldsToUpdate.forEach(field => {
      if (bodyKeys.indexOf(field) > -1) {
          const fieldData = req.body[field];
        databaseref.child('schools/' + school_identifier + '/users/' + uid + '/' + field).set(fieldData);
        if (field === 'first_name') {
              databaseref.child('schools/' + school_identifier + '/users/' + uid + '/last_name').once('value').then(function(snapshot){
                        if(snapshot.val())
                            databaseref.child('schools/' + school_identifier + '/search_users_array/' + uid).set(fieldData + ' ' + snapshot.val());
                        else
                            res.status(result.requestbad).send('could not get last name');
                    })
                    .catch(function(error){
                        res.status(result.requestbad).send(error);
                        console.log(error);
                });
        } else if (field === 'last_name') {

                databaseref.child('schools/' + school_identifier + '/users/' + uid + '/first_name').once('value').then(function(snapshot){
                        if(snapshot.val())
                            databaseref.child('schools/' + school_identifier + '/search_users_array/' + uid).set(snapshot.val() + ' ' + fieldData);
                        else
                            res.status(result.requestbad).send('could not get first name');
                    })
                    .catch(function(error){
                        res.status(result.requestbad).send(error);
                        console.log(error);
                });
        }
      }
  })


  pointsManager.addProfileCompletionPointsToUser(school_identifier, uid);

  res.status(result.requestsuccessful).send('user profile updated');

});
