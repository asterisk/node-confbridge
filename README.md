# About

This is a basic configuration for a Conference Bridge Application using ARI and
Node.js.

# Installation

## Node.js

This application requires Node.js 0.10.X.

## Install confbridge application
```bash
$git clone https://github.com/semidy/node-confbridge-js.git
$npm install
```

## Install Postgres database driver
```bash
$npm install pg
```

## Create and configure your database

Once you have created and configured your database, you will want to modify
the dbConnection in the config.json to point to your database. For example:
```json
postgres://user:secret@localhost/user
```

## Create or reset to default data

Run the following commands to create and/or reset all default tables, indexes,
user profile, group profile, and bridge profile settings:
```bash
$cd scripts
$node defaultdatabase.js

## Adding new data

After you have created and configured your specific database and run the
defaultdatabase.js script, you are now able to setup your own specific user,
group, and bridge profiles, within the scripts folder, that are to be added to the
database.

Run the following commands to add a new user to the database:
```bash
$node adduser.js
```
Run the following commands to add a new group to the database:
```bash
$node addgroup.js
```
Run the following commands to add a new bridge to the database:
```bash
$node addbridge.js
```

## Asterisk configuration

Modify the ariConnection in the config.json to point to your Asterisk Instance.

Add the following to your dialplan to test the default connection:
```bash
exten => 8888,1,NoOp()
        same => n,Stasis(confbridge)
        same => n,Hangup()
```
Also you can add the name of your user_type and group_type in the stasis
application if you have changed it from default. For example:
```bash
exten => 9999,1,NoOp()
        same => n,Stasis(confbridge, usertypename, grouptypename)
        same => n,Hangup()

# ConfBridge application

Start the application:
```bash
$node app.js
```

## Join the conference

Dial 8888

## Normal menu

* Press 1 to toggle mute on and off
* Press 2 to toggle deafmute on and off
* Press 3 to leave the conference and execute dialplan(which can have a
specified context, extension, and priority within the config.json)
* Press 4 to decrease the speakers volume
* Press 5 to reset the speakers volume
* press 6 to increase the speakers volume
* Press 7 to decrease microphone volume
* Press 8 to reset microphone volume
* Press 9 to increase microphone volume
* Press 0 to change microphone pitch from normal to low to high
* Press # to access the admin menu(if you have admin set to true in user
profile)

## Admin menu

* Press 1 to toggle the bridge lock on and off
* Press 2 to kick the last user that joined the conference
* Press 3 to record the conference, if it isn't already recording, but if the
conference is already recording then it toggles pausing and unpausing the
recording
* Press # to return to the normal menu

# Database profile options

These are the various options that are specified in the database for users,
groups, and bridges.

## Bridge profile options

#### bridge_type 
The name of the bridge profile.
* type: varchar(50)
* default: default

#### join_sound
Determines what sound is to be played when a user joins the conference. The
user profile option quiet must be set to false.
* type: varchar(50)
* default: confbridge-join

#### leave_sound
Determines what sound is to be played when a user leaves the conference. The
user profile option quiet must be set to false.
* type: varchar(50)
* default: confbridge-leave

#### pin_number
The PIN number that users must enter in order to join the conference. The
user profile option pin_auth must be set to true.
* type: integer
* default: 1234

#### pin_retries
Determines the number of retries a user is allowed while entering the PIN. The
user profile option pin_auth must be set to true.
* type: integer
* default: 3

#### enter_pin_sound
Determines what sound is played when the user is prompted to enter in a PIN
number. The user profile option pin_auth must be set to true.
* type: varchar(50)
* default: conf-getpin

#### bad_pin_sound
Determines what sound is played if the user enters an invalid PIN number. the
user profile option pin_auth must be set to true.
* type: varchar(50)
* default: conf-invalidpin

#### locked_sound
Determines what sound is played if the user attempts to join a locked
conference.
* type: varchar(50)
* default: confbridge-lock-no-join

#### now_locked_sound
Determines what sound is played when an admin locks the conference.
* type: varchar(50)
* default: confbridge-locked

#### now_unlocked_sound
Determines what sound is played when an admin unlocks the conference.
* type: varchar(50)
* default: confbridge-unlocked

#### now_muted_sound
Determines what sound is played when a channel is muted.
* type: varchar(50)
* default: confbridge-muted

#### now_unmuted_sound
Determines what sound is played when a channel is unmuted.
* type: varchar(50)
* default: confbridge-unmuted

#### kicked_sound
Determines what sound is played when a user is kicked out of the conference.
* type: varchar(50)
* default: confbridge-removed

#### record_conference
Determines whether or not the conference starts off recording after the first
user is present within the conference.
* type: boolean
* default: false

#### recording_sound
Determines what sound is played when the conference starts or resumes recording
* type: varchar(50)
* default: conf-now-recording

#### wait_for_leader_sound
Determines what sound is played when a follower is waiting for a leader to
join the conference.
* type: varchar(50)
* default: conf-waitforleader

## User profile options

#### user_type
The name of the user profile.
* type: varchar(50)
* default: default

#### admin
Determines whether or not a user is assigned admin functionality within the
conference, such as access to the admin menu.
* type: boolean
* default: false

#### moh
plays music on hold when there is one participant in the conference.
* type: boolean
* default: true

#### quiet
Determines whether there is a sound to be played when a user enters or leaves
the conference.
* type: boolean
* default: false

#### pin_auth
Determines whether or not a user is required to have to enter in a PIN number
in order to join the conference.
* type: boolean
* default: false

## Group profile options

#### group_type
The name of the group profile.
* type: varchar(50)
* default: default

#### group_behavior
Determines how a group shall behave within the conference. There are three
types of group behavior options that can be specified in the group profile and
each of them have differing functional conferencing purposes.
* type: varchar(50)
* default: participant

###### Available Options:
* __participant__: the group in which the user can join the conference as a normal
user. If no group is specified, this becomes the default group.
* __follower__: the group that receives music on hold until a leader joins, once
a leader joins the conference they enter the conference as well.
* __leader__: the group that the followers wait on in order to join the conference

#### max_members
Determines how many users are allowed in each specified group.
* type: integer
* default: 100
