'use-strict'

var BridgeSetup = require('./helpers/bridgesetup.js');

/**
 * ConfBridge constructor.
 *
 * @param {ari-client~Client} ari - ARI client
 */
function ConfBridge(ari) {
  var self = this;

  // Sets up the driver class to place users into the conference.
  var bridgeSetup = new BridgeSetup(ari);
  bridgeSetup.init();

  /**
   * Handles StasisStart event to initialize bridge.
   *
   * @param {Object} event - the event object
   * @param {ari-client~Channel} incoming - the channel entering Stasis
   */
  self.start = function(event, incoming) {
    incoming.answer(function (err) {
      bridgeSetup.joinMixingBridge(event, incoming);
    });
  }

  ari.on('StasisStart', self.start);
};

module.exports = ConfBridge;
