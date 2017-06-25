// @flow

/**
 * Admin
 */

require('./Api/RequestToken');
require('./Api/AddSchool');
require('./Api/AddGroup');
require('./Api/InactiveUsers');

/**
 * Domain
 */

require('./Api/Domains');

/**
 * Activities
 */

require('./Api/GetPost');
require('./Api/GetPosts')
require('./Api/AddActivity');
require('./Api/Attendees');
require('./Api/AddInterested');
require('./Api/AddGoing');
require('./Api/RemoveReply');
require('./Api/DeletePost');

/**
 * Invites
 */

require('./Api/InviteUser');
require('./Api/InviteGroup');

/**
 * Users
 */

require('./Api/AddUser');
require('./Api/GetUser');
require('./Api/GetUsers');
require('./Api/GetUserFullName');
require('./Api/GetUserBasicInfo');
require('./Api/GetUserFriends');
require('./Api/GetUserInterests');
require('./Api/GetUserGroups');
require('./Api/GetUserCalendar');
require('./Api/UpdateUserFirstName');
require('./Api/UpdateUserLastName');
require('./Api/UpdateUserEmail');
require('./Api/UpdateUserAcademicLevel');
require('./Api/UpdateUserInterests');
require('./Api/UpdateUserMajor');
require('./Api/UpdateUserGraduationYear');
require('./Api/UpdateUserHometown');
require('./Api/UpdateUserDescription');
require('./Api/UpdateUserProfileImageUrl');
require('./Api/UpdateUserLastLogon');
require('./Api/IsUserIntroComplete');
require('./Api/IsUserSuspended');

/**
 * Groups
 */

require('./Api/GetGroups');
require('./Api/GetGroup');
require('./Api/GetGroupBasicInfo');
require('./Api/JoinGroup');
require('./Api/LeaveGroup');

/**
 * Discover
 */

require('./Api/GetSuggestedUsers');
require('./Api/GetSuggestedGroups');
require('./Api/GetSearchUsersArray');
require('./Api/GetSearchGroupsArray');

/**
 * Friends
 */

require('./Api/RequestFriend');
require('./Api/ApproveFriend');
require('./Api/IgnoreFriendRequest');
require('./Api/RemoveFriend');
require('./Api/GetSentFriendRequests');
require('./Api/GetRecievedFreindRequests');

/**
 * Discussions
 */

require('./Api/PostDiscussion');
require('./Api/GetDiscussions');

/**
 * Notifications
 */

require('./Api/GetNotifications');
require('./Api/UpdateNotificationRead');
require('./Api/AddNotificationToken');
require('./Api/RemoveNotificationToken');
require('./Api/SendNotificationToUser');
require('./Api/GetUsers');

/**
 * Verification
 */

require('./Api/Verify');
require('./Api/Welcome');
require('./Api/RequestVerification');
require('./Api/GetUserVerified');

/**
 * Flag
 */

require('./Api/FlagActivity');
