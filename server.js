var express = require('express'); //npm install express --save
var firebase = require('firebase'); //npm install firebase --save
var admin = require('firebase-admin'); //npm install firebase-admin --save
var TokenGenerator = require( 'token-generator' )({
        salt: 'the key to success is to be successful, but only sometimes',
        timestampMap: 'N72md4XaF8', // 10 chars array for obfuscation proposes
});
var nodemailer = require('nodemailer'); //npm install nodemailer --save
var fs = require('fs');
var bodyParser = require('body-parser');

//***************CONSTANTS*************//

const SECONDSINHOUR = 3600; //used to filter activities with last X hours
const port  = 8080;

const REQUESTSUCCESSFUL = 200;
const REQUESTFORBIDDEN = 403;
const REQUESTBAD = 400;
const REQUESTNOTFOUND = 404;
const REQUESTDUPLICATE = 409;

const LEVEL1 = 1; //read
const LEVEL2 = 2; //write
const LEVEL3 = 4; //delete
const LEVEL4 = 8; //admin
const LEVEL5 = 16; //verify

const MAXFLAGS = 2;

const FLAGREPORTEMAIL = 'hollawalladuke@gmail.com' //'hollawalladuke@gmail.com';
const WEBSITE = 'https://walla-server.herokuapp.com';


//***************INITIALIZATION*************//

var app = express();

app.set('port', (process.env.PORT || 8080));

app.use(express.static(__dirname + '/public'));

app.use(bodyParser.json());

// views is directory for all template files
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');

app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});

//setup for email
var transporter = nodemailer.createTransport({
        service: 'Aol',
        auth: {
            user: 'wallaapitesting@aol.com', // Your email id
            pass: 'nodemailer' // Your password
        }
});

//all the stored variables
var domains = {};
var minversion = {};

var readpriv = [];
var writepriv = [];
var deletepriv = [];
var adminpriv = [];
var verifypriv = [];

var emailverificationtemplate;
var apikeytemplate;

//***************AUTHENTICATION*************//

// Initialize Firebase
var config = {
    apiKey: "AIzaSyDly8Ewgiyhb14hHbHiSnLcu6zUOvEbuF0",
    authDomain: "walla-launch.firebaseapp.com",
    databaseURL: "https://walla-launch.firebaseio.com",
    storageBucket: "walla-launch.appspot.com",
    messagingSenderId: "261500518113"
};

var defaultApp = admin.initializeApp({
  credential: admin.credential.cert("admin/serviceAccountKey.json"),
  databaseURL: "https://walla-launch.firebaseio.com"
});

var defaultAuth = defaultApp.auth();
var database = defaultApp.database();
var databaseref = database.ref();

function authenticateToken(token){
    var auth;

    if(!token){
        auth = 0;
    }else{
        auth = getAuth(token);
    }

    return {'read': auth & LEVEL1,
        'write': auth & LEVEL2,
        'delete': auth & LEVEL3,
        'admin': auth & LEVEL4,
        'verify': auth & LEVEL5
    };
}


//***************LISTENERS*************//

//listener for allowed domains
const ad = databaseref.child('app_settings/allowed_domains');
ad.on('value', snapshot => domains = snapshot.val());

//listener for minimum version
const mv = databaseref.child('app_settings/min_version');
mv.on('value', snapshot => minversion = snapshot.val());

const at = databaseref.child('app_settings/api_keys');
at.on('value', snapshot => {
    var auth = snapshot.val();

    console.log('auth: ' + auth);

    readpriv = [];
    writepriv = [];
    deletepriv = [];
    adminpriv = [];
    verifypriv = [];

    for(key in auth){
        if(auth[key].auth & LEVEL1) readpriv.push(key);
        if(auth[key].auth & LEVEL2) writepriv.push(key);
        if(auth[key].auth & LEVEL3) deletepriv.push(key);
        if(auth[key].auth & LEVEL4) adminpriv.push(key);
        if(auth[key].auth & LEVEL5) verifypriv.push(key);
    }
});

const evl = databaseref.child('templates').child('emailverification');
evl.on('value', snapshot => emailverificationtemplate = snapshot.val().template);

const akt = databaseref.child('templates').child('apikey');
akt.on('value', snapshot => apikeytemplate = snapshot.val().template);

//***************Admin Methods*************//

app.post('/api/request_token', function(req, res){
    var token = req.query.token;

    var auth = authenticateToken(token);
    if(!auth.admin){
         res.status(REQUESTFORBIDDEN).send("token could not be authenticated");
        return;
    }

    var owner = req.body['owner'];
    var email = req.body['email'];

    if(!owner){
        res.status(REQUESTBAD).send("invalid parameters: no owner");
        return;
    }

    if(!email){
        res.status(REQUESTBAD).send("invalid parameters: no email");
        return;
    }

    var r = req.query.r;
    var w = req.query.w;
    var d = req.query.d;
    var a = req.query.a;
    var v = req.query.v;

    if(!r) r = 0;
    if(!w) w = 0;
    if(!d) d = 0;
    if(!a) a = 0;
    if(!v) v = 0;

    var auth = 0;
    auth = r == 0 ? auth : auth | LEVEL1;
    auth = w == 0 ? auth : auth | LEVEL2;
    auth = d == 0 ? auth : auth | LEVEL3;
    auth = a == 0 ? auth : auth | LEVEL4;
    auth = v == 0 ? auth : auth | LEVEL5;

    incrementTokenCalls(token);

    var token = TokenGenerator.generate();

    var authobj = {};
    authobj[token] = {owner: owner,
                      email: email,
                      auth: auth,
                      calls: 0,
                     };

    databaseref.child('app_settings/api_keys').update(authobj);

    var permissions = [];
    if(auth & LEVEL1) permissions.push('read');
    if(auth & LEVEL2) permissions.push('write');
    if(auth & LEVEL3) permissions.push('delete');
    if(auth & LEVEL4) permissions.push('admin');
    if(auth & LEVEL5) permissions.push('verify');


    sendTokenViaEmail(token, email, owner, permissions);
    res.status(REQUESTSUCCESSFUL).send("email sent");

});

app.post('/api/add_school', function(req, res){
    var token = req.query.token;

    var auth = authenticateToken(token);
    if(!auth.admin){
         res.status(REQUESTFORBIDDEN).send("token could not be authenticated");
        return;
    }

    var name = req.body['name'];
    var full_name = req.body['full_name'];
    var domain = req.body['domain'];
    var school_identifier = req.body['school_identifier'];

    if (!name) {
      res.status(REQUESTBAD).send("invalid parameters: no name");
      return;
    }

    if (!full_name) {
      res.status(REQUESTBAD).send("invalid parameters: no full name");
      return;
    }

    if (!domain) {
      res.status(REQUESTBAD).send("invalid parameters: no domain");
      return;
    }

    if (!school_identifier) {
      res.status(REQUESTBAD).send("invalid parameters: no school identifier");
      return;
    }

    databaseref.child('schools/' + school_identifier + '/name').once('value').then(function(snapshot){
            if (!snapshot.exists()) {

              var school = {
                name: name,
                full_name: full_name,
                domain: domain,
                school_identifier: school_identifier
              };

              databaseref.child('schools/' + school_identifier).set(school);

              var info = {
                full_name: full_name,
                domain: domain
              };

              databaseref.child('app_settings/allowed_domains/' + school_identifier).set(info);

              res.status(REQUESTSUCCESSFUL).send('school ' + full_name + 'added');
            }
            else {
              res.status(REQUESTDUPLICATE).send("invalid parameters: school exists");
              return;
            }

        }).catch(error => console.log(error));
});

//***************DOMAIN HANDLERS*************//

//0001 - requires read rights
app.get('/api/domains', function(req, res){
    var token = req.query.token;

    var auth = authenticateToken(token);
    if(!auth.read && !auth.admin){
         res.status(REQUESTFORBIDDEN).send("token could not be authenticated");
        return;
    }

    res.send(domains)

});

app.get('/api/is_domain_allowed', function(req, res){
    var token = req.query.token;

    var auth = authenticateToken(token);
    if(!auth.read && !auth.admin){
         res.status(REQUESTFORBIDDEN).send("token could not be authenticated");
        return;
    }

    var domain = req.query.domain;

    if (!domain) {
      res.status(REQUESTBAD).send("invalid parameters: no domain");
    }

    if (domainAllowed(domain)) {
      res.send({'allowed': true});
      return;
    }

    res.send({'allowed': false});

});

//***************ACTIVITIES HANDLERS*************//

app.post('/api/add_activity', function(req, res){
    var token = req.query.token;

    var auth = authenticateToken(token);
    if(!auth.admin && !auth.write){
         res.status(REQUESTFORBIDDEN).send("token could not be authenticated");
        return;
    }

    incrementTokenCalls(token);

    var school_identifier = req.body['school_identifier'];
    var title = req.body['title'];
    var start_time = req.body['start_time'];
    var end_time = req.body['end_time'];
    var location_name = req.body['location_name'];
    var location_address = req.body['location_address'];
    var location_lat = req.body['location_lat'];
    var location_long = req.body['location_long'];
    var activity_public = req.body['activity_public'];
    var interests = req.body['interests'];
    var host = req.body['host'];
    var details = req.body['details'];
    var host_group = req.body['host_group'];
    var invited_users = req.body['invited_users'];
    var invited_groups = req.body['invited_groups'];
    var can_others_invite = req.body['can_others_invite'];

    if (!school_identifier) {
      res.status(REQUESTBAD).send("invalid parameters: no school identifier");
      return;
    }

    if (!title) {
      res.status(REQUESTBAD).send("invalid parameters: no title");
      return;
    }

    if (!start_time) {
      res.status(REQUESTBAD).send("invalid parameters: no start time");
      return;
    }

    if (!end_time) {
      res.status(REQUESTBAD).send("invalid parameters: no end time");
      return;
    }

    if (!location_name) {
      res.status(REQUESTBAD).send("invalid parameters: no location name");
      return;
    }

    if (!location_address) {
      res.status(REQUESTBAD).send("invalid parameters: no location address");
      return;
    }

    if (!location_lat) {
      res.status(REQUESTBAD).send("invalid parameters: no location lat");
      return;
    }

    if (!location_long) {
      res.status(REQUESTBAD).send("invalid parameters: no location long");
      return;
    }

    if (activity_public == null) {
      res.status(REQUESTBAD).send("invalid parameters: no activity public");
      return;
    }

    if (!interests) {
      res.status(REQUESTBAD).send("invalid parameters: no interests");
      return;
    }

    if (!host) {
      res.status(REQUESTBAD).send("invalid parameters: no host");
      return;
    }

    if (can_others_invite == null) {
      can_others_invite = true;
    }

    if (!details) {
      details = "";
    }

    if (!host_group) {
      host_group = "";
    }

    if (!invited_users) {
      invited_users = [];
    }

    if (!invited_groups) {
      invited_groups = [];
    }

    if (title.length > 80) {
      res.status(REQUESTBAD).send("invalid parameters: title too long");
      return;
    }

    if (details.length > 1000) {
      res.status(REQUESTBAD).send("invalid parameters: details too long");
      return;
    }

    var reply = {};
    reply[host] = "going";

    var activity = {
      title: title,
      start_time: start_time * 1.0,
      end_time: end_time * 1.0,
      location: {
        name: location_name,
        address: location_address,
        lat: location_lat * 1.0,
        long: location_long * 1.0
      },
      public: activity_public == "true",
      can_others_invite: can_others_invite,
      interests: interests,
      host: host,
      details: details,
      host_group: host_group,
      invited_users: invited_users,
      invited_groups: invited_groups,
      replies: reply
    };

    var newActivityRef = databaseref.child('schools/' + school_identifier + '/activities').push(activity);
    var auid = newActivityRef.key;

    newActivityRef.child('activity_id').set(auid);

    databaseref.child('schools/' + school_identifier + '/users/' + host + '/activities').transaction(function(snapshot){
        if(snapshot){
            snapshot = snapshot.concat([auid]);
        }else{
            snapshot = [auid];
        }

        return snapshot;
    });

    if (host_group != "") {
      databaseref.child('schools/' + school_identifier + '/groups/' + host_group + '/activities').transaction(function(snapshot){
          if(snapshot){
              snapshot = snapshot.concat([auid]);
          }else{
              snapshot = [auid];
          }

          return snapshot;
      });
    }

    console.log('invited_users: ' + invited_users);
    console.log('invited_groups: ' + invited_groups);

    invited_users.forEach( function(uid) {
      inviteUser(uid, school_identifier, auid);
    });

    invited_groups.forEach( function(guid) {
      inviteUser(guid, school_identifier, auid);
    });

    res.status(REQUESTSUCCESSFUL).send('activity posted');
});

app.post('/api/interested', function(req, res){
    var token = req.query.token;

    var auth = authenticateToken(token);
    if(!auth.admin && !auth.write){
         res.status(REQUESTFORBIDDEN).send("token could not be authenticated");
        return;
    }

    incrementTokenCalls(token);

    var uid = req.body['uid'];
    var school_identifier = req.body['school_identifier'];
    var auid = req.body['auid'];

    if(!uid){
        res.status(REQUESTBAD).send("invalid parameters: no uid");
        return;
    }

    if(!school_identifier){
        res.status(REQUESTBAD).send("invalid parameters: no school identifier");
        return;
    }

    if(!auid){
        res.status(REQUESTBAD).send("invalid parameters: no auid");
        return;
    }

    databaseref.child('schools/' + school_identifier + '/activities/' + auid + '/replies/' + uid).set("interested");

    res.status(REQUESTSUCCESSFUL).send('interested changed');

});

app.post('/api/going', function(req, res){
  var token = req.query.token;

  var auth = authenticateToken(token);
  if(!auth.admin && !auth.write){
       res.status(REQUESTFORBIDDEN).send("token could not be authenticated");
      return;
  }

  incrementTokenCalls(token);

  var uid = req.body['uid'];
  var school_identifier = req.body['school_identifier'];
  var auid = req.body['auid'];

  if(!uid){
      res.status(REQUESTBAD).send("invalid parameters: no uid");
      return;
  }

  if(!school_identifier){
      res.status(REQUESTBAD).send("invalid parameters: no school identifier");
      return;
  }

  if(!auid){
      res.status(REQUESTBAD).send("invalid parameters: no auid");
      return;
  }

  databaseref.child('schools/' + school_identifier + '/activities/' + auid + '/replies/' + uid).set("going");

  res.status(REQUESTSUCCESSFUL).send('interested changed');

});

app.post('/api/remove_reply', function(req, res){
  var token = req.query.token;

  var auth = authenticateToken(token);
  if(!auth.admin && !auth.write){
       res.status(REQUESTFORBIDDEN).send("token could not be authenticated");
      return;
  }

  incrementTokenCalls(token);

  var uid = req.body['uid'];
  var school_identifier = req.body['school_identifier'];
  var auid = req.body['auid'];

  if(!uid){
      res.status(REQUESTBAD).send("invalid parameters: no uid");
      return;
  }

  if(!school_identifier){
      res.status(REQUESTBAD).send("invalid parameters: no school identifier");
      return;
  }

  if(!auid){
      res.status(REQUESTBAD).send("invalid parameters: no auid");
      return;
  }

  databaseref.child('schools/' + school_identifier + '/activities/' + auid + '/replies/' + uid).remove();

  res.status(REQUESTSUCCESSFUL).send('interested changed');

});

app.get('/api/get_activity', function(req, res){
    var token = req.query.token;

    var auth = authenticateToken(token);
    if(!auth.admin && !auth.read){
         res.status(REQUESTFORBIDDEN).send("token could not be authenticated");
        return;
    }

    incrementTokenCalls(token);

    var school_identifier = req.query.school_identifier;
    var auid = req.query.auid;

    if(!auid){
        res.status(REQUESTBAD).send("invalid parameters: no auid");
        return;
    }

    if(!school_identifier){
        res.status(REQUESTBAD).send("invalid parameters: no school identifier");
        return;
    }

    databaseref.child('schools/' + school_identifier + '/activities/' + auid).once('value').then(function(snapshot){
            if(snapshot.val())
                res.status(REQUESTSUCCESSFUL).send(snapshot.val());
            else
                res.status(REQUESTSUCCESSFUL).send({});
        })
        .catch(function(error){
            res.status(REQUESTBAD).send(error);
            console.log(error);
    });

});

app.get('/api/get_activities', function(req, res){
    var token = req.query.token;

    var auth = authenticateToken(token);
    if(!auth.admin && !auth.read){
         res.status(REQUESTFORBIDDEN).send("token could not be authenticated");
        return;
    }

    incrementTokenCalls(token);

    var school_identifier = req.query.school_identifier;

    if(!school_identifier){
        res.status(REQUESTBAD).send("invalid parameters: no school identifier");
        return;
    }

    var timequery;
    var filter = req.query.filter;
    if(!isNaN(filter)){
        var now = new Date().getTime() / 1000;
        timequery = now - (filter * SECONDSINHOUR);
    }else{
        var now = new Date().getTime() / 1000;
        var day = 24 * SECONDSINHOUR;
        timequery = now - day;
    }

    incrementTokenCalls(token);

    console.log('timequery: ' + timequery);

    databaseref.child('schools/' + school_identifier + '/activities/').orderByChild('start_time').startAt(timequery)
        .once('value').then(function(snapshot){
            if(snapshot.val()) {

                var activities = [];
                Object.keys(snapshot.val()).forEach( function(key) {
                  activities.push(snapshot.val()[key]);
                });

                sortAndSendActivities(activities, res);
              }
            else {
                res.status(REQUESTSUCCESSFUL).send({});
              }
        })
        .catch(function(error){
            res.status(REQUESTBAD).send(error);
            console.log(error);
    });

});

function sortAndSendActivities(activities, res) {
  console.log('activities: ' + activities);

  activities.sort(compareActivities);

  res.status(REQUESTSUCCESSFUL).send(activities);
}

function compareActivities(a1, a2) {

  // Score = num seconds to event - (people going * 1500  + people interested * 1000)

  var a1_num_going = 0;
  var a1_num_interested = 0;

  Object.keys(a1['replies']).forEach( function(key) {
    if (a1['replies'][key] == "going") {
      a1_num_going++;
    } else { a1_num_interested++;
    }
  });

  var a2_num_going = 0;
  var a2_num_interested = 0;

  Object.keys(a2['replies']).forEach( function(key) {
    if (a2['replies'][key] == "going") {
      a2_num_going++;
    } else {
      a2_num_interested++;
    }
  });

  var now = new Date().getTime() / 1000;

  var score1 = (a1['start_time'] - now) - (a1_num_going * 1500.0 + a1_num_interested * 1000.0);
  var score2 = (a2['start_time'] - now) - (a2_num_going * 1500.0 + a2_num_interested * 1000.0);

  return score1 - score2;
}

function sendActivities(act, list, ref, res){
    var key = Object.keys(act)[0];
    if(!key){
        res.status(REQUESTBAD).send('could not retrieve data');
        return;
    }

    delete act[key];

    ref.child('activities').child(key).once('value').then(function(snapshot){
        list.push(snapshot.val());

        if(Object.keys(act).length == 0){
             res.status(REQUESTSUCCESSFUL).send(list);
        }else{
            sendActivities(act, list, ref, res);
        }
     }).catch(function(error){
        console.log(error)
     })
}


//***************INVITE HANDLERS*************//

function inviteUser(uid, school_identifier, auid) {
  console.log('Invite user: ' + uid);
}

function inviteGroup(guid, school_identifier, auid) {
  console.log('Invite group: ' + guid);
}

//.../api/min_version?platform=android
//0001 - requires read rights
app.get('/api/min_version', function(req, res){
    var token = req.query.token;

    var auth = authenticateToken(token);
    if(!auth.read && !auth.admin){
        res.status(REQUESTFORBIDDEN).send("token could not be authenticated");
        return;
    }

    var platform = req.query.platform;

    if(platform == undefined){
        res.status(REQUESTBAD).send("invalid parameters")
        return;
    }

    incrementTokenCalls(token);

    switch(platform.toLowerCase()){
        case 'android': res.status(REQUESTSUCCESSFUL).send({'min_version': minversion.android});
            break;
        case 'ios': res.status(REQUESTSUCCESSFUL).send({'min_version': minversion.ios});
            break;
        default: res.status(REQUESTBAD).send("invalid parameters");
    }

});

//get activities posted
//0001 - requires read rights
app.get('/api/activities', function(req, res){
    var token = req.query.token;

    var auth = authenticateToken(token);
    if(!auth.read && !auth.admin){
         res.status(REQUESTFORBIDDEN).send("token could not be authenticated");
        return;
    }

    var school = req.query.domain;
    if(!school){
        res.status(REQUESTBAD).send("invalid parameters: no domain");
        return;
    }

    if(!domainAllowed(school)){
        res.status(REQUESTBAD).send("domain '" + school + "' is not allowed");
        return;
    }

    var timequery;
    var filter = req.query.filter;
    if(!isNaN(filter)){
        var now = new Date().getTime() / 1000;
        timequery = now - (filter * SECONDSINHOUR);
    }else{
        var now = new Date().getTime() / 1000;
        var day = 24 * SECONDSINHOUR;
        timequery = now - day;
    }

    incrementTokenCalls(token);

    var act = databaseref.child(school);
    if(school == 'duke-*-edu') act = databaseref;

    act.child('activities').orderByChild('activityTime').startAt(timequery)
        .once('value').then(function(snapshot){
            var a = snapshot.val();
            if(a)
                sendActivities(a, [], act, res);
            else
                res.status(REQUESTSUCCESSFUL).send({});
        })
        .catch(function(error){
            res.status(REQUESTBAD).send(error);
            console.log(error);
    });

});


app.get('/api/attendees', function(req, res){
    var token = req.query.token;

    var auth = authenticateToken(token);
    if(!auth.read && !auth.admin){
         res.status(REQUESTFORBIDDEN).send("token could not be authenticated");
        return;
    }

    var school = req.query.domain;
    if(!school){
        res.status(REQUESTBAD).send("invalid parameters: no domain");
        return;
    }

    if(!domainAllowed(school)){
        res.status(REQUESTBAD).send("domain '" + school + "' is not allowed");
        return;
    }

    var event = req.query.event;
    if(!event){
        res.status(REQUESTBAD).send("invalid parameters: no event key");
        return;
    }

    var attendees = [];
    databaseref.child(school).child('attendees').child(event).once('value')
        .then(function(snapshot){
            var att = snapshot.val();
            sendUsersAttending(att, [], school, res);


        }).catch(error => console.log(error));

});

//get user information from a uid.  ex: .../api/user_info?uid=udfan48thbg84t48
//0001 - requires read rights
app.get('/api/user_info', function(req, res){
    var token = req.query.token;

    var auth = authenticateToken(token);
    if(!auth.read && !auth.admin){
         res.status(REQUESTFORBIDDEN).send("token could not be authenticated");
        return;
    }

    var uid = req.query.uid;
    if(!uid){
        res.status(REQUESTBAD).send("invalid parameters: no uid");
        return;
    }

    var school = req.query.domain;
    if(!school){
        res.status(REQUESTBAD).send("invalid parameters: no domain");
        return;
    }

    if(!domainAllowed(school)){
        res.status(REQUESTBAD).send("domain '" + school + "' is not allowed");
        return;
    }

    var user = {};
    incrementTokenCalls(token);

    databaseref.child(school).child('users/' + uid).once('value').then(function(snapshot){
        user = snapshot.val();
        if(!user || user == {}) res.status(REQUESTNOTFOUND).send("user not found");
        else res.status(REQUESTSUCCESSFUL).send(user);
    }).catch(function(error){
        return;
    })

});

app.get('/api/is_attending', function(req, res){
    var token = req.query.token;

    var auth = authenticateToken(token);
    if(!auth.admin && !auth.read){
         res.status(REQUESTFORBIDDEN).send("token could not be authenticated");
        return;
    }

    var uid = req.query.uid;
    if(!uid){
        res.status(REQUESTBAD).send("invalid parameters: no uid");
        return;
    }

    var school = req.query.domain;
    if(!school){
        res.status(REQUESTBAD).send("invalid parameters: no domain");
        return;
    }

    var event = req.query.event;
    if(!event){
        res.status(REQUESTBAD).send("invalid parameters: no event key");
        return;
    }

     databaseref.child(school).child('attendees').child(event).once('value')
        .then(function(snapshot){
            var att = snapshot.val();
            var ret = {};
            ret.event = event;

            for(user in att){
                if(uid == user){
                    ret.attending = true;
                    res.status(REQUESTSUCCESSFUL).send(ret);
                    return;
                }
            }

            ret.attending = false;
            res.status(REQUESTSUCCESSFUL).send(ret);

        }).catch(error => res.status(REQUESTBAD).send('error retrieving data'));

});

app.post('/api/report_post', function(req, res){
    var token = req.query.token;

    var auth = authenticateToken(token);
    if(!auth.admin && !auth.write){
         res.status(REQUESTFORBIDDEN).send("token could not be authenticated");
        return;
    }

      var school = req.query.domain;
    if(!school){
        res.status(REQUESTBAD).send("invalid parameters: no domain");
        return;
    }


    var event = req.query.event;
    if(!event){
        res.status(REQUESTBAD).send("invalid parameters: no event key");
        return;
    }

    var uid = req.query.uid;

    findPostToReport(uid, event, school, res);

});

app.post('/api/request_verification', function(req, res){
    var token = req.query.token;

    var auth = authenticateToken(token);
    if(!auth.admin && !auth.write){
         res.status(REQUESTFORBIDDEN).send("token could not be authenticated");
        return;
    }

    var school = req.query.domain;
    if(!school){
        res.status(REQUESTBAD).send("invalid parameters: no domain");
        return;
    }


    var email = req.query.email;
    if(!email){
        res.status(REQUESTBAD).send("invalid parameters: no email");
        return;
    }

    var uid = req.query.uid;
    if(!uid){
        res.status(REQUESTBAD).send("invalid parameters: no uid");
        return;
    }

    sendVerificationEmail(email, uid, school, res);
});

app.get('/api/verify', function(req, res){
    var token = req.query.token;

    var auth = authenticateToken(token);
    if(!auth.verify){
         res.status(REQUESTFORBIDDEN).send("token could not be authenticated");
        return;
    }

    var school = req.query.domain;
    if(!school){
        res.status(REQUESTBAD).send("invalid parameters: no domain");
        return;
    }

    var uid = req.query.uid;
    if(!uid){
        res.status(REQUESTBAD).send("invalid parameters: no uid");
        return;
    }

    var hash = req.query.hash;
    if(!hash){
        res.status(REQUESTBAD).send("invalid parameters: no hash");
        return;
    }
   verifyUser(school, uid, hash, res);

});

app.get('/welcome', function(req, res){
    fs.readFile('emailverification.html', function (err, data){
        res.writeHead(200, {'Content-Type': 'text/html','Content-Length':data.length});
        res.write(data);
        res.end();
    });
});

//***************HELPER FUNCTIONS*************//

function domainAllowed(domain){
    for(key in domains){
        if(domains[key]['domain'] == domain) return true;
    }

    return false;
}

function verifyUser(school, uid, hash, res){
    databaseref.child(school).child('users').child(uid).once('value').then(function(snapshot){
        var user = snapshot.val();
        if(user){
            var userhash = user.hash;
            if(userhash || user.verified == true){
                if(userhash == hash || user.verified == true){
                    databaseref.child(school).child('users').child(uid).child('verified').set(true);
                    databaseref.child(school).child('users').child(uid).child('hash').remove();
                    res.redirect('/welcome');
                }else{
                    res.status(REQUESTFORBIDDEN).send('could not authenticate request');
                }
            }else{
                res.status(REQUESTFORBIDDEN).send('could not authenticate request');
            }
        }else{
            res.status(REQUESTNOTFOUND).send('user not found');
        }
    });
}

function findPostToReport(uid, key, domain, res){
    var flagged = databaseref.child(domain).child('flagged');

    flagged.child(key).once('value')
        .then(function(snapshot){
            var post = snapshot.val();
            if(post){
                if(!post.reporters[uid]){
                    if(uid)
                        post.reporters[uid] = new Date().getTime() / 1000;
                    flagged.child(key).set(post);
                    incrementFlags(key, domain, res);

                }else{
                    console.log('already flagged');
                    res.status(REQUESTDUPLICATE).send('already flagged');
                }
            }else{
                var fl = {};
                fl[key] = {
                    key: key,
                    flags: 1,
                    reporters: {
                        [uid]: (new Date().getTime() / 1000)
                    }
                }

                flagged.update(fl);
                res.status(REQUESTSUCCESSFUL).send("post reported");
            }
    });
}

function incrementFlags(key, domain, res){
    databaseref.child(domain).child('flagged').child(key).child('flags').transaction(function(snapshot){
        if(snapshot){
            snapshot = snapshot + 1;
            if(snapshot >= MAXFLAGS){
                notifyAdminOfFlag(key, snapshot, domain);
            }
        }else{
            snapshot = 1;
        }

        res.status(REQUESTSUCCESSFUL).send("post reported");
        return snapshot;
    });
}

function notifyAdminOfFlag(key, flags, domain){
    databaseref.child(domain).child('activities').child(key).once('value')
        .then(function(snapshot){
            var post = snapshot.val();
            var location = post.location;
            var description = post.description;
            var uid = post.uid;

            databaseref.child(domain).child('users').child(uid).once('value')
                .then(function(snapshot){
                    var user = snapshot.val();
                    var name =  user.name;

                    sendFlagEmail(name, key, flags, location, description, domain);
                 });
         });
}

function sendFlagEmail(name, key, flag, location, description, domain){
    var school = domain.slice(0, domain.length - 6); //removes -*-edu
    var mailOptions = {
        from: '"Walla API" <wallaapitesting@aol.com>', // sender address
        to: FLAGREPORTEMAIL, // list of receivers
        subject: 'Flagged Post', // Subject line
        text: 'Hello', // plaintext body
        html: '<b style="font-size:18px">' + 'A post by ' + name + ' was flagged by ' + flag + ' people' + '</b><br><br>'
                + '<span style="font-size:15px">Post Key: ' + key + '</span><br><br><br>'
                + '<span style="font-size:15px">Creator: ' + name + '</span><br><br><br>'
                + '<span style="font-size:15px">Description: ' + description + '</span><br><br><br>'
                + '<span style="font-size:15px">School: ' + school + '</span><br><br><br>'
                + '<span style="font-size:15px">Location: ' + location + '</span><br>'
    };

    transporter.sendMail(mailOptions, function(error, info){
        if(error){
            return console.log(error);
        }
        console.log('Message sent: ' + info.response);
    });
}

function getAuth(token){
    var auth = 0;
    if(readpriv.indexOf(token) >= 0){
        auth = auth | LEVEL1;
    }

    if(writepriv.indexOf(token) >= 0){
        auth = auth | LEVEL2;
    }

    if(deletepriv.indexOf(token) >= 0){
        auth = auth | LEVEL3;
    }

    if(adminpriv.indexOf(token) >= 0){
        auth = auth | LEVEL4;
    }

     if(verifypriv.indexOf(token) >= 0){
        auth = auth | LEVEL5;
    }

    return auth;
}

function getUserInfo(uid, domain){
    var user = {};

    databaseref.child(domain).child('users/' + uid).once('value').then(function(snapshot){
        user = snapshot.val();
        return user;
    }).catch(function(error){
        return null;
    })
}

function incrementTokenCalls(token){
  console.log('incrementTokenCalls: ' + token);
    databaseref.child('app_settings/api_keys/' + token).child('calls').transaction(function(snapshot) {

            snapshot = snapshot + 1;

            return snapshot;
    });
}

function sendTokenViaEmail(token, email, name, auth){
    var permissions = '';
    if(auth.indexOf('read') >= 0) permissions += '<li>' + ' <p style="font-family: sans-serif; font-size: 14px; font-weight: normal; margin: 0; Margin-bottom: 5px;">Read</p>' + '</li>';
    if(auth.indexOf('write') >= 0) permissions += '<li>' + ' <p style="font-family: sans-serif; font-size: 14px; font-weight: normal; margin: 0; Margin-bottom: 5px;">Write</p>' + '</li>';
    if(auth.indexOf('delete') >= 0) permissions += '<li>' + ' <p style="font-family: sans-serif; font-size: 14px; font-weight: normal; margin: 0; Margin-bottom: 5px;">Delete</p>' + '</li>';
    if(auth.indexOf('admin') >= 0) permissions += '<li>' + ' <p style="font-family: sans-serif; font-size: 14px; font-weight: normal; margin: 0; Margin-bottom: 5px;">Admin</p>' + '</li>';
    if(auth.indexOf('verify') >= 0) permissions += '<li>' + ' <p style="font-family: sans-serif; font-size: 14px; font-weight: normal; margin: 0; Margin-bottom: 5px;">Verify</p>' + '</li>';

    if(permissions == ''){
        permissions = 'none';
    }

    var mailOptions = {
        from: '"Walla API" <wallaapitesting@aol.com>', // sender address
        to: email, // list of receivers
        subject: 'Walla API', // Subject line
        html: apikeytemplate.replace(/permissions-go-here/, permissions).replace(/name-goes-here/, name).replace(/token-goes-here/, token)
    };

    transporter.sendMail(mailOptions, function(error, info){
        if(error){
            return console.log(error);
        }
        console.log('Message sent: ' + info.response);
    });
}

function sendVerificationEmail(email, uid, domain, res){
    if(!emailverificationtemplate){
        setTimeout(() => sendVerificationEmail(email, uid), 3000);
    }else{
        var hash = TokenGenerator.generate();
        databaseref.child(domain).child('users').child(uid).once('value').then(function(snapshot){
            var user = snapshot.val();
            if(user){
                databaseref.child(domain).child('users').child(uid).child('hash').set(hash);

                var verifyurl = WEBSITE + '/api/verify?domain=' + domain + '&uid=' + uid + '&token=' + '969d-dFN2m-2mN' + "&hash=" + hash;
                var mailOptions = {
                    from: '"Walla" <wallaapitesting@aol.com>', // sender address
                    to: email, // list of receivers
                    subject: 'Verify email', // Subject line
                    html: emailverificationtemplate.replace(/verify-url-here/, verifyurl)
                };

            transporter.sendMail(mailOptions, function(error, info){
                if(error){
                    return console.log(error);
                    res.status(REQUESTBAD).send(error);
                }
                console.log('Message sent: ' + info.response);
                res.status(REQUESTSUCCESSFUL).send('email sent');
            });

            }else{
                res.status(REQUESTNOTFOUND).send('user not found');
            }
        });

    }
}

function sendUsersAttending(att, attendees, school, res){
    var key = Object.keys(att)[0];
    if(!key){
        res.status(REQUESTBAD).send('could not retrieve data');
        return;
    }

    delete att[key];

    databaseref.child(school).child('users/' + key).once('value').then(function(snapshot){
        attendees.push(snapshot.val());

        if(Object.keys(att).length == 0){
             res.status(REQUESTSUCCESSFUL).send(attendees);
        }else{
            sendUsersAttending(att, attendees, school, res);
        }
     }).catch(function(error){
        console.log(error)
     })
}
