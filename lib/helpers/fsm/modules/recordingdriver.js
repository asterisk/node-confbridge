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
   * Starts a recording for the bridge.
   *
   * @param {Object} ari - the ARI client
   * @param {Object} bridge - the bridge to record
   */
  this.enableRecording = function(ari, bridge) {
    var playback = ari.Playback();
    var soundToPlay = util.format('sound:%s', bridge.settings.recording_sound);
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
   */
  this.unpauseRecording = function(ari, bridge) {
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
