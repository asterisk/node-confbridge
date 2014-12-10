'use strict';

var pg = require('pg');
var Q = require('q');
var prompt = require('prompt');
var config = require('../config.json');

var groupValues = [];

var get = Q.denodeify(prompt.get.bind(prompt));
var connect = Q.denodeify(pg.connect.bind(pg));

console.log('Enter the name of the group to create:');
get('name')
  .then(function (result) {
    groupValues[0] = result.name;
    console.log('Behavior? (leader/follower/participant)');
    return get('behavior');
  })
  .then(function (result) {
    groupValues[1] = result.behavior;
    console.log('Max members?');
    return get('max_members');
  })
  .then(function (result) {
    groupValues[2] = result.max_members;
    console.log('Connecting to database...');
    return connect(config.dbConnection);
  })
  .then(function (result) {
    var client = result[0];
    var done = result[1];
    var query = Q.denodeify(client.query.bind(client));

    return query('SELECT exists(SELECT 1 FROM group_profile where group_type = '
                 + '$1)', [groupValues[0]])
      .then(function (result) {
        if (!result.rows[0].exists) {
          console.log('...inserting group into database');
          return query('INSERT INTO group_profile (group_type,group_behavior,'
                       + 'max_members) VALUES ($1,$2,$3)', [groupValues[0],
                       groupValues[1],groupValues[2]]);
        }
        else {
          console.log('...group already exists. Aborting.');
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
