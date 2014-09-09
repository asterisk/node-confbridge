'use-strict'

var util = require('util');

function ConfBridge(ari) {
  var self = this;
  this.ari = ari;

  self.start = function (event, incoming) {
    incoming.answer(function (err) {
    getOrCreateBridge(incoming);
    });
  }

  function getOrCreateBridge (channel) {
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
          joinMixingBridgeAndPlayBeep(bridge, channel);
        });
      }
      else {
        joinMixingBridgeAndPlayBeep(bridge, channel);
      }
    });
  }

  function joinMixingBridgeAndPlayBeep (bridge, channel) {
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
      channel.play({media: 'sound:beep'}, playback,
          function(err, playback) {});
    });
  }

  this.ari.on('StasisStart', self.start);

}

module.exports = ConfBridge;
