'use strict';

var machina = require('machina');
var util = require('util');
var Q = require('q');
var config = require('../../../config.json');

/**
 * Creates an fsm for a user and returns it.
 *
 * @returns fsm - the fsm to return
 */
function createFsm(channel, ari, userSettings, users, bridge, bridgeSettings) {

  // Some things to keep track of in each fsm.
  var playback = ari.Playback();
  var digits = '';
  var retries = 0;
  var muted = false;
  var deafMuted = false;
  var paused = false;
  var talkCounter = 1;
  var listenCounter = 1;
  var recordingCount = 1;
  var pitchChanger = 0;

  // Denodeify everything we need for promises.
  var channelPlay = Q.denodeify(channel.play.bind(channel));
  var ariChannelPlay = Q.denodeify(ari.channels.play.bind(ari));
  var bridgePlay = Q.denodeify(bridge.play.bind(bridge));
  var hangup = Q.denodeify(channel.hangup.bind(channel));
  var ariHangup = Q.denodeify(ari.channels.hangup.bind(ari));
  var addChannel = Q.denodeify(bridge.addChannel.bind(bridge));
  var removeChannel = Q.denodeify(bridge.removeChannel.bind(bridge));
  var mute = Q.denodeify(channel.mute.bind(channel));
  var unmute = Q.denodeify(channel.unmute.bind(channel));
  var setChannelVar = Q.denodeify(channel.setChannelVar.bind(channel));
  var continueInDialplan = Q.denodeify(channel.continueInDialplan.bind(
                                       channel));
  var record = Q.denodeify(bridge.record.bind(bridge));
  var pause = Q.denodeify(ari.recordings.pause.bind(ari));
  var unpause = Q.denodeify(ari.recordings.unpause.bind(ari));

  var fsm = new machina.Fsm({

    initialState: 'inactive',

    printState: function() {
      console.log('Channel entered state', this.state);
    },

    states: {
      'inactive': {
        _onEnter: function() {
          this.printState();
        }
      },
      // The channel waits for PIN authentication in this state.
      'waiting': {
        _onEnter: function() {
          var self = this;
          this.printState();
          if (bridge.locked) {
            var soundToPlay = util.format('sound:%s',
                                          bridgeSettings.locked_sound);
            channelPlay({media: soundToPlay}, playback)
              .catch(function(err) {
                console.error(err);
              })
              .done();
            playback.on('PlaybackFinished', function (event, completedPlayback) {
              hangup()
                .catch(function (err) {
                  console.error(err);
                })
                .done();
            });
          }
          else {
            if (!userSettings.pin_auth) {
              addChannel({channel: channel.id})
                .then(function () {
                  self.transition('active');
                })
                .catch(function(err) {
                  console.error(err);
                })
                .done();
            }
            else {
              var soundToPlay = util.format('sound:%s',
                                            bridgeSettings.enter_pin_sound);
              channelPlay({media: soundToPlay}, playback)
                .catch(function(err) {
                  console.error(err);
                })
                .done();
            }
          }
        },
        dtmf: function(data) {
          var self = this;
          if (data.digit === config.waitingInput.verify) {
            if (parseInt(digits) === bridgeSettings.pin_number) {
              addChannel({channel: channel.id})
                .then(function () {
                  self.transition('active');
                })
                .catch(function(err) {
                  console.error(err);
                })
                .done();
            }
            else {
              retries += 1;
              var soundToPlay = util.format('sound:%s',
                                            bridgeSettings.bad_pin_sound);
              channelPlay({media: soundToPlay}, playback)
                .catch(function(err) {
                  console.error(err);
                })
                .done()
              if (retries > bridgeSettings.pin_retries) {
                playback.on('PlaybackFinished', function (err, completedPlayback) {
                  hangup()
                    .catch(function (err) {
                      console.error(err);
                    })
                    .done();
                });
              }
            }
            digits = '';
          }
          else {
            digits += data.digit;
          }
        }
      },
      // This is where the channel can interact with other conference members.
      'active': {
        _onEnter: function() {
          this.printState();
        },
        dtmf: function(data) {
          var self = this;
          if (data.digit === config.menuInput.admin) {
            if (userSettings.admin) {
              self.transition('admin');
            }
          }
          else if (data.digit === config.menuInput.mute) {
            if (!muted) {
              var soundToPlay = util.format('sound:%s',
                                            bridgeSettings.now_muted_sound);
              mute({direction: 'in'})
                .then(function () {
                  muted = true;
                  return channelPlay({media: soundToPlay});
                })
                .catch(function (err) {
                  console.error(err);
                })
                .done();
            }
            else {
              var soundToPlay = util.format('sound:%s',
                                            bridgeSettings.now_unmuted_sound);
              unmute({direction: 'in'})
                .then(function () {
                  muted = false;
                  return channelPlay({media: soundToPlay});
                })
                .catch(function (err) {
                  console.error(err);
                })
                .done()
            }
          }
          else if (data.digit === config.menuInput.deafMute) {
            if (!deafMuted) {
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
          else if (data.digit === config.menuInput.leaveConf) {
            continueInDialplan({context: config.leaveConf.context,
                                extension: config.leaveConf.extension,
                                priority: config.leaveConf.priority})
              .then(function () {
                console.log('Continuing in the dialplan');
                self.transition('inactive');
              })
              .catch(function (err) {
                console.error(err);
              })
              .done();
          }
          else if (data.digit === config.menuInput.decTalkVol) {
            if (talkCounter > -10) {
              setChannelVar({variable: 'VOLUME(RX)', value: talkCounter})
                .then(function () {
                  talkCounter -= 1;
                })
                .catch(function (err) {
                  console.error(err);
                })
                .done();
            }
          }
          else if (data.digit === config.menuInput.incTalkVol) {
            if (talkCounter < 10) {
              setChannelVar({variable: 'VOLUME(RX)', value: talkCounter})
                .then(function () {
                  talkCounter += 1;
                })
                .catch(function (err) {
                  console.error(err);
                })
                .done();
            }
          }
          else if (data.digit === config.menuInput.resetTalkVol) {
            talkCounter = 1;
            setChannelVar({variable: 'VOLUME(RX)', value: talkCounter})
              .then(function () {
                talkCounter = 1;
              })
              .catch(function (err) {
                console.error(err);
              })
              .done();
          }
          else if (data.digit === config.menuInput.decLisVol) {
            if (listenCounter > -10) {
              setChannelVar({variable: 'VOLUME(TX)', value: listenCounter})
                .then(function () {
                  listenCounter -= 1;
                })
                .catch(function (err) {
                  console.error(err);
                })
                .done();
            }
          }
          else if (data.digit === config.menuInput.incLisVol) {
            if (listenCounter < 10) {
              setChannelVar({variable: 'VOLUME(TX)', value: listenCounter})
                .then(function () {
                  listenCounter += 1;
                })
                .catch(function (err) {
                  console.error(err);
                })
                .done();
            }
          }
          else if (data.digit === config.menuInput.resetLisVol) {
            setChannelVar({variable: 'VOLUME(TX)', value: listenCounter})
              .then(function () {
                listenCounter = 1;
              })
              .catch(function (err) {
                console.error(err);
              })
              .done();
          }
          else if (data.digit === config.menuInput.pitchChange) {
            if (pitchChanger === 0) {
              setChannelVar({variable: 'PITCH_SHIFT(RX)', value: 0.7})
                .then(function () {
                  pitchChanger += 1;
                })
                .catch(function (err) {
                  console.error(err);
                })
                .done();
            }
            else if (pitchChanger === 1) {
              setChannelVar({variable: 'PITCH_SHIFT(RX)', value: 'higher'})
                .then(function () {
                  pitchChanger += 1;
                })
                .catch(function (err) {
                  console.error(err);
                })
                .done()
            }
            else {
              setChannelVar({variable: 'PITCH_SHIFT(RX)', value: 1.0})
                .then(function () {
                  pitchChanger = 0;
                })
                .catch(function (err) {
                  console.error(err);
                })
                .done()
            }
          }
          else {
            console.log(util.format('%s is not a recognized DTMF keybind',
                        data.digit));
          }
        }
      },
      // This state is only accessible by admins, granting certain
      // functionality unique to an admin
      'admin': {
        _onEnter: function() {
          this.printState();
        },
        dtmf: function(data) {
          var self = this;
          if (data.digit === config.adminInput.menu) {
            self.transition('active');
          }
          else if (data.digit === config.adminInput.kick) {
            if (bridge.lastJoined) {
              var chanId = bridge.lastJoined.pop();
              users[chanId].fsm.transition('inactive');
              var soundToPlay = util.format('sound:%s',
                                            bridgeSettings.kicked_sound);
              removeChannel({channel: chanId})
                .then(function () {
                  return ariChannelPlay({channelId: chanId, media: soundToPlay,
                       playbackId: playback.id});
                })
                .catch(function (err) {
                  console.error(err);
                })
                .done();
              playback.on('PlaybackFinished', function (event,
                                                        completedPlayback) {
                if (event.playback.target_uri === util.format('channel:%s',
                                                              chanId)) {
                  ariHangup({channelId: chanId})
                    .catch(function (err) {
                      console.error(err);
                    })
                    .done();
                }
              });
            }
          }
          else if (data.digit === config.adminInput.toggleLock) {
            if (!bridge.locked) {
              var soundToPlay = util.format('sound:%s',
                                            bridgeSettings.now_locked_sound);
              bridgePlay({media: soundToPlay})
                .catch(function (err) {
                  console.error(err);
                })
                .done();
            }
            else {
              var soundToPlay = util.format('sound:%s',
                                bridgeSettings.now_unlocked_sound);
              bridgePlay({media: soundToPlay})
                .catch(function (err) {
                  console.error(err);
                })
                .done();
            }
            bridge.locked = !bridge.locked;
          }
          else if (data.digit === config.adminInput.pauseRecord) {
            if (!bridge.recordingEnabled) {
              record({format: 'wav', name: bridge.currentRecording.name,
                      terminateOn: 'none'})
              .then(function() {
                console.log('Bridge is recording');
                bridge.recordingPaused = false;
                bridge.recordingEnabled = true;
              })
              .catch(function (err) {
                console.error(err);
              })
              .done();
            }
            else if (!bridge.recordingPaused) {
              pause({recordingName: bridge.currentRecording.name})
                .then(function () {
                  bridge.recordingPaused = true;
                  console.log('Recording paused');
                })
                .catch(function (err) {
                  console.error(err);
                })
                .done();
            }
            else {
              unpause({recordingName: bridge.currentRecording.name})
                .then(function () {
                  bridge.recordingPaused = false;
                  console.log('Recording unpaused');
                })
                .catch(function (err) {
                  console.error(err);
                })
                .done();
            }
          }
          else {
            console.log(util.format('%s is not a recognized DTMF keybind',
                        data.digit));
          }
        }
      }
    }

  });

  return fsm;
}

module.exports = createFsm;
