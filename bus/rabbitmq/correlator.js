var cluster = require('cluster');
var events = require('events'),
    fs = require('fs'),
    newId = require('node-uuid'),
    path = require('path'),
    util = require('util');
var warn = require('debug')('servicebus:warn');

function Correlator (options) {
  this.initialized = false;
  this.queues = {};

  // note: if you want to cluster servicebus, provide a 'queuesfile' option param when calling .bus(options). you'll likely do a mod of the cluster.worker.id in your cluster.js file when you call fork();
  if (cluster.isWorker && options.queuesFile === undefined) warn('Warning, to use subscriptions in a clustered app, you should specify a queuesFile option when calling .bus(options). You may want to provide something like util.format(\'.queues.worker.%s\', (cluster.worker.id % cluster.workers.length)).');

  this.filename =
    (options && options.queuesFile) ? path.join(process.cwd(), options.queuesFile)
      : (cluster.isWorker) ? path.join(process.cwd(), util.format('.queues.worker.%s', cluster.worker.id))
        :path.join(process.cwd(), '.queues');

  fs.readFile(this.filename, function (err, buf) {
    if (err) {
      this.queues = {};
      this.initialized = true;
      this.emit('ready');
      return;
    }
    try {
      this.queues = JSON.parse(buf.toString());
    } catch (error) {
      this.queues = {};
    } 
    this.initialized = true;
    this.emit('ready');
  }.bind(this));

  events.EventEmitter.call(this);
}

util.inherits(Correlator, events.EventEmitter);

Correlator.prototype.queueName = function queueName (options, callback) {

  if ( ! this.initialized) {
    return this.on('ready', queueName.bind(this, options, callback));
  }

  var result;

  if (this.queues.hasOwnProperty(options.queueName)) {
    result = this.queues[options.queueName];
  } else if (options.routingKey) {
    result = options.queueName;
  } else {
    result = util.format('%s.%s', options.queueName, newId());
    this.queues[options.queueName] = result;
  }

  this.persistQueueFile(function (err) {
    if (err) return callback(err);
    callback(null, result);
  });

};

Correlator.prototype.persistQueueFile = function (callback) {
  var contents = JSON.stringify(this.queues);
  fs.writeFile(this.filename, contents, callback);
};

module.exports = Correlator;
