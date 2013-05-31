'use strict';

var walkdir = require('./walkdir');
var fs = require('fs');
var path = require('path');
var mkdirp = require('mkdirp');

module.exports = function(sourceDir, destDir, options, callback) {
  options = options || {};
  options.createDirectoryCallback = options.createDirectoryCallback || function() { return callback(null, true); };
  options.copyFileCallback = options.copyFileCallback || function() { return callback(null, true); };

  return walkdir(
    sourceDir,
    function(sourceFile, callback) {
      var destFile = path.join(destDir, path.relative(sourceDir, sourceFile));
      return copyFileOrDirectory(sourceFile, destFile, options, callback);
    },
    callback);
};

function copyFileOrDirectory(sourceFile, destFile, options, callback) {
  return fs.stat(sourceFile, function(err, sourceStats) {
    if (err) {
      return callback(err);
    }
    return existsAndStat(destFile, function(err, destStats) {
      if (err) {
        return callback(err);
      }

      if (sourceStats.isDirectory()) {
        return createDirectory(sourceFile, sourceStats, destFile, destStats, options, callback);
      } else {
        return copyFile(sourceFile, sourceStats, destFile, destStats, options, callback);
      }
    });
  });
}

function existsAndStat(file, callback) {
  return fs.exists(file, function(exists) {
    if (!exists) {
      return callback();
    }
    return fs.stat(file, callback);
  });
}

function createDirectory(sourceFile, sourceStats, destFile, destStats, options, callback) {
  if (!destStats) {
    return options.createDirectoryCallback(sourceFile, destFile, function(err, proceed) {
      if (err) {
        return callback(err);
      }
      if (!proceed) {
        return callback();
      }
      return mkdirp(destFile, callback);
    });
  }
  return callback();
}

function copyFile(sourceFile, sourceStats, destFile, destStats, options, callback) {
  if (destStats && sourceStats.mtime <= destStats.mtime) {
    return callback();
  }

  return options.copyFileCallback(sourceFile, destFile, function(err, proceed) {
    if (err) {
      return callback(err);
    }
    if (!proceed) {
      return callback();
    }
    var is = fs.createReadStream(sourceFile);
    var os = fs.createWriteStream(destFile);
    os.on('close', callback);
    return is.pipe(os);
  });
}
