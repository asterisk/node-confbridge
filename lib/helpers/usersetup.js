'use strict';

var Q = require('q');
var userFsm = require('./fsm/userfsm.js');
var util = require('util');

/**
 * This class keeps up with users that join the conference.
 *
 * @param {Object} ari - the ARI client
 * @param {Object} db - the database module
 * @param {Object} groups - the group setup module
 */
function UserSetup(ari, db, groups) {
  var self = this;

  /**
   * Contains all users that join the conference, where the index is the
   * channel id.
   */
  var userList = {};

  /**
   * Takes care of clean up when a channel leaves the applicaton.
   *
   * @param {Object} event - the StasisEnd event
   * @param {Object} channel - the channel leaving Stasis
   */
  ari.on('StasisEnd', function (event, channel) {
    if (userList[channel.id]) {
      var groupType = userList[channel.id].group.group_type;
      groups.removeFromGroup(groupType);
      if (userList[channel.id].group.group_behavior === 'follower') {
        groups.removeFollower(channel);
      }
      self.deleteUser(channel);
      self.unregisterEvents(channel);
    }
  });

  /**
   * Stores a user and their configuration in the users array.
   *
   * @param {Object} event - the event object
   * @param {Object} channel - the channel to add
   * @param {Object} bridge - the bridge the channel is entering
   */
  this.storeUser = function(event, channel, bridge) {
    var chanID = channel.id;
    var userType = 'default';
    var groupType = 'participant';
    if (event.args[0]) {
      userType = event.args[0];
    }
    if (event.args[1]) {
      groupType = event.args[1];
    }
    var userSettings = null;
    var groupSettings = null;
    db.getUserProfile(userType)
      .then(function (result) {
        userSettings = result;
        return db.getGroupProfile(groupType);
      })
      .then(function (result) {
        groupSettings = result;
      })
      .then(function () {
        var fsm = userFsm(channel, ari, userSettings, userList, bridge,
                          groups);
        userList[chanID] = { channel: channel, settings: userSettings,
                             fsm: fsm, group: groupSettings };
        if (groupSettings.group_behavior === 'follower') {
          groups.addFollower(channel);
        }
      })
      .then(function () {
        self.registerEvents(channel);
      })
      .then(function () {
        var group = userList[chanID].group.group_type;
        groups.addToGroup(group);
        var groupMax = userList[chanID].group.max_members;
        if (groups.groupIsFull(groupType, groupMax)) {
          var hangup = Q.denodeify(channel.hangup.bind(channel));
          hangup()
            .then(function() {
              console.log(util.format('Group \'%s\' is full', groupType));
            })
            .catch(function(err) {
              console.error(err);
            })
            .done();
        }
        else {
          userList[chanID].fsm.handle('ready');
        }
      })
      .catch(function (err) {
        console.error(err);
      })
      .done();
  };

  /**
   * Deletes a user from the users array.
   *
   * @param {Object} channel - the channel to delete
   */
  self.deleteUser = function(channel) {
    var chanID = channel.id;
    if (userList[chanID]) {
      delete(userList[chanID]);
    }
  };

  /**
   * Registers event listeners to the channel.
   *
   * @param {Object} channel - the channel to register events to
   */ 
  self.registerEvents = function(channel) {
    channel.on('ChannelDtmfReceived', this.dtmfHandler);
  };

  /**
   * Unregisters event listeners to the channel.
   *
   * @param {Object} channel - the channel to unregister events for
   */
  self.unregisterEvents = function(channel) {
    channel.removeListener('ChannelDtmfReceived', this.dtmfHandler);
  };

  /**
   * Returns the list of users, indexed by channel id.
   *
   * @return {Object} userList - the list of users
   */
  this.getUsers = function() {
    return userList;
  };

  /**
   * The function to call when a DTMF is received.
   *
   * @param {Object} event - the DTMF event object
   */
  this.dtmfHandler = function(event) {
    userList[event.channel.id].fsm.handle('dtmf', { digit: event.digit });
  };

  /**
   * Called when a channel is considered done in the application.
   *
   * @param {Object} channel - the channel done with the application
   */
  this.handleDone = function(channel) {
    userList[channel.id].fsm.handle('done');
  };

}

module.exports = UserSetup;
