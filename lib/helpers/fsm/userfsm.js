'use strict';

var machina = require('machina');
var util = require('util');
var Q = require('q');
var config = require('../../../config.json');
var PinAuthModule = require('./modules/pinauth.js');
var BridgeDriverModule = require('./modules/bridgedriver.js');
var ChannelMediaModule = require('./modules/channelmedia.js');
var RecordingDriverModule = require('./modules/recordingdriver.js');

/**
 * Removes the user from the conference and sends them to the configured
 * context, extension, and priority in the dialplan.
 */
var continueInDialplan = function(self, channel) {
  var dialplanContinue = Q.denodeify(channel.continueInDialplan.bind(
                                     channel));
  dialplanContinue({context: config.leaveConf.context,
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
};

/**
 * Creates an fsm for a user and returns it.
 *
 * @return fsm - the fsm to return
 */
function createFsm(channel, ari, userSettings, users, bridge, bridgeSettings) {

  // Some things to keep track of in each fsm.
  var pinAuth = new PinAuthModule();
  var bridgeDriver = new BridgeDriverModule();
  var channelMedia = new ChannelMediaModule();
  var recordingDriver = new RecordingDriverModule();

  var fsm = new machina.Fsm({

    initialState: 'inactive',

    printState: function() {
      console.log('Channel entered state', this.state);
    },

    isActive: function() {
      return this.state === 'active' || this.state === 'admin';
    },

    isInactive: function() {
      return this.state === 'inactive' || this.state === 'waiting';
    },

    states: {

      /** The channel waits in this state until the application
       *  is ready to interact with it.
       */
      'inactive': {
        _onEnter: function() {
          this.printState();
        },
        ready: function() {
          this.transition('waiting');
        }
      },

      /**
       * The channel waits in this state until the application lets it know
       * that the conference is locked, or if a PIN code is required. Stays in
       * this state until a correct PIN is entered, or if no PIN is required,
       * it is immediately placed in the conference.
       */
      'waiting': {
        _onEnter: function() {
          var self = this;
          this.printState();
          if (bridge.locked) {
            bridgeDriver.bridgeIsLocked(ari, channel, bridgeSettings);
          }
          else {
            if (!userSettings.pin_auth) {
              bridgeDriver.addToBridge(channel, bridge)
                .then(function() {
                  self.transition('active');
                })
                .catch(function (err) {
                  console.error(err);
                })
                .done();
            }
            else {
              pinAuth.enterPin(ari, channel, bridgeSettings);
            }
          }
        },
        dtmf: function(data) {
          var self = this;
          if (data.digit === config.waitingInput.verify) {
            if (parseInt(pinAuth.getDigits()) === bridgeSettings.pin_number) {
              bridgeDriver.addToBridge(channel, bridge)
                .then(function() {
                  self.transition('active');
                })
                .catch(function (err) {
                  console.error(err);
                })
                .done();
            }
            else {
              pinAuth.invalidPin(ari, channel, bridgeSettings);
            }
          }
          else {
            pinAuth.addDigit(data.digit);
          }
        },
        done: function() {
          this.transition('inactive');
        }
      },

      /**
       * While the channel is in this state, it can interact with other users in
       * the conference.
       */
      'active': {
        _onEnter: function() {
          this.printState();
        },
        dtmf: function(data) {
          var self = this;
          switch (data.digit) {

            // Transition to admin menu if user has admin flag
            case config.menuInput.admin:
              if (userSettings.admin) {
                self.transition('admin');
              }
              break;

            // Mutes the channel
            case config.menuInput.mute:
              channelMedia.muteChannel(ari, bridgeSettings, channel);
              break;

            // Deaf mutes the channel
            case config.menuInput.deafMute:
              channelMedia.deafMuteChannel(channel);
              break;

            // Leaves the conference and executes configured dialplan
            case config.menuInput.contInDialplan:
              continueInDialplan(self, channel);
              break;

            // Decreases audio volume the channel hears
            case config.menuInput.decLisVol:
              channelMedia.decrementListenVolume(channel);
              break;

            // Resets audio volume the channel hears
            case config.menuInput.resetLisVol:
              channelMedia.resetListenVolume(channel);
              break;

            // Increases audio volume the channel hears
            case config.menuInput.incLisVol:
              channelMedia.incrementListenVolume(channel);
              break;

            // Decreases audio volume the channel outputs
            case config.menuInput.decTalkVol:
              channelMedia.decrementTalkVolume(channel);
              break;

            // Resets audio volume the channel outputs
            case config.menuInput.resetTalkVol:
              channelMedia.resetTalkVolume(channel);
              break;

            // Increases audio volume the channel outputs
            case config.menuInput.incTalkVol:
              channelMedia.incrementTalkVolume(channel);
              break;

            // Changes the pitch of the audio the channel outputs
            case config.menuInput.pitchChange:
              channelMedia.pitchChange(channel);
              break;

            // DTMF has no specified functionality
            default:
              console.log(util.format('%s is not a recognized DTMF keybind',
                          data.digit));
              break;
          }
        },
        done: function() {
          this.transition('inactive');
        }
      },

      /**
       * While the channel is in this state, it can interact with other users
       * and the bridge in a way unique to an admin. Only users with the admin
       * flag set to true in the database can access this state.
       */
      'admin': {
        _onEnter: function() {
          this.printState();
        },
        dtmf: function(data) {
          var self = this;
          switch (data.digit) {

            // Transition back to active menu
            case config.adminInput.menu:
              self.transition('active');
              break;

            // Lock or unlock the conference
            case config.adminInput.toggleLock:
              bridgeDriver.toggleLock(ari, bridge, bridgeSettings);
              break;

            // Kick the last user that joined the conference
            case config.adminInput.kick:
              bridgeDriver.kickLast(ari, bridge, bridgeSettings, users);
              break;

            // Start recording, pause recording, or unpause recording
            case config.adminInput.toggleRecord:
              recordingDriver.handleRecording(ari, bridge, bridgeSettings);
              break;

            // DTMF has no specified functionality
            default:
              console.log(util.format('%s is not a recognized DTMF keybind',
                                      data.digit));
              break;
          }
        },
        done: function() {
          this.transition('inactive');
        }
      },
    }

  });

  return fsm;
}

module.exports = createFsm;
