'use-strict';

var Q = require('q');
var util = require('util');

var LISTEN_VOLUME = 'VOLUME(TX)';
var TALK_VOLUME = 'VOLUME(RX)';
var PITCH_SHIFT = 'PITCH_SHIFT(RX)';
var USER_TO_BRIDGE = 'in';

/**
 * A module for finite state machines that handles media operations for users.
 */
function ChannelMediaModule() {
  
  var listenCounter = 1;
  var talkCounter = 1;
  var pitchChanger = 0;
  var muted = false;
  var deafMuted = false;
  
  /**
   * Mutes and unmutes the channel.
   *
   * @param {Object} ari - the ARI client
   * @param {Object} bridgeSettings - the settings for the bridge
   * @param {Object} channel - the channel to mute / unmute
   */
  this.muteChannel = function(ari, bridgeSettings, channel) {
    if (!muted) {
      var playback = ari.Playback();
      var soundToPlay = util.format('sound:%s',
                                    bridgeSettings.now_muted_sound);
      var mute = Q.denodeify(channel.mute.bind(channel));
      mute({direction: USER_TO_BRIDGE})
        .then(function () {
          muted = true;
          var play = Q.denodeify(channel.play.bind(channel));
          return play({media: soundToPlay});
        })
        .catch(function (err) {
          console.error(err);
        })
        .done();
    }
    else {
      var playback = ari.Playback();
      var soundToPlay = util.format('sound:%s',
                                    bridgeSettings.now_unmuted_sound);
      var unmute = Q.denodeify(channel.unmute.bind(channel));
      unmute({direction: USER_TO_BRIDGE})
        .then(function () {
          muted = false;
          var play = Q.denodeify(channel.play.bind(channel));
          return play({media: soundToPlay});
        })
        .catch(function (err) {
          console.error(err);
        })
        .done()
    }
  }
  
  /**
   * Deaf mutes and undeaf mutes the channel.
   *
   * @param {Object} channel - the channel to deaf mute / undeaf mute
   */
  this.deafMuteChannel = function(channel) {
    if (!deafMuted) {
      var mute = Q.denodeify(channel.mute.bind(channel));
      mute({direction: 'both'})
        .then(function () {
          deafMuted = true;
          console.log('Channel is deaf muted');
        })
        .catch(function (err) {
          console.error(err);
        })
        .done();
    }
    else {
      var unmute = Q.denodeify(channel.unmute.bind(channel));
      unmute({direction: 'both'})
        .then(function () {
          deafMuted = false;
          console.log('Channel is no longer deaf muted');
        })
        .catch(function (err) {
          console.error(err);
        })
        .done();
    }
  }

  /**
   * Increases the volume of the audio the channel hears.
   *
   * @param {Object} channel - the channel to change the volume of
   */
  this.incrementListenVolume = function(channel) {
    if (listenCounter < 10) {
      listenCounter++;
      var setVar = Q.denodeify(channel.setChannelVar.bind(channel));
      setVar({variable: LISTEN_VOLUME, value: listenCounter})
        .catch(function (err) {
          console.error(err);
        })
        .done();
    }
  }
  
  /**
   * Decreases the volume of the audio the channel hears.
   *
   * @param {Object} channel - the channel to change the volume of
   */
  this.decrementListenVolume = function(channel) {
    if (listenCounter > -10) {
      listenCounter--;
      var setVar = Q.denodeify(channel.setChannelVar.bind(channel));
      setVar({variable: LISTEN_VOLUME, value: listenCounter})
        .catch(function (err) {
          console.error(err);
        })
        .done();
    }
  }

  /**
   * Sets the volume of the audio the channel hears back to its default.
   *
   * @param {Object} channel - the channel to change the volume of
   */
  this.resetListenVolume = function(channel) {
    listenCounter = 1;
    var setVar = Q.denodeify(channel.setChannelVar.bind(channel));
    setVar({variable: LISTEN_VOLUME, value: listenCounter})
      .catch(function (err) {
        console.error(err);
      })
      .done();
  }
  
  /**
   * Increases the volume of the audio the channel outputs.
   *
   * @param {Object} channel - the channel to change the volume of
   */
  this.incrementTalkVolume = function(channel) {
    if (talkCounter < 10) {
      talkCounter++;
      var setVar = Q.denodeify(channel.setChannelVar.bind(channel));
      setVar({variable: TALK_VOLUME, value: talkCounter})
        .catch(function (err) {
          console.error(err);
        })
        .done();
    }
  }
  
  /**
   * Decreases the volume of the audio the channel outputs.
   *
   * @param {Object} channel - the channel to change the volume of
   */
  this.decrementTalkVolume = function(channel) {
    if (talkCounter > -10) {
      talkCounter--;
      var setVar = Q.denodeify(channel.setChannelVar.bind(channel));
      setVar({variable: TALK_VOLUME, value: talkCounter})
        .catch(function (err) {
          console.error(err);
        })
        .done();
    }
  }

  /**
   * Sets the volume of the audio the channel outputs back to its default.
   *
   * @param {Object} channel - the channel to change the volume of
   */
  this.resetTalkVolume = function(channel) {
    talkCounter = 1;
    var setVar = Q.denodeify(channel.setChannelVar.bind(channel));
    setVar({variable: TALK_VOLUME, value: talkCounter})
      .catch(function (err) {
        console.error(err);
      })
      .done();
  }
  
  /**
   * Changes the pitch of the audio the channel outputs.
   *
   * @param {Object} channel - the channel to change the pitch of
   */
  this.pitchChange = function(channel) {
    if (pitchChanger === 0) {
      var setVar = Q.denodeify(channel.setChannelVar.bind(channel));
      setVar({variable: PITCH_SHIFT, value: 0.7})
        .then(function () {
          pitchChanger++;
        })
        .catch(function (err) {
          console.error(err);
        })
        .done();
    }
    else if (pitchChanger === 1) {
      var setVar = Q.denodeify(channel.setChannelVar.bind(channel));
      setVar({variable: PITCH_SHIFT, value: 'higher'})
        .then(function () {
          pitchChanger++;
        })
        .catch(function (err) {
          console.error(err);
        })
        .done()
    }
    else {
      var setVar = Q.denodeify(channel.setChannelVar.bind(channel));
      setVar({variable: PITCH_SHIFT, value: 1.0})
        .then(function () {
          pitchChanger = 0;
        })
        .catch(function (err) {
          console.error(err);
        })
        .done()
    }
  }
}

module.exports = ChannelMediaModule;
