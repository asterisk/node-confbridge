'use-strict'

var config = require('../config.json');
var pg = require('pg');
var util = require('util');

var client = new pg.Client(config.dbConnection);
client.connect();
var query = null;
client.query('SELECT * FROM system_admin', function (err, result) {
  query = result.rows[0];
});

/**
 * ConfBridge constructor.
 *
 * @param {ari-client~Client} ari - ARI client
 */
function ConfBridge(ari) {
  var self = this;

  /**
   * Handles StasisStart event to initialize bridge.
   *
   * @param {Object} event - the event object
   * @param {ari-client~Channel} incoming - the channel entering Stasis
   */
  self.start = function(event, incoming) {
    incoming.answer(function (err) {
      self.getOrCreateBridge(incoming);
    });
  }

  /**
   * Finds the bridge or creates one if it doesn't exist. Destroys the bridge
   * when no users remain. Registers listeners to handle events for the bridge.
   *
   * @param {Object} channel - the channel entering the bridge
   */
  self.getOrCreateBridge = function(channel) {
    var playback = ari.Playback();
    ari.bridges.list(function (err, bridges) {
      var bridge = null;
      bridges.forEach(function (candidate) {
        if (candidate.bridge_type === 'mixing') {
          bridge = candidate;
        }
      });
      if (!bridge) {
        bridge = ari.Bridge();
        bridge.create({type: 'mixing'}, function (err, bridge) {
          self.joinMixingBridge(bridge, channel);
        });
        bridge.on('ChannelEnteredBridge', function (event, instances) {
          var mixBridge = instances.bridge;
          if (query.moh === 'y') {
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
          var mixingBridge = instances.bridge;
          if (mixingBridge.channels.length === 0 &&
              mixingBridge.id === bridge.id) {
            bridge.destroy(function (err) {});
          }
          else {
            if (query.moh === 'y') {
              if (mixingBridge.channels.length === 1 &&
                  mixingBridge.id === bridge.id) {
                mixingBridge.startMoh(function (err) {});
              }
            }
          }
          if (query.quiet === 'n') {
            var soundToPlay = util.format('sound:%s', query.leave_sound);
            mixingBridge.play({media: soundToPlay}, playback,
              function (err, playback) {});
          }
        });
      }
      else {
        self.joinMixingBridge(bridge, channel);
      }
    });
  }

  /**
   * Places the channel into the bridge and plays the join sound.
   *
   * @param {Object} bridge - the bridge to put the channel in
   * @param {Object} channel - the channel to put into the bridge
   */
  self.joinMixingBridge = function(bridge, channel) {
    var playback = ari.Playback();
    bridge.addChannel({channel: channel.id}, function (err) {
      if (query.quiet === 'n') {
        var soundToPlay = util.format('sound:%s', query.join_sound);
        bridge.play({media: soundToPlay}, playback, function (err,
          playback) {});
      }
    });
  }

  ari.on('StasisStart', self.start);
};

module.exports = ConfBridge;
