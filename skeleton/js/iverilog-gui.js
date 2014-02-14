'use strict';

(function() {
  if (document.location.href.indexOf('http:') < 0) {
    return;
  }

  document.write('<script src="/socket.io/socket.io.js"></script>');

  $(function() {
    console.log('connection socket.io');
    var socket = io.connect('http://localhost');
    socket.on('buildStarted', function() {
      console.log('buildStarted');
      $('#loading').show();
    });
    socket.on('buildComplete', function() {
      console.log('buildComplete');
      $('#loading').hide();
      document.location.reload();
    });
  });
})();