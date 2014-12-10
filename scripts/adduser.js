'use strict';

var pg = require('pg');
var Q = require('q');
var prompt = require('prompt');
var config = require('../config.json');

var userValues = [];

var get = Q.denodeify(prompt.get.bind(prompt));
var connect = Q.denodeify(pg.connect.bind(pg));

console.log('Enter the name of the user to create:');
get('name')
  .then(function (result) {
    userValues[0] = result.name;
    console.log('Admin? (true/false)');
    return get('admin');
  })
  .then(function (result) {
    userValues[1] = result.admin;
    console.log('MOH? (true/false)');
    return get('moh');
  })
  .then(function (result) {
    userValues[2] = result.moh;
    console.log('Quiet? (true/false)');
    return get('quiet');
  })
  .then(function (result) {
    userValues[3] = result.quiet;
    console.log('Pin authorization? (true/false)');
    return get('pin_auth');
  })
  .then(function (result) {
    userValues[4] = result.pin_auth;
    console.log('Connecting to database...');
    return connect(config.dbConnection);
  })
  .then(function (result) {
    var client = result[0];
    var done = result[1];
    var query = Q.denodeify(client.query.bind(client));

    return query('SELECT exists(SELECT 1 FROM user_profile WHERE user_type = '
                 + '$1)', [userValues[0]])
      .then(function (result) {
        if (!result.rows[0].exists) {
          console.log('...inserting user into database');
          return query('INSERT INTO user_profile (user_type,admin,moh,quiet,'
                       + 'pin_auth) VALUES ($1,$2,$3,$4,$5)',
                       [userValues[0],userValues[1],userValues[2],userValues[3],
                        userValues[4]]);
        }
        else {
          console.log('...user already exists. Aborting.');
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
