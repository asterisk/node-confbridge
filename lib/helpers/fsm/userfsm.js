'use strict';

var machina = require('machina');
var util = require('util');

var INPUT = {
  waiting: {
    verify: '#'
  },
  menu: {
    admin: '#'
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
