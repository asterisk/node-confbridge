'use strict';

var Q = require('q');
var util = require('util');

/**
 * A module for finite state machines that handles recording operations.
 */
function RecordingDriverModule() {

  var self = this;

  var currentPlayback = null;

  /**
   * Handles recording logic.
   *
   * @param {Object} ari - the ARI client
   * @param {Object} bridge - the bridge being recorded
   */
  this.handleRecording = function(ari, bridge) {
    if (!bridge.recordingEnabled) {
      this.enableRecording(ari, bridge);
    }
    else if (!bridge.recordingPaused) {
      this.pauseRecording(ari, bridge);
    }
    else {
      this.unpauseRecording(ari, bridge);
    }
  };

  /**
   * Enables recording for the bridge and starts it.
   *
   * @param {Object} ari - the ARI client
   * @param {Object} bridge - the bridge to record
   */
  this.enableRecording = function(ari, bridge) {
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
    var soundToPlay = util.format('sound:%s', bridge.settings.recording_sound);
    var record = Q.denodeify(bridge.record.bind(bridge));
    self.startRecording(bridge)
      .then(function () {
        var play = Q.denodeify(bridge.play.bind(bridge));
        return play({media: soundToPlay}, playback);
      })
      .catch(function (err) {
        console.error(err);
      })
      .done();
  };

  /**
   * Pauses the bridge recording.
   *
   * @param {Object} ari - the ARI client
   * @param {Object} bridge - the bridge being recorded
   */
  this.pauseRecording = function(ari, bridge) {
    var pause = Q.denodeify(ari.recordings.pause.bind(ari));
    pause({recordingName: bridge.currentRecording.name})
      .then(function () {
        bridge.recordingPaused = true;
        console.log('Recording paused');
      })
      .catch(function (err) {
        console.error(err);
      })
      .done();
  };

  /**
   * Unpauses the bridge recording.
   *
   * @param {Object} ari - the ARI client
   * @param {Object} bridge - the bridge being recorded
   */
  this.unpauseRecording = function(ari, bridge) {
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
    var soundToPlay = util.format('sound:%s', bridge.settings.recording_sound);
    var unpause = Q.denodeify(ari.recordings.unpause.bind(ari));
    unpause({recordingName: bridge.currentRecording.name})
      .then(function () {
        bridge.recordingPaused = false;
        console.log('Recording unpaused');
        var play = Q.denodeify(bridge.play.bind(bridge));
        return play({media: soundToPlay}, playback);
      })
      .catch(function (err) {
        console.error(err);
      })
      .done();
  };

  /**
   * Starts recording for the bridge.
   *
   * @param {Object} bridge - the bridge to start the recording for
   */
  this.startRecording = function(bridge) {
    var record = Q.denodeify(bridge.record.bind(bridge));
    return record({format: 'wav', name: bridge.currentRecording.name,
                  terminateOn: 'none'})
      .then(function() {
        bridge.recordingPaused = false;
        bridge.recordingEnabled = true;
      })
      .catch(function (err) {
        console.error(err);
      });
  };

}

module.exports = RecordingDriverModule;
