'use strict';

var Q = require('q');
var util = require('util');
var db = require('../../data/db.js');
var UserSetup = require('./usersetup.js');
var BridgeFsm = require('./fsm/bridgefsm.js');

function BridgeSetup(ari) {
  var self = this;

  var bridge = ari.Bridge();
  var playback = ari.Playback();
  // Will contain the bridge configuration fetched from the database.
  var settings = null;
  // The class used to store users that entered the bridge.
  var users = new UserSetup(ari, db);
  // The finite state machine for the bridge.
  var bridgeFsm = null;

  /**
   * Fetches the bridge configuration from the database and stores it in
   * the settings variable.
   */
  self.init = function() {
    var createBridge = Q.denodeify(bridge.create.bind(bridge));
    createBridge({type: 'mixing,dtmf_events'})
      .then(function () {
        self.registerEvents(bridge);
      })
      .then(function () {
        return db.getBridgeSettings();
      })
      .then(function (result) {
        settings = result;
      })
      .then(function () {
        bridgeFsm = BridgeFsm(bridge, settings);
      })
      .catch(function (err) {
        console.error(err);
      })
      .done();
  }

  /**
   * Sends audio to the bridge.
   *
   * @param {String} sound - the sound to play to the bridge
   */
  self.playSound = function(bridge, sound) {
    bridge.play({media: sound}, playback, function (err, playback) {});
  }

  /**
   * Places the channel into the bridge and plays the join sound.
   *
   * @param {Object} event - the StasisStart event
   * @param {Object} channel - the channel to put into the bridge
   */
  self.joinMixingBridge = function(event, channel) {
    users.storeUser(event, channel, bridge, settings);
  }

  /**
   * Registers event listeners to the bridge.
   *
   * @param {Object} bridge - the bridge to register events to
   */
  self.registerEvents = function(bridge) {
    bridge.on('ChannelEnteredBridge', function (event, instances) {
      bridgeFsm.handle('userJoin');
      if (!settings.quiet) {
        var soundToPlay = util.format('sound:%s', settings.join_sound);
        self.playSound(bridge, soundToPlay);
      }
    });
    bridge.on('ChannelLeftBridge', function (event, instances) {
      bridgeFsm.handle('userExit', {confBridge: instances.bridge});
      if (!settings.quiet) {
        var soundToPlay = util.format('sound:%s', settings.leave_sound);
        self.playSound(bridge, soundToPlay);
      }
    });
  }

}

module.exports = BridgeSetup;
