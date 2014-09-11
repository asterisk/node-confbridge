'use-strict'

var util = require('util');

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
   * Finds the bridge or creates one if it doesn't exist.
   *
   * @param {Object} channel - the channel entering the bridge
   */
  self.getOrCreateBridge = function(channel) {
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
      }
      else {
        self.joinMixingBridge(bridge, channel);
      }
    });
  }

  /**
   * Places the channel into the bridge. When no channels remain, destroy the
   * bridge.
   *
   * @param {Object} bridge - the bridge to put the channel in
   * @param {Object} channel - the channel to put into the bridge
   */
  self.joinMixingBridge = function(bridge, channel) {
    var playback = ari.Playback();
    bridge.on('ChannelLeftBridge', function (event, instances) {
      instances.bridge.play({media: 'sound:confbridge-leave'}, playback, 
        function (err, playback) {});
      var mixingBridge = instances.bridge;
      if (mixingBridge.channels.length === 0 && 
          mixingBridge.id === bridge.id) {
        bridge.destroy(function (err) {});
      }
    });
    bridge.addChannel({channel: channel.id}, function (err) {});
    bridge.play({media: 'sound:confbridge-join'}, playback, function (err, 
      playback) {});
  }

  ari.on('StasisStart', self.start);
};

module.exports = ConfBridge;
