'use strict';

var Q = require('q');
var util = require('util');
var db = require('../../data/db.js');
var UserSetup = require('./usersetup.js');
var bridgeFsm = require('./fsm/bridgefsm.js');
var GroupSetup = require('./groupsetup.js');

function BridgeSetup(ari) {
  var self = this;

  var bridge = ari.Bridge();
  var groups = new GroupSetup();
  var users = new UserSetup(ari, db, groups);

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
        return db.getBridgeProfile();
      })
      .then(function (result) {
        bridge.settings = result;
      })
      .then(function () {
        bridge.fsm = bridgeFsm(ari, bridge, users);
      })
      .catch(function (err) {
        console.error(err);
      })
      .done();
  };

  /**
   * Stores the user and creates a finite state machine for them.
   *
   * @param {Object} event - the StasisStart event
   * @param {Object} channel - the channel to store
   */
  self.registerUser = function(event, channel) {
    if (self.size(bridge.channels) < bridge.settings.max_members) {
      users.storeUser(event, channel, bridge);
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
  };

  /**
   * Registers event listeners to the bridge.
   *
   * @param {Object} bridge - the bridge to register events to
   */
  self.registerEvents = function(bridge) {
    bridge.on('ChannelEnteredBridge', function (event, instances) {
      var channelId = instances.channel.id;
      bridge.lastJoined.push(channelId);
      bridge.channels[channelId] = instances.channel;
      bridge.fsm.handle('userJoin');
      var userList = users.getUsers();
      if (userList[channelId].group.group_behavior === 'leader') {
        groups.addLeader(instances.channel);
        var followers = groups.getFollowers();
        for (var chanId in followers) {
          userList[chanId].fsm.handle('leaderJoined');
        }
      }
      for (var chanId in userList) {
        if (!userList[chanId].settings.quiet) {
          var playback = ari.Playback();
          var soundToPlay = util.format('sound:%s', bridge.settings.join_sound);
          var play = Q.denodeify(ari.channels.play.bind(ari));
          play({channelId: chanId, media: soundToPlay})
            .catch(function (err) {
              console.error(err);
            })
            .done();
        }
      }
    });
    bridge.on('ChannelLeftBridge', function (event, instances) {
      var channelId = instances.channel.id;
      delete(bridge.channels[channelId]);
      users.handleDone(instances.channel);
      bridge.fsm.handle('userExit', {confBridge: instances.bridge});
      bridge.lastJoined = bridge.lastJoined.filter(function(candidate) {
        return candidate !== channelId;
      });
      var userList = users.getUsers();
      if (userList[channelId].group.group_behavior === 'leader') {
        groups.removeLeader(instances.channel);
        if (groups.leaderSize() === 0) {
          var followers = groups.getFollowers();
          for (var chanId in followers) {
            userList[chanId].fsm.handle('noLeaders');
          }
        }
      }
      for (var chanId in userList) {
        if (!userList[chanId].settings.quiet &&
            userList[chanId].fsm.isActive()) {
          var playback = ari.Playback();
          var soundToPlay = util.format('sound:%s',
                                        bridge.settings.leave_sound);
          var play = Q.denodeify(ari.channels.play.bind(ari));
          play({channelId: chanId, media: soundToPlay})
            .catch(function (err) {
              console.error(err);
            })
            .done();
        }
      }
    });
  };

  /**
   * Returns the size of the object.
   *
   * @param {Object} obj - the object to get the size of
   * @return {Integer} size - the size of the object
   */
  self.size = function(obj) {
    return Object.keys(obj).length;
  };

}

module.exports = BridgeSetup;
