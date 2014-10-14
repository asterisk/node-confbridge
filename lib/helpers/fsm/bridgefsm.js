'use strict';

var machina = require('machina');

/**
 * Creates an fsm for a bridge and returns it.
 *
 * @returns fsm - the fsm to return
 */
function createFsm(bridge, settings) {

  var fsm = new machina.Fsm({

    initialState: 'empty',

    printState: function() {
      console.log('Bridge entered state', this.state);
    },

    states: {
      // The state just before placing a channel into the bridge.
      'empty': {
        _onEnter: function() {
          this.printState();
        },
        'userJoin': function() {
          this.transition('single');
        }
      },
      // The state when only a singler user is in the bridge.
      'single': {
        _onEnter: function() {
          this.printState();
          if (settings.moh) {
            bridge.startMoh(function (err) {});
          }
        },
        _onExit: function() {
          if (settings.moh) {
            bridge.stopMoh(function (err) {});
          }
        },
        'userJoin': function() {
          this.transition('multi');
        },
        'userExit': function() {
          this.transition('empty');
        }
      },
      // The state when multiple users are in the bridge.
      'multi': {
        _onEnter: function() {
          this.printState();
        },
        'userExit': function(data) {
          if (data.confBridge.channels.length === 1 &&
              data.confBridge.id === bridge.id) {
            this.transition('single');
          }
        }
      }
    }

  });

  return fsm;
}

module.exports = createFsm;
