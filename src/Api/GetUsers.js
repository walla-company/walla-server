// @flow

const app = require('../shared/Express');
const databaseref = require('../shared/Firebase');
const authentication = require('../shared/Authentication');
const result = require('../shared/RequestResult');
const tokenManager = require('../shared/TokenManager');

app.get('/api/get_users', function(req, res){
  var token = req.query.token;

  var auth = authentication.permissions(token);
  if(!authentication.admin && !authentication.write){
       res.status(result.requestforbidden).send(result.invalidtoken + ' token could not be authenticated');
      return;
  }

  tokenManager.incrementTokenCalls(token);

  var school_identifier = req.query['school_identifier'];

  if(!school_identifier){
      res.status(result.requestbad).send('invalid parameters: no school identifier');
      return;
  }

  var filter = req.query.filter;
  if (filter) filter = JSON.parse(filter);
  
  
  databaseref.child('schools').child(school_identifier).child('users').once('value').then(function(snapshot){
    let users = snapshot.val();
    filterUsers(users, filter, school_identifier).then(users => {
        res.status(result.requestsuccessful).send(users || {});
    });
}).catch(function(error){
    res.status(result.requestbad).send(error);
    console.log(error);
});


});

function filterUsers(users, filter, school_identifier) {
    return new Promise(resolve => {
        if (!users || !filter) resolve(users);

        let groupMembersId;
        return new Promise(resolveGroup => {
            if (!filter.group) resolveGroup();
            else {
                databaseref.child('schools').child(school_identifier).child('groups').child(filter.group).once('value').then(snapshot => {
                    const group = snapshot.val();
                    if (group && group.members) {
                        groupMembersId = Object.keys(group.members);
                        if (!groupMembersId.length) groupMembersId = null;
                    }
                    resolveGroup();
                });
            }
        }).then(() => {
            const tmpUsers = {};
            Object.keys(users).forEach(k => {
                const u = users[k];
                if (!u.user_id) return;

                if (!Object.keys(filter).some(field => {
                    let filterValue = filter[field];

                    if (field === 'group') {
                        return !groupMembersId || !groupMembersId.includes(u.user_id);
                    } else if (field === 'flagged') {
                        
                    }

                    let userValue = u[field];
                    if (!filterValue) return false;
                    filterValue = filterValue.toString().toLowerCase();
                    if (userValue) {
                        userValue = userValue.toString().toLowerCase();
                    } else userValue = '';
                    if (filterValue[0] === '=') {
                        filterValue = filterValue.substring(1);
                        if (!filterValue) return false;
                        return filterValue != userValue;
                    } else {
                        return userValue.indexOf(filterValue) === -1;
                    }
                })) {
                    tmpUsers[k] = u;
                }
            });

            resolve(tmpUsers);
        });
    });
}

