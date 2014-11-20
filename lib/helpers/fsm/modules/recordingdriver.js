'use strict';

var Q = require('q');
var util = require('util');

/**
 * A module for finite state machines that handles recording operations.
 */
function RecordingDriverModule() {

  /**
   * Handles recording logic.
   *
   * @param {Object} ari - the ARI client
   * @param {Object} bridge - the bridge being recorded
   * @param {Object} bridgeSettings - the settings for the bridge
   */
  this.handleRecording = function(ari, bridge, bridgeSettings) {
    if (!bridge.recordingEnabled) {
      this.enableRecording(ari, bridge, bridgeSettings);
    }
    else if (!bridge.recordingPaused) {
      this.pauseRecording(ari, bridge);
    }
    else {
      this.unpauseRecording(ari, bridge, bridgeSettings);
    }
  };

  /**
   * Starts a recording for the bridge.
   *
   * @param {Object} ari - the ARI client
   * @param {Object} bridge - the bridge to record
   * @param {Object} bridgeSettings - the settings for the bridge
   */
  this.enableRecording = function(ari, bridge, bridgeSettings) {
    var playback = ari.Playback();
    var soundToPlay = util.format('sound:%s', bridgeSettings.recording_sound);
    var record = Q.denodeify(bridge.record.bind(bridge));
    record({format: 'wav', name: bridge.currentRecording.name,
            terminateOn: 'none'})
      .then(function() {
        bridge.recordingPaused = false;
        bridge.recordingEnabled = true;
        var play = Q.denodeify(bridge.play.bind(bridge));
        return play({media: soundToPlay});
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
   * @param {Object} bridgeSettings - the settings for the bridge
   */
  this.unpauseRecording = function(ari, bridge, bridgeSettings) {
    var unpause = Q.denodeify(ari.recordings.unpause.bind(ari));
    unpause({recordingName: bridge.currentRecording.name})
      .then(function () {
        bridge.recordingPaused = false;
        console.log('Recording unpaused');
      })
      .catch(function (err) {
        console.error(err);
      })
      .done();
  };

}

module.exports = RecordingDriverModule;
