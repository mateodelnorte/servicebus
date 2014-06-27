var log = require('debug')('servicebus:retry');
var util = require('util');

var maxRetries = 10;
var rejected = {};

module.exports = function (options) {
  options = options || {};

  if (options.maxRetries) maxRetries = options.maxRetries;

  return {

    handleIncoming: function retry (channel, message, options, next) {

      if (options && options.ack) {

        message.content.handle = {
          ack: function () { 
            channel.ack(message); 
          },
          acknowledge: function () { 
            channel.ack(message); 
          },
          reject: function () {
            if (rejected[message.content.cid] == undefined) {
              rejected[message.content.cid] = 1;
            } else {
              rejected[message.content.cid] = rejected[message.content.cid] + 1;
            }

            if (rejected[message.content.cid] > maxRetries) {
              var errorQueueName = util.format('%s.error', message.fields.routingKey);
              log('sending message %s to error queue %s', message.content.cid, errorQueueName);
              channel.sendToQueue(errorQueueName, new Buffer(JSON.stringify(message.content)), options);
              channel.nack(message, false, false); 
              delete rejected[message.content.cid];
            } else {
              log('retrying message %s', message.content.cid);
              channel.nack(message, false, true);
            }

          }
        };

      }

      next(null, channel, message, options);
    }

  };
} 