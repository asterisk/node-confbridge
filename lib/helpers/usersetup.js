'use strict';

var Q = require('q');
var UserFsm = require('./fsm/userfsm.js');

function UserSetup(ari, db) {
  var self = this;

  // Contains all users that join the conference, where the index is the
  // channel id.
  var userList = {};

  ari.on('StasisEnd', function (event, channel) {
    if (userList[channel.id]) {
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
    if (event.args[0]) {
      userType = event.args[0];
    }
    db.getUserProfile(userType)
      .then(function (result) {
        var userFsm = new UserFsm(channel, ari, result, userList, bridge,
                                  bridgeSettings);
        userList[chanID] = { channel: channel, settings: result, fsm: userFsm };
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
   * @param {Object} channel - the channel to register events to
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

  this.handleDone = function(channel) {
    userList[channel.id].fsm.handle('done');
  };

}

module.exports = UserSetup;
