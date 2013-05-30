'use strict';

var colorize = require('colorize');

function output(fn, prefix, args) {
  var newArgs = [ prefix ];
  newArgs = newArgs.concat(Array.prototype.slice.call(args));
  return colorize.console[fn].apply(colorize.console, newArgs);
}

exports.info = function() {
  return output('info', '#green[INFO]:', arguments);
};

exports.warn = function() {
  return output('warn', '#bold[#yellow[WARN]]:', arguments);
};

exports.error = function() {
  return output('error', '#bold[#red[ERROR]]:', arguments);
};
