'use strict';

var Q = require('q');

function UserSetup(db) {
  var self = this;
  var users = {};

  /**
   * Stores a user and their configuration in the users array.
   *
   * @param {Object} event - the event object
   * @param {Object} channel - the channel to add
   */
  this.storeUser = function(event, channel) {
    var chanID = channel.id;
    var userType = 'default';
    if (event.args[0]) {
      userType = event.args[0];
    }
    db.getUserProfile(userType)
      .then(function (result) {
        users[chanID] = result;
        self.print();
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
  this.deleteUser = function(channel) {
    var chanID = channel.id;
    delete(users[chanID]);
    self.print();
  }

  self.print = function() {
    console.log(users);
  }

}

module.exports = UserSetup;
