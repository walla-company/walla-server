var express = require('express'); //npm install express --save
var jws = require('express-jwt-session'); //npm install express-jwt-session --save
var firebase = require('firebase'); //npm install firebase --save
var admin = require('firebase-admin'); //npm install firebase-admin --save
var TokenGenerator = require( 'token-generator' )({
        salt: 'the key to success is to be successful, but only sometimes',
        timestampMap: 'N72md4XaF8', // 10 chars array for obfuscation proposes
});
var nodemailer = require('nodemailer'); //npm install nodemailer --save
var fs = require('fs');
var bodyParser = require('body-parser');
var randomcolor = require('randomcolor');
//var adminServer = require('./admin-server'); //Admin web manager server
var request = require('request');
var _ = require('underscore'); //npm install underscore --save
var moment = require('moment'); //npm install moment --save
var Promise = require('bluebird'); //npm install bluebird --save

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

const NOTIFICATIONFRIENDREQUEST = "friend_request";
const NOTIFICATIONUSERINVITED = "user_invited";
const NOTIFICATIONGROUPINVITED = "group_invited";
const NOTIFICATIONDISCUSSIONPOSTED = "discussion_posted"


//***************INITIALIZATION*************//

var app = express();

app.set('port', (process.env.PORT || 8080));

app.use(express.static(__dirname + '/public'));

app.use(bodyParser.json());
//CORS
app.use(function(req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', '*');
    res.header('Access-Control-Allow-Headers', 'Content-Type');

    next();
});
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
            user: 'wallanoreply@aol.com', // Your email id
            pass: 'graysonisthegoat' // Your password
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

var groups = {};

var emailverificationtemplate;
var apikeytemplate;

//***************AUTHENTICATION*************//

// Initialize Firebase

var useLocal = true;

if (!useLocal) {
    console.log("RUNNING IN PRODUCTION ENV");
}

// var config = ;
var config = useLocal ? {
    apiKey: "AIzaSyBuYG5jxqySNrrLdJSU0hAX2S3GAs-zrUo",
    authDomain: "walla-server-test.firebaseapp.com",
    databaseURL: "https://walla-server-test.firebaseio.com",
    storageBucket: "walla-server-test.appspot.com",
    messagingSenderId: "40193027451"
} : {
    apiKey: "AIzaSyDly8Ewgiyhb14hHbHiSnLcu6zUOvEbuF0",
    authDomain: "walla-launch.firebaseapp.com",
    databaseURL: "https://walla-launch.firebaseio.com",
    storageBucket: "walla-launch.appspot.com",
    messagingSenderId: "261500518113"
};


// var defaultApp = admin.initializeApp();
var defaultApp = admin.initializeApp(useLocal ? {
                                                    credential: admin.credential.cert("admin/walla-server-test-key.json"),
                                                    databaseURL: "https://walla-server-test.firebaseio.com"
                                                } : {
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
ad.on('value', snapshot => {
    domains = snapshot.val();

    for (let sid in domains) {
        var updateRootUsers = function(type) {
            return function(snapshot) {
                // console.log(type);
                var user = snapshot.val();
                if (!user.user_id) return;
                var obj = {};
                obj[user.user_id] = {
                    user_id: user.user_id,
                    school_identifier: sid,
                    name: user.first_name + ' ' + user.last_name
                };
                // console.log(1, obj);
                databaseref.child('users').update(obj);
            }
        };
        if (domains.hasOwnProperty(sid)) {
            var usersRef = databaseref.child('schools').child(sid).child('users');
            usersRef.on('child_added', updateRootUsers('added'));
            usersRef.on('child_changed', updateRootUsers('changed'));
            usersRef.on('child_removed', snapshot => databaseref.child('users').child(snapshot.val().user_id).remove());
        }
    }
});

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

app.post('/api/add_group', function(req, res){
    var token = req.query.token;

    var auth = authenticateToken(token);
    if(!auth.admin){
         res.status(REQUESTFORBIDDEN).send("token could not be authenticated");
        return;
    }

    var name = req.body['name'];
    var short_name = req.body['short_name'];
    var school_identifier = req.body['school_identifier'];
    var details = req.body['details'];

    if (!name) {
      res.status(REQUESTBAD).send("invalid parameters: no name");
      return;
    }

    if (!short_name) {
      res.status(REQUESTBAD).send("invalid parameters: no short name");
      return;
    }

    if (!school_identifier) {
      res.status(REQUESTBAD).send("invalid parameters: no school identifier");
      return;
    }

    if (!details) {
      res.status(REQUESTBAD).send("invalid parameters: no details");
      return;
    }

    var group = {
      name: name,
      short_name: short_name,
      color: randomcolor(),
      details: details
    };

    var newGroupRef = databaseref.child('schools/' + school_identifier + '/groups').push(group);
    var guid = newGroupRef.key;

    newGroupRef.child('group_id').set(guid);
    databaseref.child('schools/' + school_identifier + '/search_groups_array/' + guid).set(name + " " + short_name);

    res.status(REQUESTSUCCESSFUL).send('group ' + name + 'added');
});

app.get('/api/get_inactive_users', function(req, res){
    var token = req.query.token;

    var auth = authenticateToken(token);
    if(!auth.admin) {
         res.status(REQUESTFORBIDDEN).send("token could not be authenticated");
        return;
    }

    incrementTokenCalls(token);

    var school_identifier = req.query.school_identifier;

    if(!school_identifier){
        res.status(REQUESTBAD).send("invalid parameters: no school identifier");
        return;
    }
    
    var timequery = new Date().getTime() / 1000 - 2592000;

    incrementTokenCalls(token);

    console.log('timequery: ' + timequery);

    databaseref.child('schools/' + school_identifier + '/users/').once('value').then(function(snapshot){
            if(snapshot.val()) {
                
              var inactive_users = [];
              
              Object.keys(snapshot.val()).forEach( function(key) {
                var user = snapshot.val()[key];
                
                if (user.hasOwnProperty("last_logon")) {
                  if (user["last_logon"] <= timequery) {
                    var user_info = {
                    uid: user["user_id"],
                    email: user["email"],
                    first_name: user["first_name"],
                    last_name: user["last_name"]
                  };
                  
                  inactive_users.push(user_info);
                  }
                }
                else {
                  var user_info = {
                    uid: user["user_id"],
                    email: user["email"],
                    first_name: user["first_name"],
                    last_name: user["last_name"]
                  };
                  
                  inactive_users.push(user_info);
                }
                
              });
              
              res.status(REQUESTSUCCESSFUL).send(inactive_users);
              
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
    var interests = req.body['interests'];
    var host = req.body['host'];
    var host_group = req.body['host_group'];
    var host_group_name = req.body['host_group_name'];
    var host_group_short_name = req.body['host_group_short_name'];
  
    /* Not required in request */
    var activity_public = true;//req.body['activity_public'];
    var details = "";//req.body['details'];
    var invited_users = [];//req.body['invited_users'];
    var invited_groups = [];//req.body['invited_groups'];
    var can_others_invite = true;//req.body['can_others_invite'];

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
      //res.status(REQUESTBAD).send("invalid parameters: no location address");
      //return;
      location_address = "";
    }

    if (!location_lat) {
      //res.status(REQUESTBAD).send("invalid parameters: no location lat");
      //return;
      location_lat = 0;
    }

    if (!location_long) {
      //res.status(REQUESTBAD).send("invalid parameters: no location long");
      //return;
      location_long = 0;
    }

    if (activity_public == null) {
      //res.status(REQUESTBAD).send("invalid parameters: no activity public");
      //return;
      activity_public = true;
    }
    
    if (!interests) {
      //res.status(REQUESTBAD).send("invalid parameters: no interests");
      //return;
      interests = [];
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

    if (!host_group_name) {
      host_group_name = "";
    }

    if (!host_group_short_name) {
      host_group_short_name = "";
    }

    if (!invited_users) {
      invited_users = [];
    }

    if (!invited_groups) {
      invited_groups = [];
    }

    if (title.length > 500) {
      res.status(REQUESTBAD).send("invalid parameters: title too long");
      return;
    }

    if (details.length > 1000) {
      res.status(REQUESTBAD).send("invalid parameters: details too long");
      return;
    }

    var current_time = new Date().getTime() / 1000;
    
    var invited_users_dic = {};
    var invited_groups_dic = {};
    /*
    invited_users.forEach( function(uid) {
      invited_users_dic[uid] = current_time;
    });

    invited_groups.forEach( function(guid) {
      invited_groups_dic[guid] = current_time;
    });
    */
    var reply = {};
    reply[host] = "going";

    var activity = {
      title: title,
      start_time: start_time * 1.0,
      end_time: end_time * 1.0,
      timePosted: current_time,
      location: {
        name: location_name,
        address: location_address,
        lat: location_lat * 1.0,
        long: location_long * 1.0
      },
      public: activity_public,
      can_others_invite: can_others_invite,
      interests: interests,
      host: host,
      details: details,
      host_group: host_group,
      host_group_name: host_group_name,
      host_group_short_name: host_group_short_name,
      invited_users: invited_users_dic,
      invited_groups: invited_groups_dic,
      replies: reply,
      deleted: false
    };
  
    var newActivityRef = databaseref.child('schools/' + school_identifier + '/activities').push(activity);
    var auid = newActivityRef.key;

    newActivityRef.child('activity_id').set(auid);
    
    if (host_group != "") {
      databaseref.child('schools/' + school_identifier + '/groups/' + host_group + '/activities/' + auid).set(current_time);
    }
    
    databaseref.child('schools/' + school_identifier + '/users/' + host + '/activities/' + auid).set(current_time);

    databaseref.child('schools/' + school_identifier + '/users/' + host + '/calendar/' + auid).set(current_time);
    
    /*
    console.log('invited_users: ' + invited_users);
    console.log('invited_groups: ' + invited_groups);

    invited_users.forEach( function(uid) {
      inviteUser(host, uid, school_identifier, auid, title);
    });

    invited_groups.forEach( function(guid) {
      inviteGroup(guid, school_identifier, auid, title);
    });
    */
    
    res.status(REQUESTSUCCESSFUL).send('activity posted: ' + activity['location']['lat']);
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

    var current_time = new Date().getTime() / 1000;
    databaseref.child('schools/' + school_identifier + '/users/' + uid + '/calendar/' + auid).set(current_time);

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

  var current_time = new Date().getTime() / 1000;
  databaseref.child('schools/' + school_identifier + '/users/' + uid + '/calendar/' + auid).set(current_time);

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

  databaseref.child('schools/' + school_identifier + '/users/' + uid + '/calendar/' + auid).remove();

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
    var uid = req.query.uid;

    if(!auid){
        res.status(REQUESTBAD).send("invalid parameters: no auid");
        return;
    }

    if(!school_identifier){
        res.status(REQUESTBAD).send("invalid parameters: no school identifier");
        return;
    }
    
    if(!uid){
        //res.status(REQUESTBAD).send("invalid parameters: no uid");
        databaseref.child('schools/' + school_identifier + '/activities/' + auid).once('value').then(function(snapshot){
            if(snapshot.val()) {
                res.status(REQUESTSUCCESSFUL).send(snapshot.val());
            }
            else {
                res.status(REQUESTSUCCESSFUL).send({});
            }
        })
        .catch(function(error){
            res.status(REQUESTBAD).send(error);
            console.log(error);
    });
        return;
    }
    
    databaseref.child('schools/' + school_identifier + '/activities/' + auid).once('value').then(function(snapshot){
            if(snapshot.val()) {
                
                userCanSeeEvent(uid, auid, school_identifier, res, snapshot.val());
                
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

app.post('/api/delete_activity', function(req, res){
    var token = req.query.token;

    var auth = authenticateToken(token);
    if(!auth.admin && !auth.read){
         res.status(REQUESTFORBIDDEN).send("token could not be authenticated");
        return;
    }

    incrementTokenCalls(token);

    var school_identifier = req.body.school_identifier;
    var auid = req.body.auid;
    var uid = req.body.uid;

    if(!auid){
        res.status(REQUESTBAD).send("invalid parameters: no auid");
        return;
    }

    if(!school_identifier){
        res.status(REQUESTBAD).send("invalid parameters: no school identifier");
        return;
    }
    
    if(!uid){
      res.status(REQUESTBAD).send("invalid parameters: no uid");
      return;
    }
  
    databaseref.child('schools/' + school_identifier + '/activities/' + auid).child('deleted').set(true);
  
    databaseref.child('schools/' + school_identifier + '/activities/' + auid).once('value').then(function(snapshot){
            if(snapshot.val()) {
                
              var host_id = snapshot.val()["host"];
              
              if (host_id == uid) {
                var host_id = snapshot.val()["host"];
              }
              
              res.status(REQUESTSUCCESSFUL).send({});
                
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

app.get('/api/get_activities', function(req, res){
    var token = req.query.token;

    var auth = authenticateToken(token);
    if(!auth.admin && !auth.read){
         res.status(REQUESTFORBIDDEN).send("token could not be authenticated");
        return;
    }

    incrementTokenCalls(token);

    var school_identifier = req.query.school_identifier;
    var uid = req.query.uid;

    if(!school_identifier){
        res.status(REQUESTBAD).send("invalid parameters: no school identifier");
        return;
    }

    /*
    if(!uid){
        res.status(REQUESTBAD).send("invalid parameters: no uid");
        return;
    }
    */
  
    //var timequery = new Date().getTime() / 1000;
  
    var timequery = (moment().utcOffset("-04:00").startOf('day') * 1.0) / 1000;
  
    /*
    var filter = req.query.filter;
    if(!isNaN(filter)){
        var now = new Date().getTime() / 1000;
        timequery = now - (filter * SECONDSINHOUR);
    }else{
        var now = new Date().getTime() / 1000;
        var day = 24 * SECONDSINHOUR;
        timequery = now - day;
    }*/

    incrementTokenCalls(token);

    console.log('timequery: ' + timequery);

    databaseref.child('schools/' + school_identifier + '/activities/').orderByChild('start_time').startAt(timequery)
        .once('value').then(function(snapshot){
            if(snapshot.val()) {

                var activities = [];
                var keys = Object.keys(snapshot.val());
                var current_index = 0;
                
                if (!uid) {
        
                    Object.keys(snapshot.val()).forEach( function(key) {
                        var event = snapshot.val();
                      
                        var eventDeleted = false;
                        if(event.hasOwnProperty('deleted')){
                          eventDeleted = event['deleted'];
                        }
                      
                        if (event[key]["public"] && !eventDeleted) {
                            activities.push(snapshot.val()[key]);
                        }
                    });

                    sortAndSendActivities(activities, res);
                    
                }
                else {
                    userCanSeeFeedEvent(uid, school_identifier, res, activities, snapshot.val(), current_index, keys);
                }
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

app.post('/api/invite_user', function(req, res){
  var token = req.query.token;

  var auth = authenticateToken(token);
  if(!auth.admin && !auth.write){
       res.status(REQUESTFORBIDDEN).send("token could not be authenticated");
      return;
  }

  incrementTokenCalls(token);

  var sender = req.body['sender'];
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

  databaseref.child('schools/' + school_identifier + '/activities/' + auid).once('value').then(function(snapshot){

          console.log("Activity: " + snapshot.val());

          if (snapshot.val()) {

            inviteUser(sender, uid, school_identifier, auid, snapshot.val()["title"]);
          }
      })
      .catch(function(error){
          res.status(REQUESTBAD).send(error);
          console.log(error);
  });

  res.status(REQUESTSUCCESSFUL).send('user invited');

});

app.post('/api/invite_group', function(req, res){
  var token = req.query.token;

  var auth = authenticateToken(token);
  if(!auth.admin && !auth.write){
       res.status(REQUESTFORBIDDEN).send("token could not be authenticated");
      return;
  }

  incrementTokenCalls(token);

  var guid = req.body['guid'];
  var school_identifier = req.body['school_identifier'];
  var auid = req.body['auid'];

  if(!guid){
      res.status(REQUESTBAD).send("invalid parameters: no guid");
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

  databaseref.child('schools/' + school_identifier + '/activities/' + auid).once('value').then(function(snapshot){

          console.log("Activity: " + snapshot.val());

          if (snapshot.val()) {

            inviteGroup(guid, school_identifier, auid, snapshot.val()["title"]);
          }
      })
      .catch(function(error){
          res.status(REQUESTBAD).send(error);
          console.log(error);
  });

  res.status(REQUESTSUCCESSFUL).send('group invited');

});

function sortAndSendActivities(activities, res) {
  console.log('activities: ' + activities);

  activities.sort(compareActivities);

  res.status(REQUESTSUCCESSFUL).send(activities);
}

function compareActivities(a1, a2) {

  // Score = num seconds to event - (people going * 1500  + people interested * 1000)
  /*
  var a1_num_going = 0;
  var a1_num_interested = 0;

  if(a1 && a1['replies']){
      Object.keys(a1['replies']).forEach( function(key) {
        if (a1['replies'][key] == "going") {
          a1_num_going++;
        } else { a1_num_interested++;
        }
      });
  }else{
      return 0;
  }

  var a2_num_going = 0;
  var a2_num_interested = 0;

  if(a2 && a2['replies'])  {
      Object.keys(a2['replies']).forEach( function(key) {
        if (a2['replies'][key] == "going") {
          a2_num_going++;
        } else {
          a2_num_interested++;
        }
      });
  }else{
      return 0;
  }

  var now = new Date().getTime() / 1000;

  var score1 = (a1['start_time'] - now) - (a1_num_going * 1500.0 + a1_num_interested * 1000.0);
  var score2 = (a2['start_time'] - now) - (a2_num_going * 1500.0 + a2_num_interested * 1000.0);
  
  return score1 - score2;*/
  
  return a1['start_time'] - a2['start_time'];
}

function userCanSeeEvent(uid, auid, school_identifier, res, activity) {

                
        if (activity["public"]) {
                    
            console.log("Event public");
            res.status(REQUESTSUCCESSFUL).send(activity);
            
            return;
        }
        else if (activity["host"] == uid) {
                    
            console.log("Event private: user can see (host)");
            res.status(REQUESTSUCCESSFUL).send(activity);
            
            return;
        }
                
        for (var user_id in activity["invited_users"]) {
            if (user_id == uid) {
                
                console.log("Event private: user can see (invited user)");
                res.status(REQUESTSUCCESSFUL).send(activity);
                
                return;
            }
        }
    
        databaseref.child('schools/' + school_identifier + '/users/' + uid + '/groups').once('value').then(function(snapshot){
            if(snapshot.val()) {
                
                for (var group_id in activity["invited_groups"]) {
                    if (snapshot.val().hasOwnProperty(group_id)) {
                        
                        console.log("Event private: user can see (invited group)");
                        res.status(REQUESTSUCCESSFUL).send(activity);
                        
                        return;
                    }
                }
                
                console.log("Event private: user cannot see");
                res.status(REQUESTSUCCESSFUL).send({});
                
                return;
            }
        }).catch(function(error){
            res.status(REQUESTBAD).send(error);
            console.log(error);
            console.log("Event private: user cannot see");
            res.status(REQUESTSUCCESSFUL).send({});
            return;
    });
}

function userCanSeeFeedEvent(uid, school_identifier, res, activities, all_activities, current_index, keys) {

    var key = keys[current_index];
    
    if (!key || (current_index == all_activities.length)) {

        sortAndSendActivities(activities, res);
        
        return;
    }
    
    console.log("Key: " + key);
    
    var current_activity = all_activities[key];
    current_index = current_index + 1;
    
    var eventDeleted = false;
    if(current_activity.hasOwnProperty('deleted')){
      eventDeleted = current_activity['deleted'];
    }
  
    console.log("Event deleted: " + eventDeleted);
  
    if (current_activity["public"]) {
                    
      console.log("Event public");
      
      if (!eventDeleted) {
        activities.push(current_activity);
      }
      
      userCanSeeFeedEvent(uid, school_identifier, res, activities, all_activities, current_index, keys);
            
      return;
    }
    else if (current_activity["host"] == uid) {
                    
      console.log("Event private: user can see (host)");
      
      if (!eventDeleted) {
        activities.push(current_activity);
      }
      
      userCanSeeFeedEvent(uid, school_identifier, res, activities, all_activities, current_index, keys);
            
      return;
    }
                
    for (var user_id in current_activity["invited_users"]) {
      if (user_id == uid) {
                
        console.log("Event private: user can see (invited user)");
              
        if (!eventDeleted) {
          activities.push(current_activity);
        }
        
        userCanSeeFeedEvent(uid, school_identifier, res, activities, all_activities, current_index, keys);
                
        return;
      }
    }
    
        databaseref.child('schools/' + school_identifier + '/users/' + uid + '/groups').once('value').then(function(snapshot){
            if(snapshot.val()) {
                
                for (var group_id in current_activity["invited_groups"]) {
                    if (snapshot.val().hasOwnProperty(group_id)) {
                        
                        console.log("Event private: user can see (invited group)");
                        
                        if (!eventDeleted) {
                          activities.push(current_activity);
                        }
                      
                        userCanSeeFeedEvent(uid, school_identifier, res, activities, all_activities, current_index, keys);
                        
                        return;
                    }
                }
                
                console.log("Event private: user cannot see");
                userCanSeeFeedEvent(uid, school_identifier, res, activities, all_activities, current_index, keys);
            }
        }).catch(function(error){
            res.status(REQUESTBAD).send(error);
            console.log(error);
            console.log("Event private: user cannot see");
            userCanSeeFeedEvent(uid, school_identifier, res, activities, all_activities, current_index, keys);
    });
}



//***************INVITE HANDLERS*************//

function inviteUser(sender, uid, school_identifier, auid, activity_title) {
    console.log('Invite user: ' + uid);

    if (sender) {
        databaseref.child('schools/' + school_identifier + '/users/' + sender).once('value').then(function(snapshot){

        console.log("User: " + snapshot.val());

            if (snapshot.val()) {
                
                var current_time = new Date().getTime() / 1000;

                var notification = {
                  time_created: current_time*1.0,
                  type: NOTIFICATIONUSERINVITED,
                  sender: sender,
                  activity_id: auid,
                  text: snapshot.val()["first_name"] + " " + snapshot.val()["last_name"] + " invited you to " + activity_title,
                  read: false,
                  profile_image_url: snapshot.val()["profile_image_url"]
                };

                var notificationRef = databaseref.child('schools/' + school_identifier + '/notifications/' + uid).push(notification);
                databaseref.child('schools/' + school_identifier + '/notifications/' + uid + "/" + notificationRef.key + "/notification_id").set(notificationRef.key);

                databaseref.child('schools/' + school_identifier + '/activities/' + auid + '/invited_users/' + uid).set(current_time);
                
                sendNotificationToUser(snapshot.val()["first_name"] + " " + snapshot.val()["last_name"] + " invited you to " + activity_title, "Invited", uid, school_identifier);
              }
          })
          .catch(function(error){
              res.status(REQUESTBAD).send(error);
              console.log(error);
      });
    }
    else {

        var current_time = new Date().getTime() / 1000;

        var notification = {
                  time_created: current_time*1.0,
                  type: NOTIFICATIONUSERINVITED,
                  sender: uid,
                  activity_id: auid,
                  text: "You were invited to " + activity_title,
                  read: false,
                  profile_image_url: snapshot.val()["profile_image_url"]
        };

        var notificationRef = databaseref.child('schools/' + school_identifier + '/notifications/' + uid).push(notification);
                databaseref.child('schools/' + school_identifier + '/notifications/' + uid + "/" + notificationRef.key + "/notification_id").set(notificationRef.key);

        databaseref.child('schools/' + school_identifier + '/activities/' + auid + '/invited_users/' + uid).set(current_time);
        
    }
}

function inviteGroup(guid, school_identifier, auid, activity_title) {
  console.log('Invite group: ' + guid);

  databaseref.child('schools/' + school_identifier + '/groups/' + guid).once('value').then(function(snapshot){

          var current_time = new Date().getTime() / 1000;
          console.log("Group: " + snapshot.val());

          if (snapshot.val()["members"] != null) {
            for (var member_id in snapshot.val()["members"]) {

              var notification = {
                time_created: current_time*1.0,
                type: NOTIFICATIONGROUPINVITED,
                sender: guid,
                activity_id: auid,
                text: snapshot.val()["name"] + " was invited to " + activity_title,
                read: false,
                profile_image_url: ""
              };

              var notificationRef = databaseref.child('schools/' + school_identifier + '/notifications/' + member_id).push(notification);
              databaseref.child('schools/' + school_identifier + '/notifications/' + member_id + "/" + notificationRef.key + "/notification_id").set(notificationRef.key);

              databaseref.child('schools/' + school_identifier + '/activities/' + auid + '/invited_groups/' + guid).set(current_time);
                
              sendNotificationToUser(snapshot.val()["name"] + " was invited to " + activity_title, "Group Invited", member_id, school_identifier);
            }
          }
      })
}


//***************USER HANDLERS*************//

app.post('/api/add_user', function(req, res){
//   var token = req.query.token;

//   var auth = authenticateToken(token);
//   if(!auth.admin && !auth.write){
//        res.status(REQUESTFORBIDDEN).send("token could not be authenticated");
//       return;
//   }

//   incrementTokenCalls(token);

  console.log(JSON.stringify(req.body));
  
  var uid = req.body['uid'];
  var school_identifier = req.body['school_identifier'];
  var first_name = req.body["first_name"];
  var last_name = req.body["last_name"];
  var email = req.body["email"];
  var profile_image_url = req.body["profile_image_url"];
  
  /* Not required */
  var academic_level = "";//req.body["academic_level"];
  var major = "";//req.body["major"];
  var graduation_year = -1;//req.body["graduation_year"];
  var hometown = "";//req.body["hometown"];
  var description = "";//req.body["description"];

  if(!uid){
      res.status(REQUESTBAD).send("invalid parameters: no uid");
      return;
  }

  if(!school_identifier){
      res.status(REQUESTBAD).send("invalid parameters: no school identifier");
      return;
  }

  if(!first_name){
      res.status(REQUESTBAD).send("invalid parameters: no first name");
      return;
  }

  if(!last_name){
      res.status(REQUESTBAD).send("invalid parameters: no last name");
      return;
  }

  if(!email){
      res.status(REQUESTBAD).send("invalid parameters: no email");
      return;
  }
  /*
  if(!academic_level){
      res.status(REQUESTBAD).send("invalid parameters: no academic level");
      return;
  }

  if(!major){
      res.status(REQUESTBAD).send("invalid parameters: no major");
      return;
  }

  if(!graduation_year){
      res.status(REQUESTBAD).send("invalid parameters: no graduation year");
      return;
  }

  if(!hometown){
      hometown = "";
  }

  if(!description){
      description = "";
  }
  */
  if(!profile_image_url){
      profile_image_url = "";
  }

  var current_time = new Date().getTime() / 1000;

  databaseref.child('schools/' + school_identifier + '/users/' + uid + '/user_id').set(uid);
  databaseref.child('schools/' + school_identifier + '/users/' + uid + '/verified').set(false);
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

  databaseref.child('schools/' + school_identifier + '/search_users_array/' + uid).set(first_name + " " + last_name);

  res.status(REQUESTSUCCESSFUL).send('user added');

  //sendVerificationEmail

});

app.get('/api/get_user', function(req, res){
    var token = req.query.token;

    var auth = authenticateToken(token);
    if(!auth.admin && !auth.read){
         res.status(REQUESTFORBIDDEN).send("token could not be authenticated");
        return;
    }

    incrementTokenCalls(token);

    var school_identifier = req.query.school_identifier;
    var uid = req.query.uid;

    if(!uid){
        res.status(REQUESTBAD).send("invalid parameters: no uid");
        return;
    }

    if(!school_identifier){
        res.status(REQUESTBAD).send("invalid parameters: no school identifier");
        return;
    }

    databaseref.child('schools/' + school_identifier + '/users/' + uid).once('value').then(function(snapshot){
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

app.get('/api/get_user_full_name', function(req, res){
    var token = req.query.token;

    var auth = authenticateToken(token);
    if(!auth.admin && !auth.read){
         res.status(REQUESTFORBIDDEN).send("token could not be authenticated");
        return;
    }

    incrementTokenCalls(token);

    var school_identifier = req.query.school_identifier;
    var uid = req.query.uid;

    if(!uid){
        res.status(REQUESTBAD).send("invalid parameters: no uid");
        return;
    }

    if(!school_identifier){
        res.status(REQUESTBAD).send("invalid parameters: no school identifier");
        return;
    }

    databaseref.child('schools/' + school_identifier + '/users/' + uid).once('value').then(function(snapshot){
            if(snapshot.val())
                res.status(REQUESTSUCCESSFUL).send({name: snapshot.val()["first_name"] + " " + snapshot.val()["last_name"]});
            else
                res.status(REQUESTSUCCESSFUL).send({});
        })
        .catch(function(error){
            res.status(REQUESTBAD).send(error);
            console.log(error);
    });

});

app.get('/api/get_user_basic_info', function(req, res){
    var token = req.query.token;

    var auth = authenticateToken(token);
    if(!auth.admin && !auth.read){
         res.status(REQUESTFORBIDDEN).send("token could not be authenticated");
        return;
    }

    incrementTokenCalls(token);

    var school_identifier = req.query.school_identifier;
    var uid = req.query.uid;

    if(!uid){
        res.status(REQUESTBAD).send("invalid parameters: no uid");
        return;
    }

    if(!school_identifier){
        res.status(REQUESTBAD).send("invalid parameters: no school identifier");
        return;
    }

    databaseref.child('schools/' + school_identifier + '/users/' + uid).once('value').then(function(snapshot){
            if(snapshot.val()) {
                var basic_info = {
                  name: snapshot.val()["first_name"] + " " + snapshot.val()["last_name"],
                  first_name: snapshot.val()["first_name"],
                  graduation_year: snapshot.val()["graduation_year"],
                  major: snapshot.val()["major"],
                  academic_level: snapshot.val()["academic_level"],
                  hometown: snapshot.val()["hometown"],
                  profile_image_url: snapshot.val()["profile_image_url"],
                  user_id: snapshot.val()["user_id"]
                };
                res.status(REQUESTSUCCESSFUL).send(basic_info);
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

app.get('/api/get_user_friends', function(req, res){
    var token = req.query.token;

    var auth = authenticateToken(token);
    if(!auth.admin && !auth.read){
         res.status(REQUESTFORBIDDEN).send("token could not be authenticated");
        return;
    }

    incrementTokenCalls(token);

    var school_identifier = req.query.school_identifier;
    var uid = req.query.uid;

    if(!uid){
        res.status(REQUESTBAD).send("invalid parameters: no uid");
        return;
    }

    if(!school_identifier){
        res.status(REQUESTBAD).send("invalid parameters: no school identifier");
        return;
    }

    databaseref.child('schools/' + school_identifier + '/users/' + uid + '/friends').once('value').then(function(snapshot){
            if(snapshot.val()) {
                res.status(REQUESTSUCCESSFUL).send(snapshot.val());
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

app.get('/api/get_user_interests', function(req, res){
    var token = req.query.token;

    var auth = authenticateToken(token);
    if(!auth.admin && !auth.read){
         res.status(REQUESTFORBIDDEN).send("token could not be authenticated");
        return;
    }

    incrementTokenCalls(token);

    var school_identifier = req.query.school_identifier;
    var uid = req.query.uid;

    if(!uid){
        res.status(REQUESTBAD).send("invalid parameters: no uid");
        return;
    }

    if(!school_identifier){
        res.status(REQUESTBAD).send("invalid parameters: no school identifier");
        return;
    }

    databaseref.child('schools/' + school_identifier + '/users/' + uid + '/interests').once('value').then(function(snapshot){
            if(snapshot.val()) {
                res.status(REQUESTSUCCESSFUL).send(snapshot.val());
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

app.get('/api/get_user_groups', function(req, res){
    var token = req.query.token;

    var auth = authenticateToken(token);
    if(!auth.admin && !auth.read){
         res.status(REQUESTFORBIDDEN).send("token could not be authenticated");
        return;
    }

    incrementTokenCalls(token);

    var school_identifier = req.query.school_identifier;
    var uid = req.query.uid;

    if(!uid){
        res.status(REQUESTBAD).send("invalid parameters: no uid");
        return;
    }

    if(!school_identifier){
        res.status(REQUESTBAD).send("invalid parameters: no school identifier");
        return;
    }

    databaseref.child('schools/' + school_identifier + '/users/' + uid + '/groups').once('value').then(function(snapshot){
            if(snapshot.val()) {
                res.status(REQUESTSUCCESSFUL).send(snapshot.val());
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

app.get('/api/get_user_calendar', function(req, res){
    var token = req.query.token;

    var auth = authenticateToken(token);
    if(!auth.admin && !auth.read){
         res.status(REQUESTFORBIDDEN).send("token could not be authenticated");
        return;
    }

    incrementTokenCalls(token);

    var school_identifier = req.query.school_identifier;
    var uid = req.query.uid;

    if(!uid){
        res.status(REQUESTBAD).send("invalid parameters: no uid");
        return;
    }

    if(!school_identifier){
        res.status(REQUESTBAD).send("invalid parameters: no school identifier");
        return;
    }

    databaseref.child('schools/' + school_identifier + '/users/' + uid + '/calendar').once('value').then(function(snapshot){
            if(snapshot.val()) {
                
              console.log("Keys:" + Object.keys(snapshot.val()));
              
              checkIfActivityDeletedForCalendar(snapshot.val(), 0, {}, res, school_identifier);
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

function checkIfActivityDeletedForCalendar(activity_ids, index, return_activities, res, school_identifier) {
  
  console.log("Index: " + index + " :::: " + (activity_ids.length));
  
  if (index == Object.keys(activity_ids).length) {
    res.status(REQUESTSUCCESSFUL).send(return_activities);
    
    return;
  }
  
  var auid = Object.keys(activity_ids)[index];
  
  console.log("Check if deleted: " + auid);
  
  databaseref.child('schools/' + school_identifier + '/activities/' + auid).once('value').then(function(snapshot){
    
    if(snapshot.val()) {
      
      var eventDeleted = false;

      if(snapshot.val().hasOwnProperty('deleted')){
        eventDeleted = snapshot.val()['deleted'];
      }
                  
      if(!eventDeleted){
        //return_activities.push(auid);
        return_activities[auid] = activity_ids[auid];
      }
    }
    
    index = index + 1;
    checkIfActivityDeletedForCalendar(activity_ids, index, return_activities, res, school_identifier);
    return;
    
  }).catch(function(error){
    console.log("Error");
    res.status(REQUESTBAD).send(error);
    return;
  });
  
}

app.post('/api/update_user_first_name', function(req, res){
  var token = req.query.token;

  var auth = authenticateToken(token);
  if(!auth.admin && !auth.write){
       res.status(REQUESTFORBIDDEN).send("token could not be authenticated");
      return;
  }

  incrementTokenCalls(token);

  var uid = req.body['uid'];
  var school_identifier = req.body['school_identifier'];
  var first_name = req.body["first_name"];

  if(!uid){
      res.status(REQUESTBAD).send("invalid parameters: no uid");
      return;
  }

  if(!school_identifier){
      res.status(REQUESTBAD).send("invalid parameters: no school identifier");
      return;
  }

  if(!first_name){
      res.status(REQUESTBAD).send("invalid parameters: no first name");
      return;
  }

  databaseref.child('schools/' + school_identifier + '/users/' + uid + '/first_name').set(first_name);

  databaseref.child('schools/' + school_identifier + '/users/' + uid + "/last_name").once('value').then(function(snapshot){
          if(snapshot.val())
              databaseref.child('schools/' + school_identifier + '/search_users_array/' + uid).set(first_name + " " + snapshot.val());
          else
              res.status(REQUESTBAD).send("could ot get last name");
      })
      .catch(function(error){
          res.status(REQUESTBAD).send(error);
          console.log(error);
  });

  res.status(REQUESTSUCCESSFUL).send('first name updated');

});

app.post('/api/update_user_last_name', function(req, res){
  var token = req.query.token;

  var auth = authenticateToken(token);
  if(!auth.admin && !auth.write){
       res.status(REQUESTFORBIDDEN).send("token could not be authenticated");
      return;
  }

  incrementTokenCalls(token);

  var uid = req.body['uid'];
  var school_identifier = req.body['school_identifier'];
  var last_name = req.body["last_name"];

  if(!uid){
      res.status(REQUESTBAD).send("invalid parameters: no uid");
      return;
  }

  if(!school_identifier){
      res.status(REQUESTBAD).send("invalid parameters: no school identifier");
      return;
  }

  if(!last_name){
      res.status(REQUESTBAD).send("invalid parameters: no last name");
      return;
  }

  databaseref.child('schools/' + school_identifier + '/users/' + uid + '/last_name').set(last_name);

  databaseref.child('schools/' + school_identifier + '/users/' + uid + "/first_name").once('value').then(function(snapshot){
          if(snapshot.val())
              databaseref.child('schools/' + school_identifier + '/search_users_array/' + uid).set(snapshot.val() + " " + last_name);
          else
              res.status(REQUESTBAD).send("could ot get first name");
      })
      .catch(function(error){
          res.status(REQUESTBAD).send(error);
          console.log(error);
  });

  res.status(REQUESTSUCCESSFUL).send('last name updated');

});

app.post('/api/update_user_email', function(req, res){
  var token = req.query.token;

  var auth = authenticateToken(token);
  if(!auth.admin && !auth.write){
       res.status(REQUESTFORBIDDEN).send("token could not be authenticated");
      return;
  }

  incrementTokenCalls(token);

  var uid = req.body['uid'];
  var school_identifier = req.body['school_identifier'];
  var email = req.body["email"];

  if(!uid){
      res.status(REQUESTBAD).send("invalid parameters: no uid");
      return;
  }

  if(!school_identifier){
      res.status(REQUESTBAD).send("invalid parameters: no school identifier");
      return;
  }

  if(!email){
      res.status(REQUESTBAD).send("invalid parameters: no email");
      return;
  }

  databaseref.child('schools/' + school_identifier + '/users/' + uid + '/email').set(email);

  res.status(REQUESTSUCCESSFUL).send('email updated');

});

app.post('/api/update_user_academic_level', function(req, res){
  var token = req.query.token;

  var auth = authenticateToken(token);
  if(!auth.admin && !auth.write){
       res.status(REQUESTFORBIDDEN).send("token could not be authenticated");
      return;
  }

  incrementTokenCalls(token);

  var uid = req.body['uid'];
  var school_identifier = req.body['school_identifier'];
  var academic_level = req.body["academic_level"];

  if(!uid){
      res.status(REQUESTBAD).send("invalid parameters: no uid");
      return;
  }

  if(!school_identifier){
      res.status(REQUESTBAD).send("invalid parameters: no school identifier");
      return;
  }

  if(!academic_level){
      res.status(REQUESTBAD).send("invalid parameters: no academic level");
      return;
  }

  databaseref.child('schools/' + school_identifier + '/users/' + uid + '/academic_level').set(academic_level);

  res.status(REQUESTSUCCESSFUL).send('academic level updated');

});

app.post('/api/update_user_interests', function(req, res){
    var token = req.query.token;

    var auth = authenticateToken(token);
    if(!auth.admin && !auth.write){
         res.status(REQUESTFORBIDDEN).send("token could not be authenticated");
        return;
    }

    incrementTokenCalls(token);

    var school_identifier = req.body['school_identifier'];
    var uid = req.body['uid'];
    var interests = req.body['interests'];

    if(!uid){
        res.status(REQUESTBAD).send("invalid parameters: no uid");
        return;
    }

    if(!school_identifier){
        res.status(REQUESTBAD).send("invalid parameters: no school identifier");
        return;
    }

    if(!interests){
        res.status(REQUESTBAD).send("invalid parameters: no interests");
        return;
    }

    databaseref.child('schools').child(school_identifier).child('users').child(uid).child('interests').set(interests);
    res.status(REQUESTSUCCESSFUL).send("interests updated");

});

app.post('/api/update_user_major', function(req, res){
  var token = req.query.token;

  var auth = authenticateToken(token);
  if(!auth.admin && !auth.write){
       res.status(REQUESTFORBIDDEN).send("token could not be authenticated");
      return;
  }

  incrementTokenCalls(token);

  var uid = req.body['uid'];
  var school_identifier = req.body['school_identifier'];
  var major = req.body["major"];

  if(!uid){
      res.status(REQUESTBAD).send("invalid parameters: no uid");
      return;
  }

  if(!school_identifier){
      res.status(REQUESTBAD).send("invalid parameters: no school identifier");
      return;
  }

  if(!major){
      res.status(REQUESTBAD).send("invalid parameters: major");
      return;
  }

  databaseref.child('schools/' + school_identifier + '/users/' + uid + '/major').set(major);

  res.status(REQUESTSUCCESSFUL).send('major updated');

});

app.post('/api/update_user_graduation_year', function(req, res){
  var token = req.query.token;

  var auth = authenticateToken(token);
  if(!auth.admin && !auth.write){
       res.status(REQUESTFORBIDDEN).send("token could not be authenticated");
      return;
  }

  incrementTokenCalls(token);

  var uid = req.body['uid'];
  var school_identifier = req.body['school_identifier'];
  var graduation_year = req.body["graduation_year"];

  if(!uid){
      res.status(REQUESTBAD).send("invalid parameters: no uid");
      return;
  }

  if(!school_identifier){
      res.status(REQUESTBAD).send("invalid parameters: no school identifier");
      return;
  }

  if(!graduation_year){
      res.status(REQUESTBAD).send("invalid parameters: no graduation year");
      return;
  }

  databaseref.child('schools/' + school_identifier + '/users/' + uid + '/graduation_year').set(graduation_year*1);

  res.status(REQUESTSUCCESSFUL).send('graduation year updated');

});

app.post('/api/update_user_hometown', function(req, res){
  var token = req.query.token;

  var auth = authenticateToken(token);
  if(!auth.admin && !auth.write){
       res.status(REQUESTFORBIDDEN).send("token could not be authenticated");
      return;
  }

  incrementTokenCalls(token);

  var uid = req.body['uid'];
  var school_identifier = req.body['school_identifier'];
  var hometown = req.body["hometown"];

  if(!uid){
      res.status(REQUESTBAD).send("invalid parameters: no uid");
      return;
  }

  if(!school_identifier){
      res.status(REQUESTBAD).send("invalid parameters: no school identifier");
      return;
  }

  if(!hometown){
      res.status(REQUESTBAD).send("invalid parameters: no hometown");
      return;
  }

  databaseref.child('schools/' + school_identifier + '/users/' + uid + '/hometown').set(hometown);

  res.status(REQUESTSUCCESSFUL).send('hometown updated');

});

app.post('/api/update_user_description', function(req, res){
  var token = req.query.token;

  var auth = authenticateToken(token);
  if(!auth.admin && !auth.write){
       res.status(REQUESTFORBIDDEN).send("token could not be authenticated");
      return;
  }

  incrementTokenCalls(token);

  var uid = req.body['uid'];
  var school_identifier = req.body['school_identifier'];
  var description = req.body["description"];

  if(!uid){
      res.status(REQUESTBAD).send("invalid parameters: no uid");
      return;
  }

  if(!school_identifier){
      res.status(REQUESTBAD).send("invalid parameters: no school identifier");
      return;
  }

  if(!description){
      res.status(REQUESTBAD).send("invalid parameters: no description");
      return;
  }

  databaseref.child('schools/' + school_identifier + '/users/' + uid + '/description').set(description);

  res.status(REQUESTSUCCESSFUL).send('user description updated');

});

app.post('/api/update_user_profile_image_url', function(req, res){
  var token = req.query.token;

  var auth = authenticateToken(token);
  if(!auth.admin && !auth.write){
       res.status(REQUESTFORBIDDEN).send("token could not be authenticated");
      return;
  }

  incrementTokenCalls(token);

  var uid = req.body['uid'];
  var school_identifier = req.body['school_identifier'];
  var profile_image_url = req.body["profile_image_url"];

  if(!uid){
      res.status(REQUESTBAD).send("invalid parameters: no uid");
      return;
  }

  if(!school_identifier){
      res.status(REQUESTBAD).send("invalid parameters: no school identifier");
      return;
  }

  if(!profile_image_url){
      res.status(REQUESTBAD).send("invalid parameters: no profile image url");
      return;
  }

  databaseref.child('schools/' + school_identifier + '/users/' + uid + '/profile_image_url').set(profile_image_url);

  res.status(REQUESTSUCCESSFUL).send('profile image url updated');

});

app.post('/api/update_user_last_logon', function(req, res){
  var token = req.query.token;

  var auth = authenticateToken(token);
  if(!auth.admin && !auth.write){
       res.status(REQUESTFORBIDDEN).send("token could not be authenticated");
      return;
  }

  incrementTokenCalls(token);

  var uid = req.body['uid'];
  var school_identifier = req.body['school_identifier'];
  var last_logon = req.body["last_logon"];

  if(!uid){
      res.status(REQUESTBAD).send("invalid parameters: no uid");
      return;
  }

  if(!school_identifier){
      res.status(REQUESTBAD).send("invalid parameters: no school identifier");
      return;
  }

  if(!last_logon){
      res.status(REQUESTBAD).send("invalid parameters: no last logon");
      return;
  }

  databaseref.child('schools/' + school_identifier + '/users/' + uid + '/last_logon').set(last_logon*1.0);

  res.status(REQUESTSUCCESSFUL).send('lats logon updated');

});

app.post('/api/user_intro_complete', function(req, res){
  var token = req.query.token;

  var auth = authenticateToken(token);
  if(!auth.admin && !auth.write){
       res.status(REQUESTFORBIDDEN).send("token could not be authenticated");
      return;
  }

  incrementTokenCalls(token);

  var uid = req.body['uid'];
  var school_identifier = req.body['school_identifier'];

  if(!uid){
      res.status(REQUESTBAD).send("invalid parameters: no uid");
      return;
  }

  if(!school_identifier){
      res.status(REQUESTBAD).send("invalid parameters: no school identifier");
      return;
  }

  databaseref.child('schools/' + school_identifier + '/users/' + uid + '/intro_complete').set(true);

  res.status(REQUESTSUCCESSFUL).send('intro complete updated');

});

app.get('/api/is_user_suspended', function(req, res){
    var token = req.query.token;

    var auth = authenticateToken(token);
    if(!auth.admin && !auth.read){
         res.status(REQUESTFORBIDDEN).send("token could not be authenticated");
        return;
    }

    incrementTokenCalls(token);

    var school_identifier = req.query.school_identifier;
    var uid = req.query.uid;

    if(!uid){
        res.status(REQUESTBAD).send("invalid parameters: no uid");
        return;
    }

    if(!school_identifier){
        res.status(REQUESTBAD).send("invalid parameters: no school identifier");
        return;
    }

    databaseref.child('schools/' + school_identifier + '/users/' + uid + '/suspended').once('value').then(function(snapshot){
            if(snapshot.val()) {
                res.status(REQUESTSUCCESSFUL).send({suspended: snapshot.val()});
              }
            else {
                res.status(REQUESTSUCCESSFUL).send({suspended: false});
              }
        })
        .catch(function(error){
            res.status(REQUESTBAD).send(error);
            console.log(error);
    });

});


//***************GROUP HANDLERS*************//

app.get('/api/get_groups', function(req, res){
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

    databaseref.child('schools').child(school_identifier).child('groups').once('value').then(function(snapshot){
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

app.get('/api/get_group', function(req, res){
    var token = req.query.token;

    var auth = authenticateToken(token);
    if(!auth.admin && !auth.read){
         res.status(REQUESTFORBIDDEN).send("token could not be authenticated");
        return;
    }

    incrementTokenCalls(token);

    var school_identifier = req.query.school_identifier;
    var guid = req.query.guid;

    if(!guid){
        res.status(REQUESTBAD).send("invalid parameters: no guid");
        return;
    }

    if(!school_identifier){
        res.status(REQUESTBAD).send("invalid parameters: no school identifier");
        return;
    }

    databaseref.child('schools/' + school_identifier + '/groups/' + guid).once('value').then(function(snapshot){
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

app.get('/api/get_group_basic_info', function(req, res){
    var token = req.query.token;

    var auth = authenticateToken(token);
    if(!auth.admin && !auth.read){
         res.status(REQUESTFORBIDDEN).send("token could not be authenticated");
        return;
    }

    incrementTokenCalls(token);

    var school_identifier = req.query.school_identifier;
    var guid = req.query.guid;

    if(!guid){
        res.status(REQUESTBAD).send("invalid parameters: no guid");
        return;
    }

    if(!school_identifier){
        res.status(REQUESTBAD).send("invalid parameters: no school identifier");
        return;
    }

    databaseref.child('schools/' + school_identifier + '/groups/' + guid).once('value').then(function(snapshot){
            if(snapshot.val()) {
              
              var num_members = 0;
              
              if (snapshot.val()["members"]) {
                num_members = Object.keys(snapshot.val()["members"]).length;
              }
              
              var basic_info = {
                name: snapshot.val()["name"],
                short_name: snapshot.val()["short_name"],
                color: snapshot.val()["color"],
                group_id: snapshot.val()["group_id"],
                member_count: num_members
              };
              res.status(REQUESTSUCCESSFUL).send(basic_info);
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

app.post('/api/join_group', function(req, res){
  var token = req.query.token;

  var auth = authenticateToken(token);
  if(!auth.admin && !auth.write){
       res.status(REQUESTFORBIDDEN).send("token could not be authenticated");
      return;
  }

  incrementTokenCalls(token);

  var uid = req.body['uid'];
  var school_identifier = req.body['school_identifier'];
  var guid = req.body['guid'];

  if(!uid){
      res.status(REQUESTBAD).send("invalid parameters: no uid");
      return;
  }

  if(!school_identifier){
      res.status(REQUESTBAD).send("invalid parameters: no school identifier");
      return;
  }

  if(!guid){
      res.status(REQUESTBAD).send("invalid parameters: no guid");
      return;
  }

  var current_time = new Date().getTime() / 1000;
  databaseref.child('schools/' + school_identifier + '/groups/' + guid + '/members/' + uid).set(current_time);

  databaseref.child('schools/' + school_identifier + '/users/' + uid + '/groups/' + guid).set(current_time);

  res.status(REQUESTSUCCESSFUL).send('interested changed');

});

app.post('/api/leave_group', function(req, res){
  var token = req.query.token;

  var auth = authenticateToken(token);
  if(!auth.admin && !auth.write){
       res.status(REQUESTFORBIDDEN).send("token could not be authenticated");
      return;
  }

  incrementTokenCalls(token);

  var uid = req.body['uid'];
  var school_identifier = req.body['school_identifier'];
  var guid = req.body['guid'];

  if(!uid){
      res.status(REQUESTBAD).send("invalid parameters: no uid");
      return;
  }

  if(!school_identifier){
      res.status(REQUESTBAD).send("invalid parameters: no school identifier");
      return;
  }

  if(!guid){
      res.status(REQUESTBAD).send("invalid parameters: no guid");
      return;
  }

  databaseref.child('schools/' + school_identifier + '/groups/' + guid + '/members/' + uid).remove();

  databaseref.child('schools/' + school_identifier + '/users/' + uid + '/groups/' + guid).remove();

  res.status(REQUESTSUCCESSFUL).send('interested changed');

});

//***************DISCOVER HANDLERS*************//

app.get('/api/get_suggested_users', function(req, res){
  var token = req.query.token;

  var auth = authenticateToken(token);
  if(!auth.admin && !auth.write){
       res.status(REQUESTFORBIDDEN).send("token could not be authenticated");
      return;
  }

  incrementTokenCalls(token);

  var school_identifier = req.query['school_identifier'];

  if(!school_identifier){
      res.status(REQUESTBAD).send("invalid parameters: no school identifier");
      return;
  }

  databaseref.child('schools').child(school_identifier).child('users').once('value').then(function(snapshot){
            if(snapshot.val())
                sortAndSendUsers(snapshot.val(), res);
            else
                res.status(REQUESTSUCCESSFUL).send({});
        })
        .catch(function(error){
            res.status(REQUESTBAD).send(error);
            console.log(error);
    });


});


app.get('/api/get_suggested_groups', function(req, res){
  var token = req.query.token;

  var auth = authenticateToken(token);
  if(!auth.admin && !auth.write){
       res.status(REQUESTFORBIDDEN).send("token could not be authenticated");
      return;
  }

  incrementTokenCalls(token);

  var school_identifier = req.query['school_identifier'];

  if(!school_identifier){
      res.status(REQUESTBAD).send("invalid parameters: no school identifier");
      return;
  }

  databaseref.child('schools').child(school_identifier).child('groups').once('value').then(function(snapshot){
            if(snapshot.val())
                sortAndSendGroups(snapshot.val(), res);
            else
                res.status(REQUESTSUCCESSFUL).send({});
        })
        .catch(function(error){
            res.status(REQUESTBAD).send(error);
            console.log(error);
    });


});

function sortAndSendGroups(groups, res){
    var keyArr = Object.keys(groups);
    shuffle(keyArr);

    var suggestedGroups = []; //top ten groups to be returned to the user

    var sml = keyArr.length > 10 ? 10 : keyArr.length;
    for(i = 0; i < sml; i++){
        suggestedGroups.push(groups[keyArr[i]]);
    }

    res.status(REQUESTSUCCESSFUL).send(suggestedGroups);

}

function sortAndSendUsers(users, res){
    var keyArr = Object.keys(users);
    shuffle(keyArr);

    var suggestedUsers = []; //top ten groups to be returned to the user

    var sml = keyArr.length > 10 ? 10 : keyArr.length;
    for(i = 0; i < sml; i++){
        suggestedUsers.push(users[keyArr[i]]);
    }

    res.status(REQUESTSUCCESSFUL).send(suggestedUsers);

}

function shuffle(o){ //v1.0
    for(var j, x, i = o.length; i; j = parseInt(Math.random() * i), x = o[--i], o[i] = o[j], o[j] = x);
    return o;
};

app.get('/api/get_search_users_array', function(req, res){
  var token = req.query.token;

  var auth = authenticateToken(token);
  if(!auth.admin && !auth.write){
       res.status(REQUESTFORBIDDEN).send("token could not be authenticated");
      return;
  }

  incrementTokenCalls(token);

  var school_identifier = req.query['school_identifier'];

  if(!school_identifier){
      res.status(REQUESTBAD).send("invalid parameters: no school identifier");
      return;
  }

  databaseref.child('schools').child(school_identifier).child('search_users_array').once('value').then(function(snapshot){
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

app.get('/api/get_search_groups_array', function(req, res){
  var token = req.query.token;

  var auth = authenticateToken(token);
  if(!auth.admin && !auth.write){
       res.status(REQUESTFORBIDDEN).send("token could not be authenticated");
      return;
  }

  incrementTokenCalls(token);

  var school_identifier = req.query['school_identifier'];

  if(!school_identifier){
      res.status(REQUESTBAD).send("invalid parameters: no school identifier");
      return;
  }

  databaseref.child('schools').child(school_identifier).child('search_groups_array').once('value').then(function(snapshot){
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
//GET ALL USERS FROM SCHOOL
app.get('/api/get_users', function(req, res){
  var token = req.query.token;

  var auth = authenticateToken(token);
  if(!auth.admin && !auth.write){
       res.status(REQUESTFORBIDDEN).send("token could not be authenticated");
      return;
  }

  incrementTokenCalls(token);

  var school_identifier = req.query['school_identifier'];

  if(!school_identifier){
      res.status(REQUESTBAD).send("invalid parameters: no school identifier");
      return;
  }

  var filter = req.query.filter;
  if (filter) filter = JSON.parse(filter);
  
  
  databaseref.child('schools').child(school_identifier).child('users').once('value').then(function(snapshot){
    let users = snapshot.val();
    if (users) {
        if (filter) {
            var tmpUsers = {};
            Object.keys(users).forEach(k => {
                const u = users[k];

                if (!Object.keys(filter).some(field => {
                    var filterValue = filter[field];
                    var userValue = u[field];
                    if (!filterValue) return false;
                    filterValue = filterValue.toString().toLowerCase();
                    if (userValue) {
                        userValue = userValue.toString().toLowerCase();
                    } else userValue = "";
                    return filterValue[0] === '='
                        ? filterValue.substring(1) != userValue
                        : userValue.indexOf(filterValue) === -1;
                })) {
                    tmpUsers[k] = u;
                }
            });
            users = tmpUsers;
        }
        res.status(REQUESTSUCCESSFUL).send(users);
    }
    else
        res.status(REQUESTSUCCESSFUL).send({});
}).catch(function(error){
    res.status(REQUESTBAD).send(error);
    console.log(error);
});


});


//***************FRIEND HANDLERS*************//

app.post('/api/request_friend', function(req, res){
    var token = req.query.token;

    var auth = authenticateToken(token);
    if(!auth.admin && !auth.write){
         res.status(REQUESTFORBIDDEN).send("token could not be authenticated");
        return;
    }

    var school_identifier = req.body['school_identifier'];
    console.log(school_identifier);
    var uid = req.body.uid;
    var friend = req.body.friend;

    if(!school_identifier){
        res.status(REQUESTBAD).send("invalid parameters: no school identifier");
        return;
    }

    if(!uid){
        res.status(REQUESTBAD).send("invalid parameters: no uid");
        return;
    }

    if(!friend){
        res.status(REQUESTBAD).send("invalid parameters: no friend");
        return;
    }

    databaseref.child('schools/' + school_identifier + '/users/' + uid + "/sent_friend_requests/" + friend).once('value').then(function(snapshot){
            if(!snapshot.val()) {

              databaseref.child('schools/' + school_identifier + '/users/' + uid).once('value').then(function(snapshot){

                      console.log("User: " + snapshot.val());

                      if (snapshot.val()) {

                        var current_time = new Date().getTime() / 1000;

                        databaseref.child('schools/' + school_identifier + '/users/' + uid + "/sent_friend_requests/" + friend).set(current_time);
                        databaseref.child('schools/' + school_identifier + '/users/' + friend + "/received_friend_requests/" + uid).set(current_time);

                        var notification = {
                          time_created: current_time*1.0,
                          type: NOTIFICATIONFRIENDREQUEST,
                          sender: uid,
                          activity_id: "",
                          text: snapshot.val()["first_name"] + " " + snapshot.val()["last_name"] + " sent you a friend request!",
                          read: false,
                          profile_image_url: snapshot.val()["profile_image_url"]
                        };

                        var notificationRef = databaseref.child('schools/' + school_identifier + '/notifications/' + friend).push(notification);
                        databaseref.child('schools/' + school_identifier + '/notifications/' + friend + "/" + notificationRef.key + "/notification_id").set(notificationRef.key);
                        
                        sendNotificationToUser(snapshot.val()["first_name"] + " " + snapshot.val()["last_name"] + " sent you a friend request!", "Friend Request", friend, school_identifier);
                      }
                  })
                  .catch(function(error){
                      res.status(REQUESTBAD).send(error);
                      console.log(error);
              });
            }
        })
        .catch(function(error){
            res.status(REQUESTBAD).send(error);
            console.log(error);
    });

    res.status(REQUESTSUCCESSFUL).send("success");

});

app.post('/api/approve_friend', function(req, res){
    var token = req.query.token;

    var auth = authenticateToken(token);
    if(!auth.admin && !auth.write){
         res.status(REQUESTFORBIDDEN).send("token could not be authenticated");
        return;
    }

    var school_identifier = req.body['school_identifier'];
    console.log(school_identifier);
    var uid = req.body.uid;
    var friend = req.body.friend;

    if(!school_identifier){
        res.status(REQUESTBAD).send("invalid parameters: no school identifier");
        return;
    }

    if(!uid){
        res.status(REQUESTBAD).send("invalid parameters: no uid");
        return;
    }

    if(!friend){
        res.status(REQUESTBAD).send("invalid parameters: no friend");
        return;
    }

    databaseref.child('schools/' + school_identifier + '/notifications/' + uid).once('value').then(function(snapshot){

            console.log("Notifications: " + snapshot.val());

            if(snapshot.val()) {

              for (var notification_id in snapshot.val()) {

                console.log("notification_id: " + notification_id);
                console.log("notification type: " + snapshot.val()[notification_id]["type"]);
                console.log("notification sender: " + snapshot.val()[notification_id]["sender"]);

                if (snapshot.val()[notification_id]["type"] === NOTIFICATIONFRIENDREQUEST) {
                  if (snapshot.val()[notification_id]["sender"] === friend) {
                    databaseref.child('schools/' + school_identifier + '/notifications/' + uid + "/" + notification_id).remove();
                  }
                }
              }

            }
        })
        .catch(function(error){
            res.status(REQUESTBAD).send(error);
            console.log(error);
    });

    var current_time = new Date().getTime() / 1000;

    databaseref.child('schools/' + school_identifier + '/users/' + friend + "/sent_friend_requests/" + uid).remove();
    databaseref.child('schools/' + school_identifier + '/users/' + uid + "/received_friend_requests/" + friend).remove();

    databaseref.child('schools/' + school_identifier + '/users/' + uid + "/friends/" + friend).set(current_time);
    databaseref.child('schools/' + school_identifier + '/users/' + friend + "/friends/" + uid).set(current_time);

    res.status(REQUESTSUCCESSFUL).send("success");

});

app.post('/api/ignore_friend_request', function(req, res){
    var token = req.query.token;

    var auth = authenticateToken(token);
    if(!auth.admin && !auth.write){
         res.status(REQUESTFORBIDDEN).send("token could not be authenticated");
        return;
    }

    var school_identifier = req.body['school_identifier'];
    console.log(school_identifier);
    var uid = req.body.uid;
    var friend = req.body.friend;

    if(!school_identifier){
        res.status(REQUESTBAD).send("invalid parameters: no school identifier");
        return;
    }

    if(!uid){
        res.status(REQUESTBAD).send("invalid parameters: no uid");
        return;
    }

    if(!friend){
        res.status(REQUESTBAD).send("invalid parameters: no friend");
        return;
    }

    databaseref.child('schools/' + school_identifier + '/notifications/' + uid).once('value').then(function(snapshot){

            console.log("Notifications: " + snapshot.val());

            if(snapshot.val()) {

              for (var notification_id in snapshot.val()) {

                console.log("notification_id: " + notification_id);
                console.log("notification type: " + snapshot.val()[notification_id]["type"]);
                console.log("notification sender: " + snapshot.val()[notification_id]["sender"]);

                if (snapshot.val()[notification_id]["type"] === NOTIFICATIONFRIENDREQUEST) {
                  if (snapshot.val()[notification_id]["sender"] === friend) {
                    databaseref.child('schools/' + school_identifier + '/notifications/' + uid + "/" + notification_id).remove();
                  }
                }
              }

            }
        })
        .catch(function(error){
            res.status(REQUESTBAD).send(error);
            console.log(error);
    });

    var current_time = new Date().getTime() / 1000;

    databaseref.child('schools/' + school_identifier + '/users/' + friend + "/sent_friend_requests/" + uid).remove();
    databaseref.child('schools/' + school_identifier + '/users/' + uid + "/received_friend_requests/" + friend).remove();

    res.status(REQUESTSUCCESSFUL).send("success");

});

app.post('/api/remove_friend', function(req, res){
    var token = req.query.token;

    var auth = authenticateToken(token);
    if(!auth.admin && !auth.write){
         res.status(REQUESTFORBIDDEN).send("token could not be authenticated");
        return;
    }

    var school_identifier = req.body.school_identifier;
    var uid = req.body.uid;
    var friend = req.body.friend;

    if(!school_identifier){
        res.status(REQUESTBAD).send("invalid parameters: no school identifier");
        return;
    }

    if(!uid){
        res.status(REQUESTBAD).send("invalid parameters: no uid");
        return;
    }

    if(!friend){
        res.status(REQUESTBAD).send("invalid parameters: no friend");
        return;
    }

    databaseref.child('schools/' + school_identifier + '/users/' + uid + "/friends/" + friend).remove();
    databaseref.child('schools/' + school_identifier + '/users/' + friend + "/friends/" + uid).remove();

    res.status(REQUESTSUCCESSFUL).send("friend removed");

});

app.get('/api/get_sent_friend_requests', function(req, res){
    var token = req.query.token;

    var auth = authenticateToken(token);
    if(!auth.admin && !auth.read){
         res.status(REQUESTFORBIDDEN).send("token could not be authenticated");
        return;
    }

    incrementTokenCalls(token);

    var school_identifier = req.query.school_identifier;
    var uid = req.query.uid;

    if(!uid){
        res.status(REQUESTBAD).send("invalid parameters: no uid");
        return;
    }

    if(!school_identifier){
        res.status(REQUESTBAD).send("invalid parameters: no school identifier");
        return;
    }

    databaseref.child('schools/' + school_identifier + '/users/' + uid + "/sent_friend_requests/").once('value').then(function(snapshot){
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

app.get('/api/get_received_friend_requests', function(req, res){
    var token = req.query.token;

    var auth = authenticateToken(token);
    if(!auth.admin && !auth.read){
         res.status(REQUESTFORBIDDEN).send("token could not be authenticated");
        return;
    }

    incrementTokenCalls(token);

    var school_identifier = req.query.school_identifier;
    var uid = req.query.uid;

    if(!uid){
        res.status(REQUESTBAD).send("invalid parameters: no uid");
        return;
    }

    if(!school_identifier){
        res.status(REQUESTBAD).send("invalid parameters: no school identifier");
        return;
    }

    databaseref.child('schools/' + school_identifier + '/users/' + uid + "/received_friend_requests/").once('value').then(function(snapshot){
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

//***************DISCUSSION HANDLERS*************//

app.post('/api/post_discussion', function(req, res){
    var token = req.query.token;

    var auth = authenticateToken(token);
    if(!auth.admin && !auth.write){
         res.status(REQUESTFORBIDDEN).send("token could not be authenticated");
        return;
    }

    var school_identifier = req.body['school_identifier'];
    if(!school_identifier){
        res.status(REQUESTBAD).send("invalid parameters: no school identifier");
        return;
    }


    var auid = req.body['auid'];
    if(!auid){
        res.status(REQUESTBAD).send("invalid parameters: no event key");
        return;
    }

    var uid = req.body['uid'];
    if(!uid){
        res.status(REQUESTBAD).send("invalid parameters: no uid");
        return;
    }
    
    //temporary measure to stop hugh neutron from posting comments
    //delete after better solution has been found
    if(uid === '9SICVXhnRGUB7KB58qiQhZp0XEF2' || uid === '00UELlTJJlhDAn3K2haD2cXmadi1'){
        res.status(REQUESTBAD).send("user not allowed to post comments");
        return;
    }
    
    var text = req.body['text'];
    if(!text){
        res.status(REQUESTBAD).send("invalid parameters: no text");
        return;
    }

    var discussion = {
        user_id: uid,
        activity_id: auid,
        text: text,
        time_posted: new Date().getTime() / 1000
    };
    
    var newDiscussionRef = databaseref.child("schools").child(school_identifier).child("discussions").child(auid).push(discussion);
    var discussion_id = newDiscussionRef.key;

    newDiscussionRef.child('discussion_id').set(discussion_id);

    databaseref.child('schools/' + school_identifier + '/activities/' + auid).once('value').then(function(snapshot){

        var current_time = new Date().getTime() / 1000;
        console.log("Activity: " + snapshot.val());

        var activity_title = snapshot.val()["title"];
        
        if (snapshot.val()["replies"] != null) {
            for (var reply_id in snapshot.val()["replies"]) {

            if (snapshot.val()["replies"][reply_id] == "going" && reply_id != uid) {
                var notification = {
                    time_created: current_time*1.0,
                    type: NOTIFICATIONDISCUSSIONPOSTED,
                    sender: uid,
                    activity_id: auid,
                    text: "New discussion in " + activity_title + ": " + text,
                    read: false,
                    profile_image_url: ""
                };

                var notificationRef = databaseref.child('schools/' + school_identifier + '/notifications/' + reply_id).push(notification);
                databaseref.child('schools/' + school_identifier + '/notifications/' + reply_id + "/" + notificationRef.key + "/notification_id").set(notificationRef.key);
                
                sendNotificationToUser("New discussion in " + activity_title, "Discussion", reply_id, school_identifier);
            
                } 
            
            }
        }
    })
    
    res.status(REQUESTSUCCESSFUL).send("discussion added");
});

app.get('/api/get_discussions', function(req, res){
    
    var token = req.query.token;

    var auth = authenticateToken(token);
    if(!auth.admin && !auth.read){
         res.status(REQUESTFORBIDDEN).send("token could not be authenticated");
        return;
    }

    var school_identifier = req.query.school_identifier;
    if(!school_identifier){
        res.status(REQUESTBAD).send("invalid parameters: no school identifier");
        return;
    }


    var auid = req.query.auid;
    if(!auid){
        res.status(REQUESTBAD).send("invalid parameters: no auid");
        return;
    }
    
    databaseref.child("schools").child(school_identifier).child("discussions").child(auid).once('value').then(function(snapshot){
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


//***************NOTIFICATIONS HANDLERS*************//

app.get('/api/get_notifications', function(req, res){
    var token = req.query.token;

    var auth = authenticateToken(token);
    if(!auth.admin && !auth.read){
         res.status(REQUESTFORBIDDEN).send("token could not be authenticated");
        return;
    }

    incrementTokenCalls(token);

    var school_identifier = req.query.school_identifier;
    var uid = req.query.uid;

    if(!uid){
        res.status(REQUESTBAD).send("invalid parameters: no uid");
        return;
    }

    if(!school_identifier){
        res.status(REQUESTBAD).send("invalid parameters: no school identifier");
        return;
    }

    databaseref.child('schools/' + school_identifier + '/notifications/' + uid).once('value').then(function(snapshot){
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

app.post('/api/update_notification_read', function(req, res){
    var token = req.query.token;

    var auth = authenticateToken(token);
    if(!auth.admin && !auth.write){
         res.status(REQUESTFORBIDDEN).send("token could not be authenticated");
        return;
    }

    var school_identifier = req.body.school_identifier;
    var notification_id = req.body.notification_id;
    var uid = req.body.uid;
    var read = req.body.read;

    if(!school_identifier){
        res.status(REQUESTBAD).send("invalid parameters: no school identifier");
        return;
    }

    if(!notification_id){
        res.status(REQUESTBAD).send("invalid parameters: no notification identifier");
        return;
    }
  
    if(!uid){
        res.status(REQUESTBAD).send("invalid parameters: no uid");
        return;
    }

    if(read == null){
        res.status(REQUESTBAD).send("invalid parameters: no read");
        return;
    }

    databaseref.child('schools/' + school_identifier + '/notifications/' + uid + '/' + notification_id + "/read").set(read);

    res.status(REQUESTSUCCESSFUL).send("read updated");

});

app.post('/api/add_notification_token', function(req, res){
    var token = req.query.token;

    var auth = authenticateToken(token);
    if(!auth.admin && !auth.write){
         res.status(REQUESTFORBIDDEN).send("token could not be authenticated");
        return;
    }

    var school_identifier = req.body.school_identifier;
    var uid = req.body.uid;
    var notification_token = req.body.notification_token;

    if(!school_identifier){
        res.status(REQUESTBAD).send("invalid parameters: no school identifier");
        return;
    }

    if(!uid){
        res.status(REQUESTBAD).send("invalid parameters: no uid");
        return;
    }

    if(!token){
        res.status(REQUESTBAD).send("invalid parameters: no token");
        return;
    }

    var current_time = new Date().getTime() / 1000;
    databaseref.child('schools/' + school_identifier + '/users/' + uid + "/notification_tokens/" + notification_token).set(current_time);

    res.status(REQUESTSUCCESSFUL).send("notification token added");

});

app.post('/api/remove_notification_token', function(req, res){
    var token = req.query.token;

    var auth = authenticateToken(token);
    if(!auth.admin && !auth.write){
         res.status(REQUESTFORBIDDEN).send("token could not be authenticated");
        return;
    }

    var school_identifier = req.body.school_identifier;
    var uid = req.body.uid;
    var notification_token = req.body.notification_token;

    if(!school_identifier){
        res.status(REQUESTBAD).send("invalid parameters: no school identifier");
        return;
    }

    if(!uid){
        res.status(REQUESTBAD).send("invalid parameters: no uid");
        return;
    }

    if(!token){
        res.status(REQUESTBAD).send("invalid parameters: no token");
        return;
    }

    var current_time = new Date().getTime() / 1000;
    databaseref.child('schools/' + school_identifier + '/users/' + uid + "/notification_tokens/" + notification_token).remove();

    res.status(REQUESTSUCCESSFUL).send("notification token removed");

});

app.post('/api/send_notification_to_user', function(req, res){
    var token = req.query.token;

    var auth = authenticateToken(token);
    if(!auth.admin && !auth.write){
         res.status(REQUESTFORBIDDEN).send("token could not be authenticated");
        return;
    }

    var school_identifier = req.body.school_identifier;
    var uid = req.body.uid;
    var message = req.body.message;
    var title = req.body.title;

    if(!school_identifier){
        res.status(REQUESTBAD).send("invalid parameters: no school identifier");
        return;
    }

    if(!uid){
        res.status(REQUESTBAD).send("invalid parameters: no uid");
        return;
    }
    
    if(!message){
        res.status(REQUESTBAD).send("invalid parameters: no message");
        return;
    }

    
    if(!title){
        res.status(REQUESTBAD).send("invalid parameters: no title");
        return;
    }


    sendNotificationToUser(message, title, uid, school_identifier);

    res.status(REQUESTSUCCESSFUL).send("notification sent");

});

function sendNotificationToUser(message, title, uid, school_identifier) {

    console.log("Send notification to " + uid + " || " + school_identifier);
    
    databaseref.child('schools/' + school_identifier + '/users/' + uid + '/notification_tokens').once('value').then(function(snapshot){
        
            console.log("Notification tokens: " + snapshot.val());
        
            if(snapshot.val()) {
                
                for (var notification_id in snapshot.val()) {

                    console.log("Notification id: " + notification_id);
                    
                    sendNotification(message, title, notification_id);
                }
            }
        })
    
}

// This is a function which sends notifications to multiple devices
function sendNotification(message, title, recipient) {

  console.log("Sending notification");

  request(
    {
      method: 'POST',
      uri: 'https://fcm.googleapis.com/fcm/send',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'key=AAAAPOKlPuE:APA91bEFvSBMpS_5pb8_1GRQAZGgnVLhyKF5RTG5zk-sGBPKm0XRnvNw_J0hhmdJ7Yyidjksgfux3O8-V69k3LDOeFgqP94AEL5uM7lm1fl_mgTtUyCKR-x4H9-qmth4IG1aIVtShxtT'
      },
      body: JSON.stringify({
        "to": recipient,
        "priority": "high",
        "notification" : {
          "body" : message,
          "title": title,
          "sound": "default",
          "badge": 1
        }
      })
    },
    function (error, response, body) {
      if(response.statusCode == 200){

        console.log('Success');
      } else {
        console.log('error: '+ response.statusCode);
      }
    }
  )
}

//***************VERIFICATION HANDLERS*************//

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

app.post('/api/request_verification', function(req, res){
    var token = req.query.token;

    var auth = authenticateToken(token);
    if(!auth.admin && !auth.write){
         res.status(REQUESTFORBIDDEN).send("token could not be authenticated");
        return;
    }

    var school = req.body['school_identifier'];
    if(!school){
        res.status(REQUESTBAD).send("invalid parameters: no domain");
        return;
    }

    var email = req.body['email'];
    if(!email){
        res.status(REQUESTBAD).send("invalid parameters: no email");
        return;
    }

    var uid = req.body['uid'];
    if(!uid){
        res.status(REQUESTBAD).send("invalid parameters: no uid");
        return;
    }

    databaseref.child('schools').child(school).child('users').child(uid).child('email').set(email);
    
    sendVerificationEmail(email, uid, school, res);
});

function verifyUser(school, uid, hash, res){
    databaseref.child('schools').child(school).child('users').child(uid).once('value').then(function(snapshot){
        var user = snapshot.val();
        if(user){
            var userhash = user.hash;
            if(userhash || user.verified == true){
                if(userhash == hash || user.verified == true){
                    databaseref.child('schools').child(school).child('users').child(uid).child('verified').set(true);
                    databaseref.child('schools').child(school).child('users').child(uid).child('hash').remove();
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

function sendVerificationEmail(email, uid, domain, res){
    
    console.log("Verify: " + email + ", " + domain + ", " + uid);
    
    if(!emailverificationtemplate){
        setTimeout(() => sendVerificationEmail(email, uid), 3000);
    }else{
        var hash = TokenGenerator.generate();
        databaseref.child('schools').child(domain).child('users').child(uid).once('value').then(function(snapshot){
            var user = snapshot.val();
            if(user){
                
                console.log("User exists");
                
                databaseref.child('schools').child(domain).child('users').child(uid).child('hash').set(hash);

                var verifyurl = WEBSITE + '/api/verify?domain=' + domain + '&uid=' + uid + '&token=' + '34c27dF4ad7X72' + "&hash=" + hash;
                var mailOptions = {
                    from: '"Walla" <wallanoreply@aol.com>', // sender address
                    to: email, // list of receivers
                    subject: 'Verify email', // Subject line
                    html: emailverificationtemplate.replace(/verify-url-here/, verifyurl)
                };

            transporter.sendMail(mailOptions, function(error, info){
                if(error){
                    console.log(error);
                    res.status(REQUESTBAD).send(error);
                    return
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

app.get('/api/get_user_verified', function(req, res){
    var token = req.query.token;

    var auth = authenticateToken(token);
    if(!auth.admin && !auth.read){
         res.status(REQUESTFORBIDDEN).send("token could not be authenticated");
        return;
    }

    incrementTokenCalls(token);

    var school_identifier = req.query.school_identifier;
    var uid = req.query.uid;

    if(!uid){
        res.status(REQUESTBAD).send("invalid parameters: no uid");
        return;
    }

    if(!school_identifier){
        res.status(REQUESTBAD).send("invalid parameters: no school identifier");
        return;
    }

    databaseref.child('schools/' + school_identifier + '/users/' + uid + '/verified').once('value').then(function(snapshot){
            console.log("get_user_verified: " + snapshot.val());
            if(snapshot.val() != null)
                res.status(REQUESTSUCCESSFUL).send({verified: snapshot.val()});
            else
                res.status(REQUESTSUCCESSFUL).send({});
        })
        .catch(function(error){
            res.status(REQUESTBAD).send(error);
            console.log(error);
    });

});

//***************FLAG HANDLERS*************//

app.post('/api/flag_activity', function(req, res){
    var token = req.query.token;

    var auth = authenticateToken(token);
    if(!auth.admin && !auth.write){
         res.status(REQUESTFORBIDDEN).send("token could not be authenticated");
        return;
    }

    var school_identifier = req.body['school_identifier'];
    if(!school_identifier){
        res.status(REQUESTBAD).send("invalid parameters: no school identifier");
        return;
    }

    var auid = req.body['auid'];
    if(!auid){
        res.status(REQUESTBAD).send("invalid parameters: no event key");
        return;
    }

    var uid = req.body['uid'];
    if(!uid){
        res.status(REQUESTBAD).send("invalid parameters: no uid");
        return;
    }
  
    databaseref.child("schools").child(school_identifier).child("flagged_activities").child(auid).child(uid).set(new Date().getTime() / 1000);
    
    res.status(REQUESTSUCCESSFUL).send("activity flagged");
});

//***************OLD*************//

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


function scriptToSetActivitiesPostTime(){
        
    return Promise.all(Object.keys(domains).map((school, i) => {

        return databaseref.child('schools').child(school).child('activities').transaction(activities => {
            if (!activities) return activities;
            Object.keys(activities).map(aid => {
                activities[aid].timePosted = activities[aid].start_time;
            });
            return activities;
        });

    }));
}

function logUserSession(uid, guid, start, end) {
    var monthKey = moment(start).format("YYYY-MM");
    var weekKey = moment(start).format("YYYY-WW");
    var dayKey = moment(start).format("YYYY-MM-DD");
    var hourKey = moment(start).format("YYYY-MM-DD-HH");
    var duration =moment(end).diff(start, 'seconds');

    var sessionsLog = databaseref.child('sessions_log');
    var totalSessionsRef = sessionsLog.child('total_sessions');
    var totalSecondsRef = sessionsLog.child('total_seconds');

    var sessionsThisMonth = {
        sessions: sessionsLog.child('sessions_by_month').child(monthKey).child('sessions').child(uid.toString()),
        groups: guid ? sessionsLog.child('sessions_by_month').child(monthKey).child('groups').child(guid.toString()) : null
    };
    var sessionsThisDay = {
        sessions: sessionsLog.child('sessions_by_day').child(dayKey).child('sessions').child(uid.toString()),
        groups: guid ? sessionsLog.child('sessions_by_day').child(dayKey).child('groups').child(guid.toString()) : null
    };
    var sessionsThisHour = {
        sessions: sessionsLog.child('sessions_by_hour').child(hourKey).child('sessions').child(uid.toString()),
        groups: guid ? sessionsLog.child('sessions_by_hour').child(hourKey).child('groups').child(guid.toString()) : null
    };

    const pushDuration = arr => {
        arr = arr || [];
        arr.push(duration);
        return arr;
    };

    var promises = [];

    promises.push(totalSessionsRef.transaction(total => ++total));
    promises.push(totalSecondsRef.transaction(s => s += duration));
    promises.push(sessionsThisMonth.sessions.transaction(pushDuration));
    promises.push(sessionsThisDay.sessions.transaction(pushDuration));
    promises.push(sessionsThisHour.sessions.transaction(pushDuration));

    if (guid)  {
        promises.push(sessionsThisMonth.groups.transaction(pushDuration));
        promises.push(sessionsThisDay.groups.transaction(pushDuration));
        promises.push(sessionsThisHour.groups.transaction(pushDuration));
    }
    
    return Promise.all(promises);
}

// app.get('/logsession', (req, res) =>  {
//     var data = req.query.data;
//     var arr = data.split(',');
//     logUserSession(arr[0], arr[1], arr[2], arr[3]).then(() => res.send(200), () => res.send(500));
// });

// app.get('/removeall', (req, res) =>  {
//     databaseref.child('sessions_log').set({});
//     res.send(200);
// });

// app.get('/all', (req, res) =>  {
//     databaseref.child('sessions_log').once('value')
//     .then(snapshot => {
//         // fs.writeFileSync('sessions.json', JSON.stringify(snapshot.val()));
//         res.json(snapshot.val());
//     });
// });

app.get('/api/get_dashboard_events_data', function(req, res) {
    // var token = req.query.token;

    // var auth = authenticateToken(token);
    // if(!auth.admin){
    //     res.status(REQUESTFORBIDDEN).send("token could not be authenticated");
    //     return;
    // }

    // incrementTokenCalls(token);

    var school_identifier = req.query['school_identifier'],
        selected_date = moment(req.query['date']).startOf('day').toDate();

    if (!school_identifier) school_identifier = 'duke'; //for tests only

    if(!school_identifier){
        res.status(REQUESTBAD).send("invalid parameters: no school identifier");
        return;
    }

    var schoolRef = databaseref.child('schools').child(school_identifier);
    var getSchoolActivities = schoolRef.child('activities').once('value');
    var getSchoolGroups = schoolRef.child('groups').once('value');
    var getSchoolUsers = schoolRef.child('users').once('value');

    Promise.all([getSchoolActivities, getSchoolGroups, getSchoolUsers]).then(values => {
        var schoolActivities = values[0].val();
        var schoolGroups = values[1].val();
        var schoolUsers = values[2].val();

        const interests = [];
        let totalPlanningTime = 0;


        const hourFormat = 'YYYY-MM-DD-HH';
        const dayFormat = 'YYYY-MM-DD';
        const monthFormat = 'YYYY-MM';

        const dayLabel = 'h:00 A';
        const weekLabel = 'MMM. D, YYYY [-] dddd';
        const monthLabel = 'MMM. D, YYYY';
        const yearLabel = 'MMM. YYYY';

        //event posting over time

        const events_posting_over_time = {
            by_hours: {},
            by_days: {},
            by_months: {}
        };

        const events_time_over_time = {
            by_hours: {},
            by_days: {},
            by_months: {}
        };

        const events_attendance_over_time = {
            by_hours: {},
            by_days: {},
            by_months: {}
        };

        const usersRelatedToActivities = [];

        Object.keys(schoolActivities).map(k => schoolActivities[k])
        .forEach(a => {
            if ((a.interests || []).length)
                for(let i = 0; i < a.interests.length; i++)
                    interests.push(a.interests[i]);

            const postedAt = moment(a.timePosted * 1000);
            const eventAt = moment(a.start_time * 1000);

            totalPlanningTime += eventAt.diff(postedAt, 'seconds');

            const hourPostingLabel = postedAt.format(hourFormat);
            const dayPostingLabel = postedAt.format(dayFormat);
            const monthPostingLabel = postedAt.format(monthFormat);

            const hourEventLabel = eventAt.format(hourFormat);
            const dayEventLabel = eventAt.format(dayFormat);
            const monthEventLabel = eventAt.format(monthFormat);

            events_posting_over_time.by_hours[hourPostingLabel] = (events_posting_over_time.by_hours[hourPostingLabel] || 0) + 1;
            events_posting_over_time.by_days[dayPostingLabel] = (events_posting_over_time.by_days[dayPostingLabel] || 0) + 1;
            events_posting_over_time.by_months[monthPostingLabel] = (events_posting_over_time.by_months[monthPostingLabel] || 0) + 1;

            events_time_over_time.by_hours[hourEventLabel] = (events_time_over_time.by_hours[hourEventLabel] || 0) + 1;
            events_time_over_time.by_days[dayEventLabel] = (events_time_over_time.by_days[dayEventLabel] || 0) + 1;
            events_time_over_time.by_months[monthEventLabel] = (events_time_over_time.by_months[monthEventLabel] || 0) + 1;

            if (a.replies) {
                const attendees = Object.keys(a.replies).map(k => a.replies[k]).filter(r => r === 'going').length;

                events_attendance_over_time.by_hours[hourEventLabel] = (events_attendance_over_time.by_hours[hourEventLabel] || 0) + attendees;
                events_attendance_over_time.by_days[dayEventLabel] = (events_attendance_over_time.by_days[dayEventLabel] || 0) + attendees;
                events_attendance_over_time.by_months[monthEventLabel] = (events_attendance_over_time.by_months[monthEventLabel] || 0) + attendees;
            }

            const replies = a.replies ||  {};
            Object.keys(replies).filter(k => replies[k] === 'going')
                    .forEach(k => usersRelatedToActivities.push(k));

            if (a.host_group) {
                const actGroup = schoolGroups[a.host_group];
                if (actGroup && actGroup.members) {
                    Object.keys(actGroup.members).forEach(k => usersRelatedToActivities.push(k));
                }
            } else {
                usersRelatedToActivities.push(a.host);
            }
        });

        const academic_levels = [];
        const graduation_years = [];
        let majors = [];

        _.uniq(usersRelatedToActivities).map(k => schoolUsers[k]).forEach(u => {
            if (!u) return;
            if (['grad', 'undergrad'].includes(u.academic_level))
                academic_levels.push(u.academic_level);
            
            if (u.graduation_year)
                graduation_years.push(u.graduation_year);

            if (u.major)
                majors.push(u.major);
        });



        //grad/undergrad chart
        var countGradUndergrad = _.countBy(academic_levels);
        var grad_undergrad_chart = [countGradUndergrad['grad'], countGradUndergrad['undergrad']];

        //grad_year chart
        var countGradYear = _.countBy(graduation_years);
        var years = Object.keys(countGradYear).sort();
        var grad_year_chart = {
            years: years,
            data: years.map(y => countGradYear[y])
        };

        //fields of study
        const majorMaps = {
            'cs': 'computer science',
            'compsci': 'computer science',
            'econ': 'economics',
            'gh': 'global health',
            'neuro': 'neuroscience',
            'public policy studies': 'public policy',
            'statz': 'statistics',
            'tbd': 'undecided'
        };
        majors = _.flatten(majors.map(m => m.toLowerCase().trim().split(/(?:[+,\/]|and)+/).map(s => s.trim())));
        majors = majors.map(m => (majorMaps[m] || m).split(' ').map(w => w.split('').map((l, i) => i === 0 ? l.toUpperCase() : l).join('')).join(' '));
        var countMajors = _.countBy(majors);
        var fields_of_study_chart = _.chain(countMajors).map((count, major) => Object({
            word: major,
            count: count
        })).sortBy('count').value().map((obj, i) => Object({
            word: obj.word,
            count: i + 1
        }));

        // events avg planning time

        const events_avg_planning_time = Math.round(totalPlanningTime / Object.keys(schoolActivities).length);

        // free food events

        var countInterests = _.countBy(interests);
        var free_food_events_chart = [countInterests['Free Food'], interests.length - countInterests['Free Food']];


        // event time/event posting time over time

        const getChartData = obj => {
            // by day
            
            const selected_day_hours = Object.keys(obj.by_hours).sort()
            // filter 'by hours' sessions using the selected day
            .filter(k => moment(k, hourFormat).startOf('day').diff(selected_date, 'days') === 0);

            const events_by_day = [];
            for (let h = 0; h <= 23; h++) {
                const label = moment(selected_date).hours(h).format(dayLabel);
                const currentHourThisDay = selected_day_hours.filter(k => moment(k, hourFormat).hour() === h)[0];
                if (!currentHourThisDay) {
                    events_by_day.push({
                        label,
                        count: 0
                    });
                } else {
                    events_by_day.push({
                        label,
                        count: obj.by_hours[currentHourThisDay]
                    });
                }
            }

            // by week

            const startOfWeek = moment(selected_date).startOf('week');
            const endOfWeek = moment(selected_date).endOf('week');

            const selected_week_days = Object.keys(obj.by_days).sort()
            // filter 'by days' sessions using the selected day
            .filter(k => moment(k, dayFormat).isBetween(startOfWeek, endOfWeek, null, '[]'));

            const events_by_week = [];
            for (let d = 0; d <= 6; d++) {
                const label = moment(startOfWeek).add(d, 'days').format(weekLabel);
                const currentDayThisWeek = selected_week_days.filter(k => moment(k, dayFormat).weekday() === d)[0];
                if (!currentDayThisWeek) {
                    events_by_week.push({
                        label,
                        count: 0
                    });
                } else {
                    events_by_week.push({
                        label,
                        count: obj.by_days[currentDayThisWeek]
                    });
                }
            }

            // by month

            const startOfMonth = moment(selected_date).startOf('month');
            const endOfMonth = moment(selected_date).endOf('month');
            const numOfDaysInMonth = moment(selected_date).daysInMonth();

            const selected_month_days = Object.keys(obj.by_days).sort()
            // filter 'by days' sessions using the selected day
            .filter(k => moment(k, dayFormat).isBetween(startOfMonth, endOfMonth, null, '[]'));


            const events_by_month = [];
            for (let d = 1; d <= numOfDaysInMonth; d++) {
                const label = moment(startOfMonth).add(d - 1, 'days').format(monthLabel);
                const currentDayThisMonth = selected_month_days.filter(k => moment(k, dayFormat).date() === d)[0];
                
                if (!currentDayThisMonth) {
                    events_by_month.push({
                        label,
                        count: 0
                    });
                } else {
                    events_by_month.push({
                        label,
                        count: obj.by_days[currentDayThisMonth]
                    });
                }
            }


            // by year

            const startOfYear = moment(selected_date).startOf('year');
            const endOfYear = moment(selected_date).endOf('year');

            const selected_year_months = Object.keys(obj.by_months).sort()
            // filter 'by days' sessions using the selected day
            .filter(k => moment(k, monthFormat).isBetween(startOfYear, endOfYear, null, '[]'));

            const events_by_year = [];
            for (let m = 0; m <= 11; m++) {
                const label = moment(startOfYear).add(m, 'months').format(yearLabel);
                const currentMonthThisYear = selected_year_months.filter(k => moment(k, monthFormat).month() === m)[0];
                if (!currentMonthThisYear) {
                    events_by_year.push({
                        label,
                        count: 0
                    });
                } else {
                    events_by_year.push({
                        label,
                        count: obj.by_months[currentMonthThisYear]
                    });
                }
            }

            return {
                by_day: events_by_day,
                by_week: events_by_week,
                by_month: events_by_month,
                by_year: events_by_year
            };

            
        };

        res.status(REQUESTSUCCESSFUL).send({
            free_food_events_chart,
            events_posting_over_time: getChartData(events_posting_over_time),
            events_time_over_time: getChartData(events_time_over_time),
            events_attendance_over_time: getChartData(events_attendance_over_time),
            events_avg_planning_time,
            events_by_audience: {
                grad_undergrad_chart,
                grad_year_chart,
                fields_of_study_chart
            }
        });
    });

});


app.get('/api/get_dashboard_users_data', function(req, res) {
    // var token = req.query.token;

    // var auth = authenticateToken(token);
    // if(!auth.admin){
    //     res.status(REQUESTFORBIDDEN).send("token could not be authenticated");
    //     return;
    // }

    // incrementTokenCalls(token);

    var guid = req.query['guid'], school_identifier = req.query['school_identifier'],
        selected_date = moment(req.query['date']).startOf('day').toDate();

    if (!school_identifier) school_identifier = 'duke'; //for tests only

    if(!school_identifier){
        res.status(REQUESTBAD).send("invalid parameters: no school identifier");
        return;
    }

    var getSchool = databaseref.child('schools').child(school_identifier).once('value');
    var getAllUsers = databaseref.child('users').once('value');
    var getSessionsLog = databaseref.child('sessions_log').once('value');    
    var getSchoolActivities = databaseref.child('schools').child(school_identifier).child('activities').once('value');;

    Promise.all([getSchool, getAllUsers, getSessionsLog, getSchoolActivities]).then(values => {
        var selectedSchool = values[0].val();
        //count of users from all schools
        var unique_users = values[1].numChildren();
        //sessions
        var sessions_log = values[2].val() ||  {};
        //school activities
        var schoolActivities = values[3].val();
        //count users from selected school
        var schoolUserCount = Object.keys(selectedSchool.users || {}).length;
        //Percentage of users who belongs to the selected school
        var percent_school_population = (schoolUserCount / unique_users * 100).toFixed(2);
        
        //if a school is selected, get all it's users with academic_level set, filtering by group membership, when selected
        var group = guid ? selectedSchool.groups[guid] : {};
        var filteredUsers = users = Object.keys(selectedSchool.users || {}).map(k => selectedSchool.users[k]).filter(u => {
            if (!guid) return true;
            return group.members && groups.members[u.user_id];
        });

        var academic_levels = [];
        var graduation_years = [];
        var majors = [];
        var interests = [];

        filteredUsers.forEach(u => {
            if (['grad', 'undergrad'].includes(u.academic_level))
                academic_levels.push(u.academic_level);
            
            if (u.graduation_year)
                graduation_years.push(u.graduation_year);
                
            if ((u.interests || []).length)
                for(let i = 0; i < u.interests.length; i++)
                    interests.push(u.interests[i]);

            if (u.major)
                majors.push(u.major);
        });

        const groups_hosting = [];
        Object.keys(schoolActivities ||  {}).map(k => schoolActivities[k]).forEach(a => {
            if (a.host_group) {
                groups_hosting.push(a.host_group);
            }
        });

        //avg hosted events by groups
        const avg_hosted_events_by_group = Math.round(groups_hosting.length / _.unique(groups_hosting).length);

        //grad/undergrad chart
        var countGradUndergrad = _.countBy(academic_levels);
        var grad_undergrad_chart = [countGradUndergrad['grad'], countGradUndergrad['undergrad']];

        //grad_year chart
        var countGradYear = _.countBy(graduation_years);
        var years = Object.keys(countGradYear).sort();
        var grad_year_chart = {
            years: years,
            data: years.map(y => countGradYear[y])
        };

        //self reported interests
        var countInterests = _.countBy(interests);
        interests = _.uniq(interests.sort(), true);
        var self_reported_interests_chart = {
            interests: interests,
            data: interests.map(i => countInterests[i])
        };

        //fields of study
        const majorMaps = {
            'cs': 'computer science',
            'compsci': 'computer science',
            'econ': 'economics',
            'gh': 'global health',
            'neuro': 'neuroscience',
            'public policy studies': 'public policy',
            'statz': 'statistics',
            'tbd': 'undecided'
        };
        majors = _.flatten(majors.map(m => m.toLowerCase().trim().split(/(?:[+,\/]|and)+/).map(s => s.trim())));
        majors = majors.map(m => (majorMaps[m] || m).split(' ').map(w => w.split('').map((l, i) => i === 0 ? l.toUpperCase() : l).join('')).join(' '));
        var countMajors = _.countBy(majors);
        var fields_of_study_chart = _.chain(countMajors).map((count, major) => Object({
            word: major,
            count: count
        })).sortBy('count').value().map((obj, i) => Object({
            word: obj.word,
            count: i + 1
        }));


        //sessions over time

        const hourFormat = 'YYYY-MM-DD-HH';
        const dayFormat = 'YYYY-MM-DD';
        const monthFormat = 'YYYY-MM';

        const dayLabel = 'h:00 A';
        const weekLabel = 'MMM. D, YYYY [-] dddd';
        const monthLabel = 'MMM. D, YYYY';
        const yearLabel = 'MMM. YYYY';

        // by day
        
        const selected_day_hours = Object.keys(sessions_log.sessions_by_hour ||  {}).sort()
        // filter 'by hours' sessions using the selected day
        .filter(k => moment(k, hourFormat).startOf('day').diff(selected_date, 'days') === 0);

        const sessions_by_day = [];
        for (let h = 0; h <= 23; h++) {
            const label = moment(selected_date).hours(h).format(dayLabel);
            const currentHourThisDay = selected_day_hours.filter(k => moment(k, hourFormat).hour() === h)[0];
            if (!currentHourThisDay) {
                sessions_by_day.push({
                    label,
                    count: 0
                });
            } else {
                sessions_by_day.push({
                    label,
                    count: Object.keys((sessions_log.sessions_by_hour ||  {})[currentHourThisDay][guid ? 'groups' : 'sessions'] || {}).length
                });
            }
        }

        // by week

        const startOfWeek = moment(selected_date).startOf('week');
        const endOfWeek = moment(selected_date).endOf('week');

        const selected_week_days = Object.keys(sessions_log.sessions_by_day ||  {}).sort()
        // filter 'by days' sessions using the selected day
        .filter(k => moment(k, dayFormat).isBetween(startOfWeek, endOfWeek, null, '[]'));

        const sessions_by_week = [];
        for (let d = 0; d <= 6; d++) {
            const label = moment(startOfWeek).add(d, 'days').format(weekLabel);
            const currentDayThisWeek = selected_week_days.filter(k => moment(k, dayFormat).weekday() === d)[0];
            if (!currentDayThisWeek) {
                sessions_by_week.push({
                    label,
                    count: 0
                });
            } else {
                sessions_by_week.push({
                    label,
                    count: Object.keys((sessions_log.sessions_by_day ||  {})[currentDayThisWeek][guid ? 'groups' : 'sessions'] || {}).length
                });
            }
        }

        // by month

        const startOfMonth = moment(selected_date).startOf('month');
        const endOfMonth = moment(selected_date).endOf('month');
        const numOfDaysInMonth = moment(selected_date).daysInMonth();

        const selected_month_days = Object.keys(sessions_log.sessions_by_day ||  {}).sort()
        // filter 'by days' sessions using the selected day
        .filter(k => moment(k, dayFormat).isBetween(startOfMonth, endOfMonth, null, '[]'));


        const sessions_by_month = [];
        for (let d = 1; d <= numOfDaysInMonth; d++) {
            const label = moment(startOfMonth).add(d - 1, 'days').format(monthLabel);
            const currentDayThisMonth = selected_month_days.filter(k => moment(k, dayFormat).date() === d)[0];
            
            if (!currentDayThisMonth) {
                sessions_by_month.push({
                    label,
                    count: 0
                });
            } else {
                sessions_by_month.push({
                    label,
                    count: Object.keys((sessions_log.sessions_by_day ||  {})[currentDayThisMonth][guid ? 'groups' : 'sessions'] || {}).length
                });
            }
        }


        // by year

        const startOfYear = moment(selected_date).startOf('year');
        const endOfYear = moment(selected_date).endOf('year');

        const selected_year_months = Object.keys(sessions_log.sessions_by_month ||  {}).sort()
        // filter 'by days' sessions using the selected day
        .filter(k => moment(k, monthFormat).isBetween(startOfYear, endOfYear, null, '[]'));

        const sessions_by_year = [];
        for (let m = 0; m <= 11; m++) {
            const label = moment(startOfYear).add(m, 'months').format(yearLabel);
            const currentMonthThisYear = selected_year_months.filter(k => moment(k, monthFormat).month() === m)[0];
            if (!currentMonthThisYear) {
                sessions_by_year.push({
                    label,
                    count: 0
                });
            } else {
                sessions_by_year.push({
                    label,
                    count: Object.keys((sessions_log.sessions_by_month ||  {})[currentMonthThisYear][guid ? 'groups' : 'sessions'] || {}).length
                });
            }
        }

        //daily active users
        const total_days = Object.keys(sessions_log.sessions_by_day ||  {}).length;
        const total_unique_sessions = Object.keys(sessions_log.sessions_by_day ||  {})
                            .map(k => Object.keys((sessions_log.sessions_by_day ||  {})[k].sessions).length)
                            .reduce((prev, cur) => prev + cur, 0);
                            
        const daily_active_users = Math.round(total_unique_sessions / total_days);


        //active groups
        const schoolGroups = selectedSchool.groups || {};
        
        //count groups with at least one member and count members from groups of selected school
        let active_groups = 0, schoolMemberCount = 0;
        Object.keys(schoolGroups).forEach(k => {
            const memberCount = Object.keys(schoolGroups[k].members || {}).length;
            if (memberCount) {
                active_groups++;
                schoolMemberCount += memberCount;
            }
        });

        const avg_group_size = Math.round(active_groups === 0 ? 0 : schoolMemberCount / active_groups);


        //total number of sessions
        const total_number_sessions = sessions_log.total_sessions;
        const avg_session_duration = Math.round(sessions_log.total_seconds / total_number_sessions);
        
        res.status(REQUESTSUCCESSFUL).send({
            unique_users,
            percent_school_population,
            daily_active_users,
            total_number_sessions,
            avg_session_duration,
            grad_undergrad_chart,
            grad_year_chart,
            self_reported_interests_chart,
            fields_of_study_chart,
            sessions_by_day,
            sessions_by_week,
            sessions_by_month,
            sessions_by_year,
            active_groups,
            avg_group_size,
            avg_hosted_events_by_group
        });
    });
});

// wrap commented code in function to be able to collapse it
function commentedCode() {
    
    // app.get('/api/get_dashboard_data', function(req, res) {
    //     // var token = req.query.token;

    //     // var auth = authenticateToken(token);
    //     // if(!auth.admin){
    //     //     res.status(REQUESTFORBIDDEN).send("token could not be authenticated");
    //     //     return;
    //     // }

    //     // incrementTokenCalls(token);

    //     var school_identifier = req.query['school_identifier'];

    //     if (!school_identifier) school_identifier = 'duke'; //for tests only

    //     if(!school_identifier){
    //         res.status(REQUESTBAD).send("invalid parameters: no school identifier");
    //         return;
    //     }

    //     var dt = new Date().getTime();
    //     databaseref.child('schools').child(school_identifier).once('value').then(function(snapshot) {
    //         var selectedSchool = snapshot.val();
    //         var schoolGroups = selectedSchool.groups || {};
    //         databaseref.child('users').once('value').then(function(snapshot) {
    //             var userCount = snapshot.numChildren();
    //             //count users from selected school
    //             var schoolUserCount = Object.keys(selectedSchool.users || {}).length;
    //             //Percentage of users who belongs to the selected school
    //             var percentSchoolPopulation = (schoolUserCount / userCount * 100).toFixed(2);
    //             //count groups with at least one member and count members from groups of selected school
    //             var schoolActiveGroups = 0, schoolMemberCount = 0;
    //             for (var k in schoolGroups) {
    //                 if (schoolGroups.hasOwnProperty(k)) {
    //                     var memberCount = Object.keys(schoolGroups[k].members || {}).length;
    //                     if (memberCount) {
    //                         schoolActiveGroups++;
    //                         schoolMemberCount += memberCount;
    //                     }
    //                 }
    //             }
                
    //             //avg grup size
    //             var avgGroupSize = (schoolActiveGroups === 0 ? 0 : schoolMemberCount / schoolActiveGroups).toFixed(2);
                
    //             res.status(REQUESTSUCCESSFUL).send({
    //                 unique_users: userCount,
    //                 percent_school_population: percentSchoolPopulation,
    //                 //active_users
    //                 active_groups: schoolActiveGroups,
    //                 //avg_hosted_events_by_groups
    //                 avg_group_size: avgGroupSize
    //             });
    //         });
    //     });
    // });
    // app.get('/api/clear_session_history', function(req, res) {
    //     var sessionsLog = databaseref.child('sessions_log');
    //     sessionsLog.set({});
    //     sessionsLog.once('value').then(s => res.json(s.val()));
    // });
    // app.get('/api/create_session_history', function(req, res) {
    //     // var token = req.query.token;

    //     // var auth = authenticateToken(token);
    //     // if(!auth.admin){
    //     //     res.status(REQUESTFORBIDDEN).send("token could not be authenticated");
    //     //     return;
    //     // }

    //     // incrementTokenCalls(token);

    //     // logUserSession(111);
    //     // res.send(200);
    //     // var sessionsLog = databaseref.child('sessions_log');
    //     // sessionsLog.set({});
    //     // sessionsLog.once('value').then(s => res.json(s.val()));


    //     const range = function(min, max) {
    //         return Math.floor(Math.random() * (max - min + 1)) + min;
    //     };

    //     var promises = [];

    //     for (var i = 0; i < 1; i++) {
    //         var uid = range(1, 500);
    //         var guid = range(-500, 500);
    //         if (guid <= 0) guid = null;
    //         var startDate = moment().subtract(6, 'months');
    //         var randDays = range(0, startDate.diff(moment(), 'days'));
    //         var hourNow = +moment().format("HH") * -1;
    //         var randHours = range(hourNow, 24 - hourNow);
    //         startDate.add(randDays, 'days');
    //         startDate.add(randHours, 'hours');
    //         var duration = range(15, 3600 * 3);
    //         var endDate = moment(startDate).add(duration, 'seconds');
    //         promises.push(logUserSession(uid, guid, startDate.toDate(), endDate.toDate()));
    //     }


    //     // Promise.each(promises, p => p)
    //     promises[0].then(() => {
    //         databaseref.child('sessions_log').once('value').then(s => res.json(s.val()));
    //     });
    // });
    // app.get('/api/get_grad_undergrad_chart_data', function(req, res) {
    //     // var token = req.query.token;

    //     // var auth = authenticateToken(token);
    //     // if(!auth.admin){
    //     //     res.status(REQUESTFORBIDDEN).send("token could not be authenticated");
    //     //     return;
    //     // }

    //     // incrementTokenCalls(token);

    //     var guid, school_identifier = req.query['school_identifier'];
    //     if (school_identifier)
    //         guid = req.query['guid'];


    //     var ref = databaseref.child('schools');
    //     if (school_identifier)
    //         ref = ref.child(school_identifier);

    //     console.log(school_identifier, guid);

    //     ref.once('value').then(function(snapshot) {
    //         var data = snapshot.val();
    //         var users = [];
    //         if (school_identifier) {
    //             //if a school is selected, get all it's users with academic_level set, filtering by group membership, when selected
    //             var group = guid ? data.groups[guid] : {};
    //             users = Object.keys(data.users).map(k => data.users[k]).filter(u => {
    //                 if (!u.academic_level) return false;
    //                 if (!guid) return true;
    //                 return group.members && groups.members[u.user_id];
    //             })
    //         } else {
    //             //if no schools are selected, just get all users from all schools with academic_level set
    //             users = [].concat.apply([], Object.keys(data).map(k => {
    //                 var users = data[k].users;
    //                 return Object.keys(users).map(k => users[k]).filter(u => u.academic_level);
    //             }));
    //         }
    //         var grad = 0, undergrad = 0;    
    //         users.forEach(u => {
    //             if (u.academic_level === 'grad')
    //                 grad++;
    //             else if (u.academic_level === 'undergrad')
    //                 undergrad++;
    //         });
            
    //         res.status(REQUESTSUCCESSFUL).send([grad, undergrad]);
    //     });
    // });

    // app.get('/api/get_grad_year_chart_data', function(req, res) {
    //     // var token = req.query.token;

    //     // var auth = authenticateToken(token);
    //     // if(!auth.admin){
    //     //     res.status(REQUESTFORBIDDEN).send("token could not be authenticated");
    //     //     return;
    //     // }

    //     // incrementTokenCalls(token);

    //     var guid, school_identifier = req.query['school_identifier'];
    //     if (school_identifier)
    //         guid = req.query['guid'];


    //     var ref = databaseref.child('schools');
    //     if (school_identifier)
    //         ref = ref.child(school_identifier);

    //     ref.once('value').then(function(snapshot) {
    //         var data = snapshot.val();
    //         var users = [];
    //         if (school_identifier) {
    //             //if a school is selected, get all it's users with graduation_year set, filtering by group membership, when selected
    //             var group = guid ? data.groups[guid] : {};
    //             users = Object.keys(data.users).map(k => data.users[k]).filter(u => {
    //                 if (!u.graduation_year) return false;
    //                 if (!guid) return true;
    //                 return group.members && groups.members[u.user_id];
    //             })
    //         } else {
    //             //if no schools are selected, just get all users from all schools with graduation_year set
    //             users = [].concat.apply([], Object.keys(data).map(k => {
    //                 var users = data[k].users;
    //                 return Object.keys(users).map(k => users[k]).filter(u => u.graduation_year);
    //             }));
    //         }
    //         var countGradYear = _.countBy(users, 'graduation_year');
    //         var years = Object.keys(countGradYear).sort();
            
    //         res.status(REQUESTSUCCESSFUL).send({
    //             years: years,
    //             data: years.map(y => countGradYear[y])
    //         });
    //     });
    // });

    // app.get('/api/get_self_reported_interests_chart_data', function(req, res) {
    //     // var token = req.query.token;

    //     // var auth = authenticateToken(token);
    //     // if(!auth.admin){
    //     //     res.status(REQUESTFORBIDDEN).send("token could not be authenticated");
    //     //     return;
    //     // }

    //     // incrementTokenCalls(token);

    //     var guid, school_identifier = req.query['school_identifier'];
    //     if (school_identifier)
    //         guid = req.query['guid'];


    //     var ref = databaseref.child('schools');
    //     if (school_identifier)
    //         ref = ref.child(school_identifier);

    //     ref.once('value').then(function(snapshot) {
    //         var data = snapshot.val();
    //         var interests = [];
    //         if (school_identifier) {
    //             //if a school is selected, get all it's users' interests
    //             var group = guid ? data.groups[guid] : {};
    //             interests = _.flatten(Object.keys(data.users).map(k => data.users[k]).filter(u => {
    //                 if (!guid) return true;
    //                 return group.members && groups.members[u.user_id];
    //             }).map(u => u.interests || []));
    //         } else {
    //             //if no schools are selected, just get all users' interests from all schools
    //             interests = _.flatten(Object.keys(data).map(k => {
    //                 var users = data[k].users;
    //                 return Object.keys(users).map(k => users[k].interests || []);
    //             }));
    //         }

    //         var countInterests = _.countBy(interests);
    //         interests = _.uniq(interests.sort(), true);
            
    //         res.status(REQUESTSUCCESSFUL).send({
    //             interests: interests,
    //             data: interests.map(i => countInterests[i])
    //         });
    //     });
    // });

    // app.get('/api/get_fields_of_study_chart_data', function(req, res) {
    //     // var token = req.query.token;

    //     // var auth = authenticateToken(token);
    //     // if(!auth.admin){
    //     //     res.status(REQUESTFORBIDDEN).send("token could not be authenticated");
    //     //     return;
    //     // }

    //     // incrementTokenCalls(token);

    //     var guid, school_identifier = req.query['school_identifier'];
    //     if (school_identifier)
    //         guid = req.query['guid'];


    //     var ref = databaseref.child('schools');
    //     if (school_identifier)
    //         ref = ref.child(school_identifier);

    //     ref.once('value').then(function(snapshot) {
    //         var data = snapshot.val();
    //         var majors = [];
    //         if (school_identifier) {
    //             //if a school is selected, get all it's users' majors
    //             var group = guid ? data.groups[guid] : {};
    //             majors = _.flatten(Object.keys(data.users).map(k => data.users[k]).filter(u => {
    //                 if (!u.major) return false;
    //                 if (!guid) return true;
    //                 return group.members && groups.members[u.user_id];
    //             }).map(u => u.major));
    //         } else {
    //             //if no schools are selected, just get all users' majors from all schools
    //             majors = _.flatten(Object.keys(data).map(k => {
    //                 var users = data[k].users;
    //                 if (!users) return [];
    //                 return Object.keys(users).map(k => users[k].major).filter(m => m);
    //             }));
    //         }

    //         const majorMaps = {
    //             'cs': 'computer science',
    //             'compsci': 'computer science',
    //             'econ': 'economics',
    //             'gh': 'global health',
    //             'neuro': 'neuroscience',
    //             'public policy studies': 'public policy',
    //             'statz': 'statistics',
    //             'tbd': 'undecided'
    //         };
    //         majors = _.flatten(majors.map(m => m.toLowerCase().trim().split(/(?:[+,\/]|and)+/).map(s => s.trim())));
    //         majors = majors.map(m => (majorMaps[m] || m).split(' ').map(w => w.split('').map((l, i) => i === 0 ? l.toUpperCase() : l).join('')).join(' '));
    //         var countMajors = _.countBy(majors);

            
    //         return res.status(REQUESTSUCCESSFUL).send(_.chain(countMajors).map((count, major) => Object({
    //             word: major,
    //             count: count
    //         })).sortBy('count').value().map((obj, i) => Object({
    //             word: obj.word,
    //             count: i + 1
    //         })));
            
    //         // return res.status(REQUESTSUCCESSFUL).send(_.chain(countMajors).map((count, major) => Object({
    //         //     word: major,
    //         //     count: count
    //         // })).value());

    //         // majors = _.chain(countMajors).map((count, major) => Object({
    //         //     major: major,
    //         //     count: count
    //         // })).sortBy('count').reverse().value().slice(0, 10).map(o => o.major).sort();

    //         // majors = _.uniq(majors.sort(), true);
            
    //         // res.status(REQUESTSUCCESSFUL).send({
    //         //     majors: majors,
    //         //     data: majors.map(i => countMajors[i])
    //         // });
    //     });
    // });


    // app.get('/api/delete_user', function(req, res) {
    //     var sid = req.query['sid'];
    //     var uid = req.query['uid'];
    //     databaseref.child('schools').child(sid).child('users').child(uid).remove();
    //     res.json(3);
    // });
    // app.get('/api/read_all_data', function(req, res) {
    //     databaseref.child('users').once('value').then(function(snapshot) {
    //         var users = snapshot.val();
    //         console.log(Object.keys(users).filter(k => k.indexOf('test123') > -1).map(k => users[k]));
    //     });
    //     res.json(2);
    //     return;
    //     var fs = require('fs');
    //     // var data = fs.readFileSync('all.json');
    //     // databaseref.child('/').set(JSON.parse(data));
    //     // res.json(2);
    //     databaseref.child('users').once('value').then(function(s) {
    //         var users = s.val();
    //         fs.writeFileSync("users.json", JSON.stringify(users));
    //         // console.log(Object.keys(users).map(k => users[k]).filter(u => u.school_identifier === 'duke').length);
    //         res.json(1);
    //     });
    // });

    // app.get('/api/fill_root_users_data', function(req, res) {
    //     var allUsers = {};
    //     databaseref.child('schools').once('value').then(function(snapshot) {
    //         var schools = snapshot.val();

    //         for (var sid in schools) {
    //             if (schools.hasOwnProperty(sid)) {
    //                 var users = schools[sid].users || {};
    //                 for (var uid in users) {
    //                     if (users.hasOwnProperty(uid)) {
    //                         var user = users[uid];
    //                         if (allUsers[uid]) {
    //                             console.log(allUsers[uid]);
    //                         }
    //                         allUsers[uid] = {
    //                             user_id: uid,
    //                             name: user.first_name + ' ' + user.last_name,
    //                             school_identifier: sid
    //                         };
    //                     }
    //                 }
    //             }
    //         }
    //         // console.log(Object.keys(allUsers).length);
    //         // databaseref.child('users').set(allUsers);
    //         res.json(1);
    //     });
    // });
}

//***************HELPER FUNCTIONS*************//

function domainAllowed(domain){
    for(key in domains){
        if(domains[key]['domain'] == domain) return true;
    }

    return false;
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
        from: '"Walla API" <wallanoreply@aol.com>', // sender address
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

/*
adminServer(function(appData) { //Initialize Admin Web Manager Api
    //Authentication
    
    var isAuthenticated = jws.isAuthenticated(appData.appAdminSecret);

    appData.appAdmin.post('/api/token', function(req, res) {
        var email = req.body['email'];
        var password = req.body['password'];

        if (!email) {
            res.status(REQUESTBAD).send("invalid parameters: no email");
            return;
        } else email = email.toLowerCase();

        if (!password) {
            res.status(REQUESTBAD).send("invalid parameters: no password");
            return;
        }

        //look for school_identifier from domains
        var school_identifier, emailDomain = email.substring(email.indexOf('@') + 1);
        for (var id in domains)
            if (domains.hasOwnProperty(id) && domains[id].domain.toLowerCase() === emailDomain)
                school_identifier = id;
            
        if (!school_identifier) {
            res.status(REQUESTBAD).send("invalid parameters: email domain not found");
            return;
        }
        
        databaseref.child('schools/' + school_identifier + '/users').once('value').then(function(snapshot) {
            var user, users = snapshot.val();
            if (users) {
                for (var id in users)
                    if (users.hasOwnProperty(id) && users[id].email.toLowerCase() === email)
                        user = users[id];
            }
            
            if (user) {
                user.token = jws.signToken(user, appData.appAdminSecret, appData.appTokenSessionTime);
                res.json(user);
            } else {
                res.status(REQUESTFORBIDDEN).send('Email not found.');
            }
        })
        .catch(function(error){
            res.status(REQUESTBAD).send(error);
            console.log(error);
        });
    });

    //Users
    
    appData.appAdmin.get('/api/users', function(req, res){
        // console.log(req.user);
        databaseref.child('app_settings/allowed_domains').once('value').then(function(snapshot){
            console.log(snapshot.val());
        });
        // databaseref.child('schools/duke/users').once('value').then(function(snapshot){
        //         var array = snapshot.val();
        //         if(array){
        //             var usersWithEmail = {};
        //             for (var id in array)
        //                 if (array.hasOwnProperty(id) && array[id].email)
        //                     usersWithEmail[id] = array[id];
        //             res.status(REQUESTSUCCESSFUL).send(usersWithEmail);
        //         }
        //         else
        //             res.status(REQUESTSUCCESSFUL).send({});
        //     })
        //     .catch(function(error){
        //         res.status(REQUESTBAD).send(error);
        //         console.log(error);
        //     });
    });
});
*/