'use strict';

var ejs = require('ejs');
var fs = require('fs');
var async = require('async');
var path = require('path');
var mkdirp = require('mkdirp');
var glob = require('glob');
var minimatch = require("minimatch");
var spawn = require('child_process').spawn;
var log = require('./output');

process.on('uncaughtException', function(err) {
  if (err.stack) {
    err = err.stack;
  }
  log.error('Caught exception:', err);
});

module.exports = function(options) {
  options = options || {};
  options.inputDirectory = options.inputDirectory || process.cwd();
  options.buildDirectory = options.buildDirectory || path.join(options.inputDirectory, 'build/out');
  options.reportDirectory = options.reportDirectory || path.join(options.inputDirectory, 'build/report');
  options.filePattern = options.filePattern || '**/*.v';
  options.testBenchPattern = options.testBenchPattern || '**/*_tb.v';
  options.iverlogOpts = options.iverlogOpts || ['-Wall'];

  async.auto({
    buildDirectory: mkdirp.bind(null, options.buildDirectory),
    reportDirectory: mkdirp.bind(null, options.reportDirectory),
    files: getFileList.bind(null, options.inputDirectory, options.filePattern),
    testBenches: ['files', function(callback, data) {
      return getTestBenches(data.files, options.testBenchPattern, callback);
    }],
    compileTestBenches: ['buildDirectory', 'testBenches', function(callback, data) {
      return compileTestBenches(data.testBenches, options.iverlogOpts, options.buildDirectory, callback);
    }],
    runTestBenches: ['compileTestBenches', function(callback, data) {
      return runTestBenches(data.testBenches, callback);
    }],
    analyzeTestBenchesResults: ['runTestBenches', function(callback, data) {
      return analyzeTestBenchesResults(data.testBenches, callback);
    }],
    reports: ['analyzeTestBenchesResults', function(callback, data) {
      return createReports(data.testBenches, options.reportDirectory, callback);
    }]
  });
};

function getFileList(inputDirectory, filePattern, callback) {
  return glob(filePattern, { cwd: inputDirectory }, function(err, files) {
    if (err) {
      return callback(err);
    }
    files = files.map(path.relative.bind(null, process.cwd()));
    return callback(null, files);
  });
}

function getTestBenches(files, testBenchPattern, callback) {
  var testBenchFiles = files.filter(function(file) {
    return minimatch(file, testBenchPattern);
  });
  var nonTestBenchFiles = files.filter(function(file) {
    return !minimatch(file, testBenchPattern);
  });
  var testBenches = testBenchFiles.map(function(testBenchFile) {
    return {
      fileName: testBenchFile,
      dependencies: nonTestBenchFiles
    };
  });
  return callback(null, testBenches);
}

function compileTestBenches(testBenches, iverlogOpts, buildDirectory, callback) {
  return async.forEach(
    testBenches,
    function(testBench, callback) {
      return compileTestBench(testBench, iverlogOpts, buildDirectory, callback);
    },
    callback);
}

function compileTestBench(testBench, iverlogOpts, buildDirectory, callback) {
  testBench.iverilogOutput = '';
  testBench.outputFileName = path.join(buildDirectory, testBench.fileName + '.out');

  var opts = [];
  opts = opts.concat(iverlogOpts);
  opts.push('-o' + testBench.outputFileName);
  opts = opts.concat(testBench.dependencies);
  opts.push(testBench.fileName);
  log.info('Running iverilog', opts.join(' '));
  var iverilog = spawn('iverilog', opts);
  iverilog.stdout.on('data', function(data) {
    testBench.iverilogOutput += data.toString();
  });
  iverilog.stderr.on('data', function(data) {
    testBench.iverilogOutput += data.toString();
  });
  iverilog.on('close', function(code) {
    testBench.iverilogExitCode = code;
    return callback(null, testBench);
  });
}

function runTestBenches(testBenches, callback) {
  return async.forEach(
    testBenches,
    function(testBench, callback) {
      return runTestBench(testBench, callback);
    },
    callback);
}

function runTestBench(testBench, callback) {
  if (testBench.iverilogExitCode !== 0) {
    log.warn('skipping test bench', testBench.fileName, ' exit code was not 0');
    return callback();
  }
  testBench.output = '';
  log.info('running test bench', testBench.fileName);
  var testBenchOutputFile = spawn(testBench.outputFileName, []);
  testBenchOutputFile.stdout.on('data', function(data) {
    testBench.output += data.toString();
  });
  testBenchOutputFile.stderr.on('data', function(data) {
    testBench.output += data.toString();
  });
  testBenchOutputFile.on('close', function(code) {
    testBench.exitCode = code;
    return callback(null, testBench);
  });
}

function analyzeTestBenchesResults(testBenches, callback) {
  return async.forEach(
    testBenches,
    function(testBench, callback) {
      return analyzeTestBenchResults(testBench, callback);
    },
    callback);
}

function analyzeTestBenchResults(testBench, callback) {
  if (testBench.iverilogExitCode != 0) {
    testBench.result = 'iverilog failed';
  } else if (testBench.exitCode != 0) {
    testBench.result = 'test bench run failed';
  } else {
    testBench.result = 'success';
  }
  return callback();
}

function createReports(testBenches, reportDirectory, callback) {
  return async.auto({
    testBenchReportTemplate: loadTemplate.bind(null, path.join(__dirname, '../templates/testBenchReport.ejs')),
    testBenchSummaryReportTemplate: loadTemplate.bind(null, path.join(__dirname, '../templates/testBenchSummaryReport.ejs')),
    testBenchReports: ['testBenchReportTemplate', function(callback, data) {
      return createTestBenchReports(testBenches, data.testBenchReportTemplate, reportDirectory, callback);
    }],
    testBenchSummaryReport: ['testBenchSummaryReportTemplate', 'testBenchReports', function(callback, data) {
      return createTestBenchSummaryReport(testBenches, data.testBenchSummaryReportTemplate, reportDirectory, callback);
    }]
  });
}

function loadTemplate(fileName, callback) {
  return fs.readFile(fileName, 'utf8', function(err, str) {
    if (err) {
      return callback(err);
    }
    var template = ejs.compile(str);
    return callback(null, template);
  });
}

function createTestBenchReports(testBenches, testBenchReportTemplate, reportDirectory, callback) {
  return async.forEach(
    testBenches,
    function(testBench, callback) {
      return createTestBenchReport(testBench, testBenchReportTemplate, reportDirectory, callback);
    },
    callback);
}

function createTestBenchReport(testBench, testBenchReportTemplate, reportDirectory, callback) {
  testBench.reportFileName = path.join(reportDirectory, testBench.fileName + '.html');
  log.info('creating report for test bench', testBench.fileName, '->', path.relative(process.cwd(), testBench.reportFileName));
  var str = testBenchReportTemplate({
    testBench: testBench
  });
  return fs.writeFile(testBench.reportFileName, str, callback);
}

function createTestBenchSummaryReport(testBenches, testBenchSummaryReportTemplate, reportDirectory, callback) {
  var summaryReportFileName = path.join(reportDirectory, 'index.html');
  log.info('creating test bench summary report', path.relative(process.cwd(), summaryReportFileName));
  var str = testBenchSummaryReportTemplate({
    testBenches: testBenches
  });
  return fs.writeFile(summaryReportFileName, str, callback);
}
