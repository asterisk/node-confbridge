'use strict';

var Q = require('q');
var util = require('util');

/**
 * A module for finite state machines that handles bridge operations.
 */
function BridgeDriverModule() {

  var currentPlayback = null;

  /**
   * Sets the bridge to its default settings.
   *
   * @param {Object} bridge - the bridge to reset
   */
  this.setToDefault = function(bridge) {
    bridge.locked = false;
    bridge.recordingPaused = true;
    bridge.recordingEnabled = false;
    console.log('Bridge auto-unlocked');
  };

  /**
   * Places the channel into the bridge.
   *
   * @param {Object} channel - the channel being placed in the bridge
   * @param {Object} bridge - the bridge to place the channel in
   */
  this.addToBridge = function(channel, bridge) {
    var add = Q.denodeify(bridge.addChannel.bind(bridge));
    return add({channel: channel.id})
      .catch(function(err) {
        console.error(err);
      });
  };

  /**
   * Removes a channel from the bridge.
   *
   * @param {Object} channel - the channel being removed from the bridge
   * @param {Object} bridge - the bridge to remove the channel from
   */
  this.removeFromBridge = function(channel, bridge) {
    var remove = Q.denodeify(bridge.removeChannel.bind(bridge));
    return remove({channel: channel.id})
      .catch(function(err) {
        console.error(err);
      });
  };

  /**
   * Lets a channel know the bridge is locked, then hangs up the channel.
   *
   * @param {Object} ari - the ARI client
   * @param {Object} channel - the channel attempting to join the bridge
   * @param {Object} bridge - the bridge the channel is in
   */
  this.bridgeIsLocked = function(ari, channel, bridge) {
    var playback = ari.Playback();
    var soundToPlay = util.format('sound:%s',
                                  bridge.settings.locked_sound);
    var play = Q.denodeify(channel.play.bind(channel));
    play({media: soundToPlay}, playback)
      .catch(function(err) {
        console.error(err);
      })
      .done();
    playback.once('PlaybackFinished', function (event, completedPlayback) {
      var hangup = Q.denodeify(channel.hangup.bind(channel));
      hangup()
        .catch(function (err) {
          console.error(err);
        })
        .done();
    });
  };

  /**
   * Kicks the last user that joined the conference from the bridge.
   *
   * @param {Object} ari - the ARI client
   * @param {Object} bridge - the bridge the channel is in
   * @param {Object} users - an array of users in the application
   */
  this.kickLast = function(ari, bridge, users) {
    if (bridge.lastJoined) {
      var chanId = bridge.lastJoined.pop();
      users[chanId].fsm.transition('inactive');
      var soundToPlay = util.format('sound:%s',
                                    bridge.settings.kicked_sound);
      var remove = Q.denodeify(bridge.removeChannel.bind(bridge));
      var playback = ari.Playback();
      remove({channel: chanId})
        .then(function () {
          var play = Q.denodeify(ari.channels.play.bind(ari));
          return play({channelId: chanId, media: soundToPlay,
                       playbackId: playback.id});
        })
        .catch(function (err) {
          console.error(err);
        })
        .done();
      playback.once('PlaybackFinished', function (event,
                                                  completedPlayback) {
        var hangup = Q.denodeify(ari.channels.hangup.bind(ari));
        hangup({channelId: chanId})
          .catch(function (err) {
            console.error(err);
          })
          .done();
      });
    }
  };

  /**
   * Toggles the lock on the bridge, determining whether or not any more users
   * can join.
   *
   * @param {Object} ari - the ARI client
   * @param {Object} bridge - the bridge being locked / unlocked
   */
  this.toggleLock = function(ari, bridge) {
    if (currentPlayback) {
      var stopPlayback = Q.denodeify(currentPlayback.stop.bind(
                                     currentPlayback));
      stopPlayback()
        .catch(function (err) {
          return;
        })
        .done();
    }
    var playback = ari.Playback();
    currentPlayback = playback;
    if (!bridge.locked) {
      var soundToPlay = util.format('sound:%s',
                                    bridge.settings.now_locked_sound);
      var play = Q.denodeify(bridge.play.bind(bridge));
      play({media: soundToPlay}, playback)
        .catch(function (err) {
          console.error(err);
        })
        .done();
    }
    else {
      var soundToPlay = util.format('sound:%s',
                                    bridge.settings.now_unlocked_sound);
      var play = Q.denodeify(bridge.play.bind(bridge));
      play({media: soundToPlay}, playback)
        .catch(function (err) {
          console.error(err);
        })
        .done();
    }
    bridge.locked = !bridge.locked;
  };

}

module.exports = BridgeDriverModule;
