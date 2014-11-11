'use strict';

var Q = require('q');
var UserFsm = require('./fsm/userfsm.js');

function UserSetup(ari, db) {
  var self = this;
  var userList = {};

  ari.on('StasisEnd', function (event, channel) {
    if (userList[channel.id]) {
      self.deleteUser(channel);
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
        var userFsm = UserFsm(channel, ari, result, userList, bridge,
                              bridgeSettings);
        userList[chanID] = { id: channel.id, settings: result, fsm: userFsm };
      })
      .then(function () {
        self.registerEvents(channel, bridge);
      })
      .then(function () {
        userList[chanID].fsm.transition('waiting');
      })
      .catch(function (err) {
        console.error(err);
      })
      .done();
  }

  /**
   * Deletes a user from the users array.
   *
   * @param {bject} channel - the channel to delete
   */
  self.deleteUser = function(channel) {
    var chanID = channel.id;
    if (userList[chanID]) {
      delete(userList[chanID]);
    }
  }

  /**
   * Registers event listeners to the channel.
   *
   * @param {Object} channel - the channel to register events to
   */ 
  self.registerEvents = function(channel, bridge) {
    channel.on('ChannelDtmfReceived', function(event) {
      userList[channel.id].fsm.handle('dtmf', { digit: event.digit });
    });
    channel.on('ChannelHangupRequest', function() {
      if (userList[channel.id]) {
        self.deleteUser(channel);
      }
      console.log('Channel hung up');
    });
  }

  this.getUsers = function() {
    return userList;
  }

}

module.exports = UserSetup;
