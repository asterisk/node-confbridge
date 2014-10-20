'use strict';

var machina = require('machina');
var util = require('util');

var INPUT = {
  waiting: {
    verify: '#'
  },
  menu: {
    admin: '#',
    mute: '1',
    deaf_mute: '2',
    leave_conf: '3',
    dec_lis_vol: '4',
    reset_lis_vol: '5',
    inc_lis_vol: '6',
    dec_talk_vol: '7',
    reset_talk_vol: '8',
    inc_talk_vol: '9',
    pitch_change: '0'
  },
  admin: {
    menu: '#',
    kick: '2',
    toggleLock: '1'
  }
};

/**
 * Creates an fsm for a user and returns it.
 *
 * @returns fsm - the fsm to return
 */
function createFsm(channel, ari, userSettings, bridge, bridgeSettings) {

  var playback = ari.Playback();
  var digits = '';
  var retries = 0;
  var muteToggle = 0;
  var deafMuteToggle = 0;
  var talkCounter = 1;
  var listenCounter = 1;
  var pitch_changer = 0;

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
            var soundToPlay = util.format('sound:%s', bridgeSettings.locked_sound);
            channel.play({media: soundToPlay}, playback, function (err, playback) {
              if (err) {
                console.error(err);
              }
            });
            playback.on('PlaybackFinished', function (event, completedPlayback) {
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
              var soundToPlay = util.format('sound:%s', bridgeSettings.enter_pin_sound);
              channel.play({media: soundToPlay}, playback, function (err, playback) {
                if (err) {
                  console.error(err);
                }
              });
            }
          }
        },
        dtmf: function(data) {
          var self = this;
          if (data.digit === INPUT.waiting.verify) {
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
              var soundToPlay = util.format('sound:%s', bridgeSettings.bad_pin_sound);
              channel.play({media: soundToPlay}, playback, function (err, playback) {});
              if (retries > bridgeSettings.pin_retries) {
                channel.hangup({channel: channel.id}, function (err) {
                  if (err) {
                    console.error(err);
                  }
                  console.log('Max retries reached');
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
          if (data.digit === INPUT.menu.admin) {
            if (userSettings.admin) {
              self.transition('admin');
            }
          }
          else if (data.digit === INPUT.menu.mute) {
            if (muteToggle === 0) {
              channel.mute({channel: channel.id, direction: 'in'}, function (err) {
                if (err) {
                  console.error(err);
                }
                console.log('Channel Muted');
              });
              muteToggle += 1;
            }
            else {
              channel.unmute({channel: channel.id, direction: 'in'}, function (err) {
                if (err) {
                  console.error(err);
                }
                console.log('Channel Unmuted');
              });
              muteToggle = 0;
            }
          }
          else if (data.digit === INPUT.menu.deaf_mute) {
            if (deafMuteToggle === 0) {
              channel.mute({channel: channel.id, direction: 'both'}, function (err) {
                if (err) {
                  console.error(err);
                }
                console.log('Channel is Deaf Muted');
              });
              deafMuteToggle += 1;
            }
            else {
              channel.unmute({channel: channel.id, direction: 'both'}, function (err) {
                if (err) {
                  console.error(err);
                }
                console.log('Channel is Undeaf Muted');
              });
              deafMuteToggle = 0;
            }
          }
          else if (data.digit === INPUT.menu.leave_conf) {
            channel.continueInDialplan({channel: channel.id, context: 'LocalSets',
                               extension: '707', priority: 1}, function (err) {
              if (err) {
                console.error(err);
              }
              console.log('continuing in the dialplan');
            });
          }
          else if (data.digit === INPUT.menu.dec_talk_vol) {
            if (talkCounter > -10) {
              channel.setChannelVar({channel: channel.id, variable: 'VOLUME(RX)',
                                   value: talkCounter}, function (err) {
                if (err) {
                  console.error(err);
                }
                talkCounter -= 1;
              });
            }
          }
          else if (data.digit === INPUT.menu.inc_talk_vol) {
            if (talkCounter < 10) {
              channel.setChannelVar({channel: channel.id, variable: 'VOLUME(RX)',
                                   value: talkCounter}, function (err) {
                if (err) {
                  console.error(err);
                }
                talkCounter += 1;
              });
            }
          }
          else if (data.digit === INPUT.menu.reset_talk_vol) {
            talkCounter = 1;
            channel.setChannelVar({channel: channel.id, variable: 'VOLUME(RX)',
                                   value: talkCounter}, function (err) {
              if (err) {
                console.error(err);
              }
            });
          }
          else if (data.digit === INPUT.menu.dec_lis_vol) {
            if (listenCounter > -10) {
              channel.setChannelVar({channel: channel.id, variable: 'VOLUME(TX)',
                                   value: listenCounter}, function (err) {
                if (err) {
                  console.error(err);
                }
                listenCounter -= 1;
              });
            }
          }
          else if (data.digit === INPUT.menu.inc_lis_vol) {
            if (listenCounter < 10) {
              channel.setChannelVar({channel: channel.id, variable: 'VOLUME(TX)',
                                   value: listenCounter}, function (err) {
                if (err) {
                  console.error(err);
                }
                listenCounter += 1;
              });
            }
          }
          else if (data.digit === INPUT.menu.reset_lis_vol) {
            listenCounter = 1;
            channel.setChannelVar({channel: channel.id, variable: 'VOLUME(TX)',
                                   value: listenCounter}, function (err) {
              if (err) {
                console.error(err);
              }
            });
          }
          else if (data.digit === INPUT.menu.pitch_change) {
            if (pitch_changer === 0) {
              channel.setChannelVar({channel: channel.id, variable: 'PITCH_SHIFT(RX)',
                                   value: 0.7}, function (err) {
                if (err) {
                  console.error(err);
                }
                pitch_changer += 1;
              });
            }
            else if (pitch_changer === 1) {
              channel.setChannelVar({channel: channel.id, variable: 'PITCH_SHIFT(RX)',
                                     value: 'higher'}, function (err) {
                if (err) {
                  console.error(err);
                }
                pitch_changer += 1;
              });
            }
            else {
              channel.setChannelVar({channel: channel.id, variable: 'PITCH_SHIFT(RX)',
                                   value: 1.0}, function (err) {
                if (err) {
                  console.error(err);
                }
                pitch_changer = 0;
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
          if (data.digit === INPUT.admin.menu) {
            self.transition('active');
          }
          else if (data.digit === INPUT.admin.kick) {
            if (bridge.lastJoined) {
              var chanId = bridge.lastJoined.pop();
              ari.channels.hangup({channelId: chanId}, function (err) {
                if (err) {
                  console.error(err);
                }
              });
            }
          }
          else if (data.digit === INPUT.admin.toggleLock) {
            if (bridge.locked) {
              console.log('Bridge is now unlocked');
            }
            else {
              console.log('Bridge is now locked');
            }
            bridge.locked = !bridge.locked;
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
