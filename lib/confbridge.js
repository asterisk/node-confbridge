'use-strict'

var util = require('util');

function ConfBridge(ari) {
  var self = this;

  self.start = function (event, channel) {
    if (self.isOwnStasisStart(event)) {
      console.log('Handling ConfBridge call');
      channel.answer(function (err) {
        self.getOrCreateBridge(channel);
      });
    }
  }

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
          self.joinMixingBridgeAndPlayBeep(bridge, channel);
        });
      }
      else {
        self.joinMixingBridgeAndPlayBeep(bridge, channel);
      }
    });
  }

  self.joinMixingBridgeAndPlayBeep = function(bridge, channel) {
    bridge.on('ChannelLeftBridge',
    function (event, instances) {
      var mixingBridge = instances.bridge;
      if (mixingBridge.channels.length === 0 &&
          mixingBridge.id === bridge.id) {
            bridge.destroy(function (err) {});
          }
    });

    bridge.addChannel({channel: channel.id}, function(err) {
      var playback = ari.Playback();
      bridge.play({media: 'sound:beep'}, playback,
          function(err, playback) {});
    });
  }

  ari.on('StasisStart', self.start);
}

module.exports = ConfBridge;
