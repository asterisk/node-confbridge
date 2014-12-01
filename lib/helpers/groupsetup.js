'use strict';

var util = require('util');

function GroupSetup() {

  var groups = {};
  var followers = {};
  var leaders = {};

  /**
   * Returns the followers array.
   *
   * @return {Object} followers - the array of followers
   */
  this.getFollowers = function() {
    return followers;
  }

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

  /**
   * Adds one to this group type.
   *
   * @param {String} groupType - the type of group to add to
   */
  this.addToGroup = function(groupType) {
    if (groups[groupType]) {
      groups[groupType] += 1;
    }
    else {
      groups[groupType] = 1;
    }
    console.log(util.format('%s: %s', groupType, groups[groupType]));
  };

  /**
   * Removes one from this group type.
   *
   * @param {String} groupType - the type of group to remove from
   */
  this.removeFromGroup = function(groupType) {
    if (groups[groupType] > 0) {
      groups[groupType] -= 1;
    }
    console.log(util.format('%s: %s', groupType, groups[groupType]));
  };

  /**
   * Checks to see if the given group is full.
   *
   * @param {String} groupType - the group to check
   * @param {Integer} groupMax - the maximum amount of members allowed
   */
  this.groupIsFull = function(groupType, groupMax) {
    return groups[groupType] > groupMax;
  };

}

module.exports = GroupSetup;
