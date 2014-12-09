'use strict';

var pg = require('pg');
var Q = require('q');

function PostgresDB(dbConfig) {

  var connect = Q.denodeify(pg.connect.bind(pg));

  /**
   * Retrieves the bridge profile.
   *
   * @return {Q} result - a promise containing the row where the bridge
   *   settings are stored
   */
  this.getBridgeProfile = function() {

    return connect(dbConfig.dbConnection)
      .then(function (values) {
        var profile = dbConfig.bridgeProfile;
        var client = values[0];
        var done = values[1];
        var query = Q.denodeify(client.query.bind(client));

        return query('SELECT exists(SELECT 1 FROM bridge_profile WHERE '
                   + 'bridge_type = $1)', [profile])
          .then(function (result) {
            if (!result.rows[0].exists) {
              profile = 'default';
            }
            return query('SELECT * FROM bridge_profile WHERE bridge_type = $1',
                         [profile]);
          })
          .then(function (result) {
            console.log('Fetched bridge profile', profile);
            return result.rows[0];
          })
          .catch(function (err) {
            console.error(err);
          })
          .finally(function () {
            done();
          });
    })
    .catch(function (err) {
      console.error(err);
    });

  };

  /**
   * Retrieves a user profile.
   *
   * @param {String} userType - the type of user to retrieve
   * @return {Q} result - a promise containing the row where the user
   *   profile is stored
   */
  this.getUserProfile = function(userType) {

    return connect(dbConfig.dbConnection)
      .then(function (values) {
        var client = values[0];
        var done = values[1];
        var query = Q.denodeify(client.query.bind(client));

        return query('SELECT exists(SELECT 1 FROM user_profile WHERE '
                   + 'user_type = $1)', [userType])
          .then(function (result) {
            if (!result.rows[0].exists) {
              userType = 'default';
            }
            return query('SELECT * FROM user_profile WHERE user_type = '
                       + '$1', [userType]);
          })
          .then(function (result) {
            return result.rows[0];
          })
          .catch(function (err) {
            console.error(err);
          })
          .finally(function () {
            done();
          });
      })
      .catch(function (err) {
        console.error(err);
      });

  };

  /**
   * Retrieves a group profile.
   *
   * @param {String} groupType - the type of group to retrieve
   * @return {Q} result - a promise containing the row where the group
   *   profile is stored
   */
  this.getGroupProfile = function(groupType) {

    return connect(dbConfig.dbConnection)
      .then(function (values) {
        var client = values[0];
        var done = values[1];
        var query = Q.denodeify(client.query.bind(client));

        return query('SELECT exists(SELECT 1 FROM group_profile WHERE '
                   + 'group_type = $1)', [groupType])
          .then(function (result) {
            if (!result.rows[0].exists) {
              groupType = 'default';
            }
            return query('SELECT * FROM group_profile WHERE group_type = '
                       + '$1', [groupType]);
          })
          .then(function (result) {
            return result.rows[0];
          })
          .catch(function (err) {
            console.error(err);
          })
          .finally(function () {
            done();
          });
      })
      .catch(function (err) {
        console.error(err);
      });

  };

}

module.exports = PostgresDB;
