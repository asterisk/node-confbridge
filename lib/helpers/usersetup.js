'use strict';

var Q = require('q');
var UserFsm = require('./fsm/userfsm.js');

function UserSetup(ari, db) {
  var self = this;
  var users = {};

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
        var userFsm = UserFsm(channel, ari, result, bridge, bridgeSettings);
        users[chanID] = { user: result, fsm: userFsm };
        self.print();
      })
      .then(function () {
        self.registerEvents(channel);
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
    delete(users[chanID]);
    self.print();
  }

  /**
   * Registers event listeners to the channel.
   *
   * @param {Object} channel - the channel to register events to
   */ 
  self.registerEvents = function(channel) {
    channel.on('ChannelDtmfReceived', function(event) {
      users[channel.id].fsm.handle('dtmf', { digit: event.digit });
    });
    channel.on('ChannelHangupRequest', function() {
      self.deleteUser(channel);
    });
  }
    

  self.print = function() {
    for (var user in users) {
      console.log(users[user].user);
    }
  }

}

module.exports = UserSetup;
