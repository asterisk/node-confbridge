'use strict';

var Q = require('q');
var util = require('util');
var db = require('../../data/db.js');
var UserSetup = require('./usersetup.js');

function BridgeSetup(ari) {
  var self = this;

  var playback = ari.Playback();
  // Will contain the bridge configuration fetched from the database.
  var settings = null;
  // The class used to store users that entered the bridge.
  var users = new UserSetup(db);

  /**
   * Fetches the bridge configuration from the database and stores it in
   * the settings variable.
   */
  self.init = function() {
    db.getBridgeSettings()
      .then(function (result) {
        settings = result;
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
   * Finds the bridge or creates one if it doesn't exist.
   *
   * @return {Q} promise - returns a promise containing the bridge
   */
  self.getOrCreateBridge = function() {
    var deferred = Q.defer();
    ari.bridges.list(function (err, bridges) {
      if (err) {
        deferred.reject(err);
        return;
      }
      var bridge = null;
      bridges.forEach(function (candidate) {
        if (candidate.bridge_type === 'mixing') {
          bridge = candidate;
        }
      });
      if (!bridge) {
        bridge = ari.Bridge();
        bridge.create({type: 'mixing'}, function (err, bridge) {
          if (err) {
            deferred.reject(err);
          }
          else {
            deferred.resolve(bridge);
            self.registerEvents(bridge);
          }
        });
      }
      else {
        deferred.resolve(bridge);
      }
    });
    return deferred.promise;
  }

  /**
   * Places the channel into the bridge and plays the join sound.
   *
   * @param {Object} bridge - the bridge to put the channel in
   * @param {Object} channel - the channel to put into the bridge
   */
  self.joinMixingBridge = function(event, channel) {
    var bridge = undefined;
    return self.getOrCreateBridge()
      .then(function (result) {
        bridge = result;
      })
      .then(function () {
        bridge.addChannel({channel: channel.id}, function (err) {
          users.storeUser(event, channel);
          if (!settings.quiet) {
            var soundToPlay = util.format('sound:%s', settings.join_sound);
            self.playSound(bridge, soundToPlay);
          }
        });
      })
      .catch(function (err) {
        console.error(err);
      })
      .done();
  }

  /**
   * Registers event listeners to the bridge.
   *
   * @param {Object} bridge - the bridge to register events to
   */
  self.registerEvents = function(bridge) {
    bridge.on('ChannelEnteredBridge', function (event, instances) {
      var mixBridge = instances.bridge;
      if (settings.moh) {
        if (mixBridge.channels.length === 1 &&
            mixBridge.id === bridge.id) {
          mixBridge.startMoh(function (err) {});
        }
        else {
          mixBridge.stopMoh(function (err) {});
        }
      }
    });
    bridge.on('ChannelLeftBridge', function (event, instances) {
      users.deleteUser(instances.channel);
      var mixingBridge = instances.bridge;
      if (mixingBridge.channels.length === 0 &&
          mixingBridge.id === bridge.id) {
        bridge.destroy(function (err) {});
      }
      else {
        if (settings.moh) {
          if (mixingBridge.channels.length === 1 &&
              mixingBridge.id === bridge.id) {
            mixingBridge.startMoh(function (err) {});
          }
        }
      }
      if (!settings.quiet) {
        var soundToPlay = util.format('sound:%s', settings.leave_sound);
        self.playSound(mixingBridge, soundToPlay);
      }
    });
  }

}

module.exports = BridgeSetup;
