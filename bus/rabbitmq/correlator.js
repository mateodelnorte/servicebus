var cluster = require('cluster');
var events = require('events'),
    fs = require('fs'),
    newId = require('node-uuid'),
    path = require('path'),
    Promise = require('bluebird'),
    util = require('util');
var warn = require('debug')('servicebus:warn');

var queues = {};

function Correlator (options) {
  var self = this;
  // note: if you want to cluster servicebus, provide a 'queuesfile' option param when calling .bus(options). you'll likely do a mod of the cluster.worker.id in your cluster.js file when you call fork();
  if (cluster.isWorker && options.queuesFile === undefined) warn('Warning, to use subscriptions in a clustered app, you should specify a queuesFile option when calling .bus(options). You may want to provide something like util.format(\'.queues.worker.%s\', (cluster.worker.id % cluster.workers.length)).');

  this.filename =
    (options && options.queuesFile) ? path.join(process.cwd(), options.queuesFile)
      : (cluster.isWorker) ? path.join(process.cwd(), util.format('.queues.worker.%s', cluster.worker.id))
        :path.join(process.cwd(), '.queues');
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
  var routingKey = options.queueName;
  this.loading.done(function (result) {
    queues = result;
    var queueName;
    if (queues.hasOwnProperty(routingKey)) {
      queueName = queues[routingKey];
    } else if (options.subscriptionName) {
      queueName = options.subscriptionName;
    } else {
      queueName = util.format('%s.%s', routingKey, newId());
      queues[routingKey] = queueName;
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
