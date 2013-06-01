#!/usr/bin/env node

'use strict';

var path = require('path');
var optimist = require('optimist');

var args = optimist
  .alias('h', 'help')
  .alias('h', '?')
  .options('watch', {
    describe: 'Watch for file changes and re-run.'
  })
  .options('server', {
    describe: 'Run a web server to continuously monitor build status.'
  })
  .argv;

if (args.help) {
  optimist.showHelp();
  return process.exit(-1);
}

require('../lib/run')(args);
