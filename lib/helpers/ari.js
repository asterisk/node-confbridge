'use-strict';

var Q = require('q');
var ariClient = require('ari-client');
var config = require('../../config.json');
var connect = Q.denodeify(ariClient.connect);

module.exports = connect(config.ariConnection.url, config.ariConnection.user,
    config.ariConnection.pass)
    .then(function(client) {
      client.start(['confbridge']);
      return client;
    })
    .catch(function(err) {
      console.error(err);
    });
