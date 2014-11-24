'use strict';

function GroupSetup() {

  var followers = {};
  var leaders = {};

  /**
   * Adds a channel to the follower array.
   *
   * @param {Object} channel - the channel to add
   */
  this.addFollower = function(channel) {
    followers[channel.id] = channel;
  };

  /**
   * Removes a channel from the follower array.
   *
   * @param {Object} channel - the channel to remove
   */
  this.removeFollower = function(channel) {
    delete(followers[channel.id]);
  };

  /**
   * Adds a channel to the leader array.
   *
   * @param {Object} channel - the channel to add
   */
  this.addLeader = function(channel) {
    leaders[channel.id] = channel;
  };

  /**
   * Removes a channel from the leader array.
   *
   * @param {Object} channel - the channel to remove
   */
  this.removeLeader = function(channel) {
    delete(leaders[channel.id]);
  };

  /**
   * Returns how many leaders there are.
   *
   * @return {Integer} length - the length of the leaders array
   */
  this.leaderSize = function() {
    return Object.keys(leaders).length;
  };

  this.followerSize = function() {
    return Object.keys(followers).length;
  };

}

module.exports = GroupSetup;
