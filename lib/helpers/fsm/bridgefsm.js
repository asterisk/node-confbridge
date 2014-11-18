'use strict';

var machina = require('machina');
var util = require('util');
var uuid = require('node-uuid');
var Q = require('q');

/**
 * Creates an fsm for a bridge and returns it.
 *
 * @returns fsm - the fsm to return
 */
function createFsm(ari, bridge, settings, users) {

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
          bridge.locked = false;
          bridge.recordingPaused = true;
          bridge.recordingEnabled = false;
          console.log('Bridge auto-unlocked');
        },
        'userJoin': function() {
          this.transition('single');
        },
        _onExit: function() {
          var recordingName = util.format('confbridge-rec %s', uuid.v4());
          bridge.currentRecording = ari.LiveRecording({name: recordingName});
          if (settings.record_conference) {
            var record = Q.denodeify(bridge.record.bind(bridge));
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
        }
      },
      // The state when only a singler user is in the bridge.
      'single': {
        _onEnter: function() {
          this.printState();
          var userList = users.getUsers();
          var startMoh = Q.denodeify(ari.channels.startMoh.bind(ari));
          for (var chanId in userList) {
            if (userList[chanId].settings.moh) {
              startMoh({channelId: chanId})
                .catch(function (err) {
                  console.error(err);
                })
                .done();
            }
          }  
        },
        _onExit: function() {
          var userList = users.getUsers();
          var stopMoh = Q.denodeify(ari.channels.stopMoh.bind(ari));
          for (var chanId in userList) {
            if (userList[chanId].settings.moh) {
              stopMoh({channelId: chanId})
                .catch(function (err) {
                  console.error(err);
                })
                .done();
            }
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
