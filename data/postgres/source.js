'use strict';

var pg = require('pg');
var Q = require('q');

function PostgresDB(dbConfig) {

  /**
   * Retrieves the settings for the bridge.
   *
   * @return {Q} result - a promise containing the row where the bridge
   *   settings are stored
   */
  this.getBridgeSettings = function() {
    var client = new pg.Client(dbConfig.dbConnection);
    var connect = Q.denodeify(client.connect.bind(client));
    var query = Q.denodeify(client.query.bind(client));
    return connect()
      .then(function() {
        return query('SELECT * FROM system_admin');
      })
      .then(function (result) {
        return result.rows[0];
      })
      .catch(function (err) {
        console.error(err);
      })
      .finally(function() {
        client.end();
      });
  }

}

module.exports = PostgresDB;
