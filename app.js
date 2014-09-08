'use strict';

var ari = require('./lib/helpers/ari.js');
var ConfBridge = require('./lib/confbridge.js');

ari.then(function(client) {
  console.log('initializing confbridge');
  
  var confbridge = new ConfBridge(client);
}).done();
