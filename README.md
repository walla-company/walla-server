Walla API Documentation
==============

### Params Definitions
- **token** : Caller's API authentication key

- **platform** : Operating platform the caller is requesting information on (e.g. ios, android)

- **domain** : The school or domain the user is requesting information on (e.g. sandiego-\*-edu, duke-\*-edu)

- **event** : The unique identifier for an event (e.g. -KVgTb7KDUYnsAho_bcK)

- **uid** : The unique identifier for a user (e.g. 4jAEwvyKAdMNJxS5LEG2ynC9SaY2)

- **owner** : The name to be associated with the generated information (e.g. John+Smith)

- **email** : The email to be used to send information to (e.g. johnsmith@duke.edu);

- **r** : Read access status. 1 = grant, 0 = deny (e.g. r=1)

- **w** : Write access status. 1 = grant, 0 = deny (e.g. w=1)

- **d** : Delete access status. 1 = grant, 0 = deny (e.g. d=0)

- **a** : Admin access status. 1 = grant, 0 = deny (e.g. a=1)

- **v** : Verification access status. 1 = grant, 0 = deny (e.g. v=0)

- **hash** : Hash value unique to a user that is generated to validate email verification



### Permission definitions
- **R** : Requires the auth token to have read access

- **W** : Requires the auth token to have write access

- **D** : Requires the auth token to have delete access

- **A** : Requires the auth token to have admin access

- **V** : Requires the auth token to have verification access




## Get the domains supported by Walla

- **Permissions** : R || A

- **Method** : GET

- **URL Params** : [token]

- **Sample URL** : /api/domains?token=123456789

- **Response Codes**: Success (200 OK), Bad Request (400), Unauthorized (401)




## Get the minimun version of Walla that is supported

- **Permissions** : R || A

- **Method** : GET

- **URL Params** : [token, plaform]

- **Sample URL** : /api/min_version?token=123456789&platform=android

- **Response Codes**: Success (200 OK), Bad Request (400), Unauthorized (401)




## Get an array of activities posted within the past X hours

- **Permissions** : R || A

- **Method** : GET

- **URL Params** : [token, domain, filter (optional, default = 24)]

- **Sample URL** : /api/activities?token=123456789&domain=sandiego-*-edu&filter=24

- **Response Codes**: Success (200 OK), Bad Request (400), Unauthorized (401)




## Get an array of users who are attending a specific event

- **Permissions** : R || A

- **Method** : GET

- **URL Params** : [token, domain, event]

- **Sample URL** : /api/attendees?token=123456789&domain=sandiego-*-edu&event=fht4yrt4

- **Response Codes**: Success (200 OK), Bad Request (400), Unauthorized (401)




## Get detailed information of a certain user

- **Permissions** : R || A

- **Method** : GET

- **URL Params** : [token, domain, uid]

- **Sample URL** : /api/user_info?token=123456789&domain=sandiego-*-edu&uid=84ubr73i9

- **Response Codes**: Success (200 OK), Bad Request (400), Unauthorized (401)




## Request an auth token be generated

- **Permissions** : A

- **Method** : POST

- **URL Params** : [token, owner, email, r (optional, default = 0) , w (optional, default = 0) , d (optional, default = 0) , a (optional, default = 0) , v (optional, default = 0)]

- **Sample URL** : /api/request_token?token=123456789&owner=John+Smith&email=johnsmith@gmail.com&r=1&w=1

- **Response Codes**: Success (200 OK), Bad Request (400), Unauthorized (401)




## Check if a user is attending an event

- **Permissions** : R || A

- **Method** : GET

- **URL Params** : [token, domain, event, uid]

- **Sample URL** : /api/is_attending?token=123456789&domain=sandiego-*-edu&event=fht4yrt4&uid=84ubr73i9

- **Response Codes**: Success (200 OK), Bad Request (400), Unauthorized (401)




## Report a post for not conforming to Walla community guidelines

- **Permissions** : W || A

- **Method** : POST

- **URL Params** : [token, domain, event, uid (optional)]

- **Sample URL** : /api/report_post?token=123456789&domain=sandiego-*-edu&event=fht4yrt4&uid=84ubr73i9

- **Response Codes**: Success (200 OK), Bad Request (400), Unauthorized (401)




## Send an email to verify email address

- **Permissions** : W || A

- **Method** : POST

- **URL Params** : [token, domain, uid, email]

- **Sample URL** : /api/request_verification?token=123456789&domain=sandiego-*-edu&email=johnsmith@duke.edu&uid=84ubr73i9

- **Response Codes**: Success (200 OK), Bad Request (400), Unauthorized (401)




## Verify an email address

- **Permissions** : V

- **Method** : GET

- **URL Params** : [token, domain, uid, hash]

- **Sample URL** : /api/verify?token=123456789&domain=sandiego-*-edu&uid=84ubr73i9&hash=39382058fa9b

- **Response Codes**: Success (200 OK), Bad Request (400), Unauthorized (401)




## Create activity




## Notifications




## Groups




## Suggesting Groups




## Suggesting Friends




## Display welcome message (after email verification)

- **Permissions** : none

- **Method** : GET

- **URL Params** : none

- **Sample URL** : /welcome

- **Response Codes**: Success (200 OK)
