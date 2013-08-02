var cp = require('child_process');
var noop = function () {};
var bus = require('./bus-shim').bus;
var should = require('should');

describe('servicebus (child_processes)', function(){

  describe('#send & #listen', function(){

    it('should cause message to be received by listen', function (done){
      var count = 0;
      function tryDone(){
        count++;
        if (count === 1) {
          done();
          sender.kill();
        }
      }

      bus.listen('event.22', function (event) {
        tryDone();
      }); 

      var sender = cp.fork(__dirname + '/child_processes/.sender.js');
      
    });
    
  });
})