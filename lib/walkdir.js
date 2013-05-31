'use strict';

var fs = require('fs');
var path = require('path');
var async = require('async');

var walkdir = module.exports = function(dir, fileCallback, doneCallback) {
  return fs.readdir(dir, function(err, files) {
    if (err) {
      return doneCallback(err);
    }
    files = files.map(function(file) {
      return path.join(dir, file);
    });
    return async.forEachSeries(files, function(file, callback) {
      return fileCallback(file, function(err) {
        return callback(err);
      });
    }, function(err) {
      if (err) {
        return doneCallback(err);
      }
      return recurseIntoDirectories(files, fileCallback, doneCallback);
    });
  });
};

function recurseIntoDirectories(files, fileCallback, callback) {
  return async.forEachSeries(files, function(file, callback) {
    return fs.stat(file, function(err, stats) {
      if (err) {
        return callback(err);
      }
      if (stats.isDirectory()) {
        return walkdir(file, fileCallback, callback);
      } else {
        return callback();
      }
    });
  }, callback);
}
