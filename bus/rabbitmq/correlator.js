var events = require('events'),
    fs = require('fs'),
    newId = require('node-uuid'),
    path = require('path'),
    Promise = require('bluebird'),
    QueueRegistry = require('./queueregistry'),
    util = require('util');

var queues = {};

function Correlator (options) {
  var self = this;
  this.filename = (options && options.queuesFile) ? path.join(process.cwd(), options.queuesFile) : path.join(process.cwd(), '.queues');
  this.loading = new Promise(function (resolve, reject) {
    var result;
    fs.readFile(self.filename, function (err, buf) {
      if (err) {
        return resolve({});
      }
      try {
        result = JSON.parse(buf.toString());
      } catch (err) {
        result = {};
      } finally {
        resolve(result);
      }
    });
  });

  events.EventEmitter.call(this); 
}

util.inherits(Correlator, events.EventEmitter);

Correlator.prototype.queueName = function queueName (options, callback) {
  var self = this;
  this.loading.done(function (result) {
    queues = result;
    var queueName;
    if (queues.hasOwnProperty(options.queueName)) {
      queueName = queues[options.queueName];
    } else {
      queueName = util.format('%s.%s', options.queueName, newId());
      queues[options.queueName] = queueName;
    }
    self.persistQueueFile(function (err) {
      if (err) return callback(err);
      callback(null, queueName);  
    });
  });
};

Correlator.prototype.persistQueueFile = function (callback) {
  var contents = JSON.stringify(queues);
  fs.writeFile(this.filename, contents, callback);
}

module.exports = Correlator;