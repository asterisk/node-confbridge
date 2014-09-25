'use strict';

var config = require('../config.json');
var util = require('util');
var sourceName = config.dbConnection.split(':')[0];
var Source = require(util.format('./%s/source.js', sourceName));
var db = new Source(config);

module.exports = db;
