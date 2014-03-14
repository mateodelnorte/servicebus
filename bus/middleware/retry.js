var log = require('debug')('servicebus:retry');
var maxRetries = 10, rejected = {};
var util = require('util');

module.exports = function (options) {
  options = options || {};

  if (options.maxRetries) maxRetries = options.maxRetries;

  return {

    handleIncoming: function retry (message, headers, deliveryInfo, messageHandle, options, next) {

      var bus = this;
      
      if (options && options.ack) {

        message.handle = {
          ack: function () { messageHandle.acknowledge(); },
          acknowledge: function () { messageHandle.acknowledge(); },
          reject: function () {
            if (rejected[message.cid] == undefined) {
              rejected[message.cid] = 1
            } else {
              rejected[message.cid] = rejected[message.cid] + 1;
            }
            if (rejected[message.cid] > maxRetries) {
              var errorQueueName = util.format('%s.error', deliveryInfo.queue);
              log('sending message %s to error queue %s', message.cid, errorQueueName);
              bus.connection.publish(errorQueueName, message, { contentType: 'application/json', deliveryMode: 2 });
              messageHandle.acknowledge();
              delete rejected[message.cid];
            } else {
              log('retrying message %s', message.cid);
              messageHandle.reject(true);
            }
          }
        };
      }
      
      next(null, message, headers, deliveryInfo, messageHandle, options);
    }

  };
} 