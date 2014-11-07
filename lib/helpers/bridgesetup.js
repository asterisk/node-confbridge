'use strict';

var Q = require('q');
var util = require('util');
var db = require('../../data/db.js');
var UserSetup = require('./usersetup.js');
var BridgeFsm = require('./fsm/bridgefsm.js');

function BridgeSetup(ari) {
  var self = this;

  var bridge = ari.Bridge();
  var playback = ari.Playback();
  var ariChannelPlay = Q.denodeify(ari.channels.play.bind(ari));
  // Will contain the bridge configuration fetched from the database.
  var settings = null;
  // The class used to store users that enter the bridge.
  var users = new UserSetup(ari, db);
  // The finite state machine for the bridge.
  bridge.fsm = null;

  /**
   * Sets up the bridge for the conference.
   */
  self.init = function() {
    var createBridge = Q.denodeify(bridge.create.bind(bridge));
    createBridge({type: 'mixing,dtmf_events'})
      .then(function () {
        bridge.lastJoined = [];
        bridge.channels = [];
        bridge.recordingEnabled = false;
        bridge.recordingPaused = true;
        self.registerEvents(bridge);
      })
      .then(function () {
        return db.getBridgeSettings();
      })
      .then(function (result) {
        settings = result;
      })
      .then(function () {
        bridge.fsm = BridgeFsm(ari, bridge, settings, users);
      })
      .catch(function (err) {
        console.error(err);
      })
      .done();
  }

  /**
   * Sends audio to the bridge.
   *
   * @param {Object} bridge - the bridge to play sound to
   * @param {String} sound - the sound to play to the bridge
   */
  self.playSound = function(bridge, sound) {
    var soundToPlay = util.format('sound:%s', sound);
    var bridgePlay = Q.denodeify(bridge.play.bind(bridge));
    bridgePlay({media: sound}, playback)
      .catch(function (err) {
        console.error(err);
      })
      .done();
  }

  /**
   * Stores the user and creates a finite state machine for them.
   *
   * @param {Object} event - the StasisStart event
   * @param {Object} channel - the channel to store
   */
  self.registerUser = function(event, channel) {
    if (self.size(bridge.channels) < settings.max_members) {
      users.storeUser(event, channel, bridge, settings);
    }
    else {
      var hangup = Q.denodeify(channel.hangup.bind(channel));
      hangup()
        .then(function () {
          console.log('Conference is at max members');
        })
        .catch(function (err) {
          console.error(err);
        })
        .done();
    }
  }

  /**
   * Registers event listeners to the bridge.
   *
   * @param {Object} bridge - the bridge to register events to
   */
  self.registerEvents = function(bridge) {
    bridge.on('ChannelEnteredBridge', function (event, instances) {
      bridge.lastJoined.push(instances.channel.id);
      bridge.channels[instances.channel.id] = instances.channel;
      bridge.fsm.handle('userJoin');
      var userList = users.getUsers();
      for (var user in userList) {
        if (!userList[user].settings.quiet) {
          var soundToPlay = util.format('sound:%s', settings.join_sound);
          ariChannelPlay({channelId: user, media: soundToPlay})
            .catch(function (err) {
              console.error(err);
            })
            .done();
        }
      }
    });
    bridge.on('ChannelLeftBridge', function (event, instances) {
      bridge.fsm.handle('userExit', {confBridge: instances.bridge});
      delete(bridge.channels[instances.channel.id]);
      var i = bridge.lastJoined.indexOf(instances.channel.id);
      if (i >= 0) {
        bridge.lastJoined.splice(i, 1);
      }
      var userList = users.getUsers();
      for (var user in userList) {
        if (!userList[user].settings.quiet &&
            userList[user].fsm.state !== 'inactive') {
          var soundToPlay = util.format('sound:%s', settings.leave_sound);
          ariChannelPlay({channelId: user, media: soundToPlay})
            .catch(function (err) {
              console.error(err);
            })
            .done();
        }
      }
    });
  }

  /**
   * Returns the size of the object.
   *
   * @param {Object} obj - the object to get the size of
   * @return {Integer} size - the size of the object
   */
  self.size = function(obj) {
    var size = 0;
    for (var key in obj) {
      if (obj.hasOwnProperty(key)) {
        size++;
      }
    }
    return size;
  }

}

module.exports = BridgeSetup;
