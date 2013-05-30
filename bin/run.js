#!/usr/bin/env node

'use strict';

var path = require('path');
var optimist = require('optimist');

var args = optimist
  .alias('h', 'help')
  .alias('h', '?')
  .argv;

if (args.help) {
  optimist.showHelp();
  return process.exit(-1);
}

require('../lib/run')(args);