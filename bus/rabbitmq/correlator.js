var events = require('events'),
    newId = require('node-uuid'),
    QueueRegistry = require('./queueregistry'),
    util = require('util');

function Correlator () {
  events.EventEmitter.call(this); 
  var self = this;
  this.ready = false;
  this.registry = new QueueRegistry();
  this.registry.getCurrentQueues(function (err, queues) {
    self.ready = true;
    self.emit('ready');
  });
}

util.inherits(Correlator, events.EventEmitter);

Correlator.prototype.getUniqueId = function getUniqueId (queueName, subscriptionId, callback) {
  var id, 
      self = this;
  if ( ! subscriptionId) {
    id = queueName + '.' + newId();
    return callback(null, id);
  }

  function getIdFromQueueData () {
    if( ! self.registry.queues[subscriptionId]) {
      id = queueName + '.' + newId();
      self.registry.queues[subscriptionId] = id;
      self.registry.setCurrentQueues(self.registry.queues, function (err) {
        if (err) callback(err);
        else callback(null, id);
      });
    } else {
      id = self.registry.queues[subscriptionId];
      callback(null, id);
    }
  }

  if (this.ready) {
    getIdFromQueueData();
  } else {
    this.on('ready', function () {
      getIdFromQueueData();
    });
  }
};

module.exports = Correlator;