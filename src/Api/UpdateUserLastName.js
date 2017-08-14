// @flow

const app = require('../shared/Express');
const databaseref = require('../shared/Firebase');
const authentication = require('../shared/Authentication');
const result = require('../shared/RequestResult');
const tokenManager = require('../shared/TokenManager');
const pointsManager = require('../shared/PointsManager');

app.post('/api/update_user_last_name', function(req, res){
  var token = req.query.token;

  var auth = authentication.permissions(token);
  if(!authentication.admin && !authentication.write){
       res.status(result.requestforbidden).send(result.invalidtoken + ' token could not be authenticated');
      return;
  }

  tokenManager.incrementTokenCalls(token);

  var uid = req.body['uid'];
  var school_identifier = req.body['school_identifier'];
  var last_name = req.body['last_name'];

  if(!uid){
      res.status(result.requestbad).send('invalid parameters: no uid');
      return;
  }

  if(!school_identifier){
      res.status(result.requestbad).send('invalid parameters: no school identifier');
      return;
  }

  if(!last_name){
      res.status(result.requestbad).send('invalid parameters: no last name');
      return;
  }

  databaseref.child('schools/' + school_identifier + '/users/' + uid + '/last_name').set(last_name);

  databaseref.child('schools/' + school_identifier + '/users/' + uid + '/first_name').once('value').then(function(snapshot){
          if(snapshot.val())
              databaseref.child('schools/' + school_identifier + '/search_users_array/' + uid).set(snapshot.val() + ' ' + last_name);
          else
              res.status(result.requestbad).send('could ot get first name');
      })
      .catch(function(error){
          res.status(result.requestbad).send(error);
          console.log(error);
  });

  pointsManager.addProfileCompletionPointsToUser(school_identifier, uid);

  res.status(result.requestsuccessful).send('last name updated');

});
