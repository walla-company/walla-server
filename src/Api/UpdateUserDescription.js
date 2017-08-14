// @flow

const app = require('../shared/Express');
const databaseref = require('../shared/Firebase');
const authentication = require('../shared/Authentication');
const result = require('../shared/RequestResult');
const tokenManager = require('../shared/TokenManager');
const pointsManager = require('../shared/PointsManager');

app.post('/api/update_user_description', function(req, res){
  var token = req.query.token;

  var auth = authentication.permissions(token);
  if(!authentication.admin && !authentication.write){
       res.status(result.requestforbidden).send(result.invalidtoken + ' token could not be authenticated');
      return;
  }

  tokenManager.incrementTokenCalls(token);

  var uid = req.body['uid'];
  var school_identifier = req.body['school_identifier'];
  var description = req.body['description'];

  if(!uid){
      res.status(result.requestbad).send('invalid parameters: no uid');
      return;
  }

  if(!school_identifier){
      res.status(result.requestbad).send('invalid parameters: no school identifier');
      return;
  }

  if(!description){
      res.status(result.requestbad).send('invalid parameters: no description');
      return;
  }

  databaseref.child('schools/' + school_identifier + '/users/' + uid + '/description').set(description);

  pointsManager.addProfileCompletionPointsToUser(school_identifier, uid);

  res.status(result.requestsuccessful).send('user description updated');

});
