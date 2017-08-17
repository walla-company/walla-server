// @flow

const app = require('../shared/Express');
const databaseref = require('../shared/Firebase');
const authentication = require('../shared/Authentication');
const result = require('../shared/RequestResult');
const tokenManager = require('../shared/TokenManager');
const pointsManager = require('../shared/PointsManager');

app.post('/api/update_user_wanna_meet', function(req, res){
  var token = req.query.token;

  var auth = authentication.permissions(token);
  if(!authentication.admin && !authentication.write){
       res.status(result.requestforbidden).send(result.invalidtoken + ' token could not be authenticated');
      return;
  }

  tokenManager.incrementTokenCalls(token);

  var uid = req.body['uid'];
  var school_identifier = req.body['school_identifier'];
  var wanna_meet = req.body['wanna_meet'];

  if(!uid){
      res.status(result.requestbad).send('invalid parameters: no uid');
      return;
  }

  if(!school_identifier){
      res.status(result.requestbad).send('invalid parameters: no school identifier');
      return;
  }

  if(!wanna_meet){
      res.status(result.requestbad).send('invalid parameters: no wanna_meet');
      return;
  }

  databaseref.child('schools/' + school_identifier + '/users/' + uid + '/wanna_meet').set(wanna_meet);

  pointsManager.addProfileCompletionPointsToUser(school_identifier, uid);

  res.status(result.requestsuccessful).send('wanna_meet updated');

});
