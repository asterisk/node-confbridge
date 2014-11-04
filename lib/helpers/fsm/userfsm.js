'use strict';

var machina = require('machina');
var util = require('util');
var config = require('../../../config.json');

/**
 * Creates an fsm for a user and returns it.
 *
 * @returns fsm - the fsm to return
 */
function createFsm(channel, ari, userSettings, bridge, bridgeSettings) {

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


  var fsm = new machina.Fsm({

    initialState: 'init',

    printState: function() {
      console.log('Channel entered state', this.state);
    },

    states: {
      'init': {
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
            channel.play({media: soundToPlay}, playback, 
                                               function (err, playback) {
              if (err) {
                console.error(err);
              }
            });
            playback.on('PlaybackFinished', function (event, 
                                                      completedPlayback) {
              channel.hangup(function (err) {
                if (err) {
                  console.error(err);
                }
              });
            });
          }
          else {
            if (!userSettings.pin_auth) {
              bridge.addChannel({channel: channel.id}, function (err) {
                if (err) {
                  console.error(err);
                }
                self.transition('active');
              });
            }
            else {
              var soundToPlay = util.format('sound:%s', 
                                            bridgeSettings.enter_pin_sound);
              channel.play({media: soundToPlay}, playback, 
                                                 function (err, playback) {
                if (err) {
                  console.error(err);
                }
              });
            }
          }
        },
        dtmf: function(data) {
          var self = this;
          if (data.digit === config.waitingInput.verify) {
            if (parseInt(digits) === bridgeSettings.pin_number) {
              console.log('Correct PIN');
              bridge.addChannel({channel: channel.id}, function (err) {
                if (err) {
                  console.error(err);
                }
                self.transition('active');
              });
            }
            else {
              console.log('Incorrect PIN');
              retries += 1;
              var soundToPlay = util.format('sound:%s', 
                                            bridgeSettings.bad_pin_sound);
              channel.play({media: soundToPlay}, playback, 
                                                function (err, playback) {});
              if (retries > bridgeSettings.pin_retries) {
                playback.on('PlaybackFinished', function (err, 
                                                          completedPlayback) {
                  channel.hangup(function (err) {
                    if (err) {
                      console.error(err);
                    }
                    console.log('Max retries reached');
                  });
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
              channel.mute({direction: 'in'}, function (err) {
                if (err) {
                  console.error(err);
                }
                var soundToPlay = util.format('sound:%s',
                                  bridgeSettings.now_muted_sound);
                channel.play({media: soundToPlay}, function (err) {
                  if (err) {
                    console.error(err);
                  }
                });
                muted = true;
                console.log('Channel Muted');
              });
            }
            else {
              channel.unmute({direction: 'in'}, function (err) {
                if (err) {
                  console.error(err);
                }
                var soundToPlay = util.format('sound:%s',
                                  bridgeSettings.now_unmuted_sound);
                channel.play({media: soundToPlay}, function (err) {
                  if (err) {
                    console.error(err);
                  }
                });
                muted = false;
                console.log('Channel Unmuted');
              });
            }
          }
          else if (data.digit === config.menuInput.deafMute) {
            if (!deafMuted) {
              channel.mute({direction: 'both'}, function (err) {
                if (err) {
                  console.error(err);
                }
                deafMuted = true;
                console.log('Channel is Deaf Muted');
              });
            }
            else {
              channel.unmute({direction: 'both'}, function (err) {
                if (err) {
                  console.error(err);
                }
                deafMuted = false;
                console.log('Channel is Undeaf Muted');
              });
            }
          }
          else if (data.digit === config.menuInput.leaveConf) {
            channel.continueInDialplan({context: 'LocalSets', extension: '707',
                                        priority: 1}, function (err) {
              if (err) {
                console.error(err);
              }
              console.log('continuing in the dialplan');
            });
          }
          else if (data.digit === config.menuInput.decTalkVol) {
            if (talkCounter > -10) {
              channel.setChannelVar({variable: 'VOLUME(RX)',
                                     value: talkCounter}, function (err) {
                if (err) {
                  console.error(err);
                }
                talkCounter -= 1;
              });
            }
          }
          else if (data.digit === config.menuInput.incTalkVol) {
            if (talkCounter < 10) {
              channel.setChannelVar({variable: 'VOLUME(RX)',
                                     value: talkCounter}, function (err) {
                if (err) {
                  console.error(err);
                }
                talkCounter += 1;
              });
            }
          }
          else if (data.digit === config.menuInput.resetTalkVol) {
            talkCounter = 1;
            channel.setChannelVar({variable: 'VOLUME(RX)',
                                   value: talkCounter}, function (err) {
              if (err) {
                console.error(err);
              }
            });
          }
          else if (data.digit === config.menuInput.decLisVol) {
            if (listenCounter > -10) {
              channel.setChannelVar({variable: 'VOLUME(TX)',
                                     value: listenCounter}, function (err) {
                if (err) {
                  console.error(err);
                }
                listenCounter -= 1;
              });
            }
          }
          else if (data.digit === config.menuInput.incLisVol) {
            if (listenCounter < 10) {
              channel.setChannelVar({variable: 'VOLUME(TX)',
                                     value: listenCounter}, function (err) {
                if (err) {
                  console.error(err);
                }
                listenCounter += 1;
              });
            }
          }
          else if (data.digit === config.menuInput.resetLisVol) {
            listenCounter = 1;
            channel.setChannelVar({variable: 'VOLUME(TX)',
                                   value: listenCounter}, function (err) {
              if (err) {
                console.error(err);
              }
            });
          }
          else if (data.digit === config.menuInput.pitchChange) {
            if (pitchChanger === 0) {
              channel.setChannelVar({variable: 'PITCH_SHIFT(RX)',
                                     value: 0.7}, function (err) {
                if (err) {
                  console.error(err);
                }
                pitchChanger += 1;
              });
            }
            else if (pitchChanger === 1) {
              channel.setChannelVar({variable: 'PITCH_SHIFT(RX)',
                                     value: 'higher'}, function (err) {
                if (err) {
                  console.error(err);
                }
                pitchChanger += 1;
              });
            }
            else {
              channel.setChannelVar({variable: 'PITCH_SHIFT(RX)',
                                     value: 1.0}, function (err) {
                if (err) {
                  console.error(err);
                }
                pitchChanger = 0;
              });
            }
          }
          else {
            console.log('%s is Not A Recognized DTMF Keybind', data.digit);
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
              ari.channels.hangup({channelId: chanId}, function (err) {
                if (err) {
                  console.error(err);
                }
              });
            }
          }
          else if (data.digit === config.adminInput.toggleLock) {
            if (!bridge.locked) {
              var soundToPlay = util.format('sound:%s',
                                            bridgeSettings.now_locked_sound);
              bridge.play({media: soundToPlay}, function (err) {
                if (err) {
                  console.error(err);
                }
              });
            }
            else {
              var soundToPlay = util.format('sound:%s',
                                bridgeSettings.now_unlocked_sound);
              bridge.play({media: soundToPlay}, function (err) {
                if (err) {
                  console.error(err);
                }
              });
            }
            bridge.locked = !bridge.locked;
          }
          else if (data.digit === config.adminInput.pauseRecord) {
            if (!paused) {
              ari.recordings.pause({recordingName: bridge.recordingNow.name}, 
                                   function (err) {
                if (err) {
                  console.error(err);
                }
                paused = true;
                console.log('Recording is Paused');
              });
            }
            else {
              ari.recordings.unpause({recordingName: bridge.recordingNow.name}, 
                                     function (err) {
                if (err) {
                  console.error(err);
                }
                paused = false;
                console.log('Recording is Unpaused');
              });
            }
          }
          else {
            console.log(data.digit);
          }
        }
      }
    }

  });

  return fsm;
}

module.exports = createFsm;
