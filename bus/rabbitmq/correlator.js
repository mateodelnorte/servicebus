var events = require('events'),
    fs = require('fs'),
    newId = require('node-uuid'),
    path = require('path'),
    Promise = require('bluebird'),
    QueueRegistry = require('./queueregistry'),
    util = require('util');

function Correlator (options) {
  var self = this;
  this.filename = (options && options.queuesFile) ? path.join(process.cwd(), options.queuesFile) : path.join(process.cwd(), '.queues');
  events.EventEmitter.call(this); 
}

util.inherits(Correlator, events.EventEmitter);

Correlator.prototype.queueName = function queueName (options, callback) {
  var self = this;
  new Promise(function (resolve, reject) {
    fs.readFile(self.filename, function (err, buf) {
      if (err) {
        if (err.message.indexOf('ENOENT') > -1) {
          return resolve({});
        } else {
          return reject(err);
        }
      }
      resolve(JSON.parse(buf.toString()));
    });
  }).done(function (queues) {
    self.queues = queues;
    var queueName;
    if (self.queues.hasOwnProperty(options.queueName)) {
      queueName = self.queues[options.queueName];
    } else {
      queueName = util.format('%s.%s', options.queueName, newId());
      self.queues[options.queueName] = queueName;
    }
    self.persistQueueFile(function (err) {
      if (err) return callback(err);
      callback(null, queueName);  
    });
  });
};

Correlator.prototype.persistQueueFile = function (callback) {
  var contents = JSON.stringify(this.queues);
  fs.writeFile(this.filename, contents, callback);
}

module.exports = Correlator;