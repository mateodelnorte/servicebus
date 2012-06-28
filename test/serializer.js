var fs = require('fs'),
    Serializer = require('../bus/serializer'),
    should = require('should');

describe('Serializer', function(){

  describe('#deserialize', function(){

    it('should provide an empty object when file does not exist', function(done){
      setup(function () {
        var serializer = new Serializer();
        serializer.on('deserialized', function (queues) {
          JSON.stringify(queues).should.equal(JSON.stringify({}));
          done();
        });
        serializer.deserialize();
      });
    });
  });

  describe('#serialize', function () {

    it('should persist the provided object', function(done){
      var qs = { hello: 'obj' };
      setup(function () {
        var serializer = new Serializer();
        serializer.serialize(qs, function () {
          serializer.on('deserialized', function (queues) {
            var util = require('util');
            JSON.stringify(queues).should.equal(JSON.stringify(qs));
            done();
          });
          serializer.deserialize();
        });
      });
    })
  });
});

function setup (cb) {
  var serializer = new Serializer();
  fs.unlink(serializer.filename, function (err) {
    cb();
  });
}