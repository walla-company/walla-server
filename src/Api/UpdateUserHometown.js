// @flow

const app = require('../shared/Express');
const databaseref = require('../shared/Firebase');
const authentication = require('../shared/Authentication');
const result = require('../shared/RequestResult');
const tokenManager = require('../shared/TokenManager');

app.post('/api/update_user_hometown', function(req, res){
  var token = req.query.token;

  var auth = authentication.permissions(token);
  if(!authentication.admin && !authentication.write){
       res.status(result.requestforbidden).send(result.invalidtoken + ' token could not be authenticated');
      return;
  }

  tokenManager.incrementTokenCalls(token);

  var uid = req.body['uid'];
  var school_identifier = req.body['school_identifier'];
  var hometown = req.body['hometown'];

  if(!uid){
      res.status(result.requestbad).send('invalid parameters: no uid');
      return;
  }

  if(!school_identifier){
      res.status(result.requestbad).send('invalid parameters: no school identifier');
      return;
  }

  if(!hometown){
      res.status(result.requestbad).send('invalid parameters: no hometown');
      return;
  }

  databaseref.child('schools/' + school_identifier + '/users/' + uid + '/hometown').set(hometown);

  res.status(result.requestsuccessful).send('hometown updated');

});
