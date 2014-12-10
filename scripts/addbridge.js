'use strict';

var pg = require('pg');
var Q = require('q');
var prompt = require('prompt');
var config = require('../config.json');

var get = Q.denodeify(prompt.get.bind(prompt));
var connect = Q.denodeify(pg.connect.bind(pg));
var bridgeProfile = '';

console.log('Enter the name of the bridge profile to create:');
get('name')
  .then(function (result) {
    bridgeProfile = result.name;
    console.log('Connecting to database...');
    return connect(config.dbConnection);
  })
  .then(function (result) {
    var client = result[0];
    var done = result[1];
    var query = Q.denodeify(client.query.bind(client));

    return query('SELECT exists(SELECT 1 FROM bridge_profile where bridge_type '
                 + '= $1)', [bridgeProfile])
      .then(function (result) {
        if (!result.rows[0].exists) {
          console.log('...inserting bridge into database');
          return query('INSERT INTO bridge_profile (bridge_type,join_sound,'
                       + 'leave_sound,pin_number,pin_retries,enter_pin_sound,'
                       + 'bad_pin_sound,locked_sound,now_locked_sound,'
                       + 'now_unlocked_sound,now_muted_sound,'
                       + 'now_unmuted_sound,kicked_sound,record_conference,'
                       + 'recording_sound,wait_for_leader_sound) VALUES '
                       + '($1,\'confbridge-join\',\'confbridge-leave\',1234,'
                       + '3,\'confbridge-pin\',\'conf-invalidpin\','
                       + '\'confbridge-lock-no-join\',\'confbridge-locked\','
                       + '\'confbridge-unlocked\',\'confbridge-muted\','
                       + '\'confbridge-unmuted\',\'confbridge-removed\','
                       + 'false,\'conf-now-recording\',\'conf-waitforleader\')',
                       [bridgeProfile]);
        }
        else {
          console.log('...bridge already exists. Aborting.');
          process.exit(0);
        }
      })
      .then(function () {
        console.log('...disconnecting from database.');
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
  })
  .finally(function () {
    process.exit(0);
  })
  .done();
