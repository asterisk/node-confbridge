'use strict';

var machina = require('machina');
var util = require('util');
var uuid = require('node-uuid');
var Q = require('q');
var BridgeDriverModule = require('./modules/bridgedriver.js');
var ChannelMediaModule = require('./modules/channelmedia.js');
var RecordingDriverModule = require('./modules/recordingdriver.js');

/**
 * Creates an fsm for a bridge and returns it.
 *
 * @returns fsm - the fsm to return
 */
function createFsm(ari, bridge, users) {

  var bridgeDriver = new BridgeDriverModule();
  var channelMedia = new ChannelMediaModule();
  var recordingDriver = new RecordingDriverModule();

  var fsm = new machina.Fsm({

    initialState: 'empty',

    printState: function() {
      console.log('Bridge entered state', this.state);
    },

    states: {

      // The state where no channels are in the bridge.
      'empty': {
        _onEnter: function() {
          this.printState();
          bridgeDriver.setToDefault(bridge);
        },

        'userJoin': function(data) {
          this.transition('single');
        },

        _onExit: function() {
          var recordingName = util.format('confbridge-rec %s', uuid.v4());
          bridge.currentRecording = ari.LiveRecording({name: recordingName});
          if (bridge.settings.record_conference) {
            var record = Q.denodeify(bridge.record.bind(bridge));
            recordingDriver.startRecording(bridge)
              .then(function () {
                var userList = users.getUsers();
                for (var chanId in userList) {
                  channelMedia.announceRecording(ari, chanId, bridge);
                }
              })
              .catch(function (err) {
                console.error(err);
              })
              .done();
          }
        }
      },

      // The state where only a single user is in the bridge.
      'single': {
        _onEnter: function() {
          this.printState();
          var userList = users.getUsers();
          for (var chanId in userList) {
            if (userList[chanId].settings.moh) {
              channelMedia.startMoh(ari, chanId);
            }
          }  
        },

        _onExit: function() {
          var userList = users.getUsers();
          for (var chanId in userList) {
            if (userList[chanId].settings.moh &&
                userList[chanId].fsm.isActive()) {
              channelMedia.stopMoh(ari, chanId);
            }
          }
        },

        'userJoin': function(data) {
          this.transition('multi');
          channelMedia.announceRecording(ari, data.channelId, bridge);
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

        'userJoin': function(data) {
          channelMedia.announceRecording(ari, data.channelId, bridge);
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
