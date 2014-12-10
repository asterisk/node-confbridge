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
  this.init = function() {
    var createBridge = Q.denodeify(bridge.create.bind(bridge));
    createBridge({type: 'mixing,dtmf_events'})
      .then(function () {
        self.setBridgeDefaults();
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
  this.registerUser = function(event, channel) {
    users.storeUser(event, channel, bridge);
  };

  /**
   * Registers event listeners to the bridge.
   *
   * @param {Object} bridge - the bridge to register events to
   */
  this.registerEvents = function(bridge) {
    bridge.on('ChannelEnteredBridge', function (event, instances) {
      self.bridgeEnterHandleBridge(instances);
      self.bridgeEnterHandleGroups(instances);
      self.bridgeEnterHandleUsers(instances);
    });
    bridge.on('ChannelLeftBridge', function (event, instances) {
      self.bridgeLeaveHandleBridge(instances);
      self.bridgeLeaveHandleGroups(instances);
      self.bridgeLeaveHandleUsers(instances);
    });
  };

  /**
   * Returns the size of the object.
   *
   * @param {Object} obj - the object to get the size of
   * @return {Integer} size - the size of the object
   */
  this.size = function(obj) {
    return Object.keys(obj).length;
  };

  /**
   * Initializes some default variables needed for the bridge.
   */
  this.setBridgeDefaults = function() {
    bridge.lastJoined = [];
    bridge.channels = [];
    bridge.recordingEnabled = false;
    bridge.recordingPaused = true;
  };

  /**
   * Handles bridge related events when a user enters the bridge.
   *
   * @param {Object} instances - contains objects related to the event
   */
  this.bridgeEnterHandleBridge = function(instances) {
    var channelId = instances.channel.id;
    bridge.lastJoined.push(channelId);
    bridge.channels[channelId] = instances.channel;
    bridge.fsm.handle('userJoin', {channelId: instances.channel.id});
  };

  /**
   * Handles group related events when a user enters the bridge.
   *
   * @param {Object} instances - contains objects related to the event
   */
  this.bridgeEnterHandleGroups = function(instances) {
    var channelId = instances.channel.id;
    var userList = users.getUsers();
    if (groups.isLeader(userList,channelId)) {

      groups.addLeader(instances.channel);
      var followers = groups.getFollowers();
      for (var chanId in followers) {
        userList[chanId].fsm.handle('leaderJoined');
      }

    }
  };

  /**
   * Handles user related events when a user enters the bridge.
   *
   * @param {Object} instances - contains objects related to the event
   */
  this.bridgeEnterHandleUsers = function(instances) {
    var userList = users.getUsers();
    for (var chanId in userList) {

      if (!userList[chanId].settings.quiet &&
          !groups.isFollower(userList,chanId)) {

        var soundToPlay = util.format('sound:%s', bridge.settings.join_sound);
        var play = Q.denodeify(ari.channels.play.bind(ari));
        play({channelId: chanId, media: soundToPlay})
          .catch(function (err) {
            console.error(err);
          })
          .done();

      }

    }
  };

  /**
   * Handles bridge related events when a user leaves the bridge, and also
   * places the user in an inactive state.
   *
   * @param {Object} instances - contains objects related to the event
   */
  this.bridgeLeaveHandleBridge = function(instances) {
    var channelId = instances.channel.id;
    delete bridge.channels[channelId];

    var userList = users.getUsers();
    if (!groups.isFollower(userList,channelId)) {
      users.handleDone(instances.channel);
    }

    bridge.fsm.handle('userExit', {confBridge: instances.bridge});
    bridge.lastJoined = bridge.lastJoined.filter(function(candidate) {
      return candidate !== channelId;
    });
  };

  /**
   * Handles group related events when a user leaves the bridge.
   *
   * @param {Object} instances - contains objects related to the event
   */
  this.bridgeLeaveHandleGroups = function(instances) {
    var channelId = instances.channel.id;
    var userList = users.getUsers();
    if (groups.isLeader(userList,channelId)) {

      groups.removeLeader(instances.channel);
      if (!groups.containsLeaders()) {

        var followers = groups.getFollowers();
        for (var chanId in followers) {
          userList[chanId].fsm.handle('noLeaders');
        }

      }

    }
  };

  /**
   * Handles user related events when a user leaves the bridge.
   *
   * @param {Object} instances - contains objects related to the event
   */
  this.bridgeLeaveHandleUsers = function(instances) {
    var userList = users.getUsers();
    for (var chanId in userList) {

      if (!userList[chanId].settings.quiet &&
          userList[chanId].fsm.isActive() &&
          !groups.isFollower(userList,chanId)) {

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
  };

}

module.exports = BridgeSetup;
