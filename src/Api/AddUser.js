// @flow

const app = require('../shared/Express');
const databaseref = require('../shared/Firebase');
const authentication = require('../shared/Authentication');
const result = require('../shared/RequestResult');
const tokenManager = require('../shared/TokenManager');

app.post('/api/add_user', function(req, res){
  var token = req.query.token;

  var auth = authentication.permissions(token);
  if(!authentication.admin && !authentication.write){
       res.status(result.requestforbidden).send(result.invalidtoken + ' token could not be authenticated');
      return;
  }

  tokenManager.incrementTokenCalls(token);

  console.log(JSON.stringify(req.body));
  
  var uid = req.body['uid'];
  var school_identifier = req.body['school_identifier'];
  var first_name = req.body['first_name'];
  var last_name = req.body['last_name'];
  var email = req.body['email'];
  var profile_image_url = req.body['profile_image_url'];
  
  /* Not required */
  var academic_level = '';//req.body['academic_level'];
  var major = '';//req.body['major'];
  var graduation_year = -1;//req.body['graduation_year'];
  var hometown = '';//req.body['hometown'];
  var description = '';//req.body['description'];

  if(!uid){
      res.status(result.requestbad).send('invalid parameters: no uid');
      return;
  }

  if(!school_identifier){
      res.status(result.requestbad).send('invalid parameters: no school identifier');
      return;
  }

  if(!first_name){
      res.status(result.requestbad).send('invalid parameters: no first name');
      return;
  }

  if(!last_name){
      res.status(result.requestbad).send('invalid parameters: no last name');
      return;
  }

  if(!email){
      res.status(result.requestbad).send('invalid parameters: no email');
      return;
  }

  if(!profile_image_url){
      profile_image_url = '';
  }

  var current_time = new Date().getTime() / 1000;

  databaseref.child('schools/' + school_identifier + '/users/' + uid + '/user_id').set(uid);
  databaseref.child('schools/' + school_identifier + '/users/' + uid + '/verified').set(true);
  databaseref.child('schools/' + school_identifier + '/users/' + uid + '/first_name').set(first_name);
  databaseref.child('schools/' + school_identifier + '/users/' + uid + '/last_name').set(last_name);
  databaseref.child('schools/' + school_identifier + '/users/' + uid + '/email').set(email);
  databaseref.child('schools/' + school_identifier + '/users/' + uid + '/academic_level').set(academic_level);
  databaseref.child('schools/' + school_identifier + '/users/' + uid + '/major').set(major);
  databaseref.child('schools/' + school_identifier + '/users/' + uid + '/graduation_year').set(graduation_year * 1);
  databaseref.child('schools/' + school_identifier + '/users/' + uid + '/hometown').set(hometown);
  databaseref.child('schools/' + school_identifier + '/users/' + uid + '/description').set(description);
  databaseref.child('schools/' + school_identifier + '/users/' + uid + '/profile_image_url').set(profile_image_url);
  databaseref.child('schools/' + school_identifier + '/users/' + uid + '/time_created').set(current_time*1.0);
  databaseref.child('schools/' + school_identifier + '/users/' + uid + '/intro_complete').set(false);

  databaseref.child('schools/' + school_identifier + '/search_users_array/' + uid).set(first_name + ' ' + last_name);

  res.status(result.requestsuccessful).send('user added');

});
