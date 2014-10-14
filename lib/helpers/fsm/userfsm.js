'use strict';

var machina = require('machina');
var util = require('util');

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

    initialState: 'waiting',

    printState: function() {
      console.log('Channel entered state', this.state);
    },

    states: {
      // The channel waits for DTMF input in this state.
      'waiting': {
        _onEnter: function() {
          var self = this;
          this.printState();
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
        },
        dtmf: function(data) {
          var self = this;
          if (data.digit === '#') {
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
                    console.error();
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
      'active': {
        _onEnter: function() {
          this.printState();
        },
        dtmf: function(data) {
          console.log(data.digit);
        }
      }
    }

  });

  return fsm;
}

module.exports = createFsm;
