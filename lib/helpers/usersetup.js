'use strict';

var Q = require('q');
var userFsm = require('./fsm/userfsm.js');

function UserSetup(ari, db, groups) {
  var self = this;

  // Contains all users that join the conference, where the index is the
  // channel id.
  var userList = {};

  ari.on('StasisEnd', function (event, channel) {
    if (userList[channel.id]) {
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
   */
  this.storeUser = function(event, channel, bridge, bridgeSettings) {
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
                              bridgeSettings);
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
        userList[chanID].fsm.handle('ready');
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
   * Tells the channel that it is done with the application.
   *
   * @param {Object} channel - the channel to tell
   */
  this.handleDone = function(channel) {
    userList[channel.id].fsm.handle('done');
  };

}

module.exports = UserSetup;
