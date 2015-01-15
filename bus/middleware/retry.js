var extend = require('extend');
var log = require('debug')('servicebus:retry');
var util = require('util');

var maxRetries = 5;
var localRejected = {};

function retryLocal (channel, message, options, next) {

  if (options && options.ack) {

    message.content.handle = {
      ack: function () { 
        channel.ack(message);  
      },
      acknowledge: function () { 
        channel.ack(message);  
      },
      reject: function () {
        if (localRejected[message.content.cid] === undefined) {
          localRejected[message.content.cid] = 1;
        } else {
          localRejected[message.content.cid] = localRejected[message.content.cid] + 1;
        }
        if (localRejected[message.content.cid] > maxRetries) {
          var errorQueueName = util.format('%s.error', message.fields.routingKey);
          log('sending message %s to error queue %s', message.content.cid, errorQueueName);
          channel.sendToQueue(errorQueueName, new Buffer(JSON.stringify(message.content)), extend(options, { headers: { rejected: localRejected[message.content.cid] } }));
          channel.reject(message, false); 
          delete localRejected[message.content.cid];
        } else {
          log('retrying message %s', message.content.cid);
          channel.reject(message, true); 
        }

      }
    };
  }

  next(null, channel, message, options);
}

function retryDistributed (channel, message, options, next) {

  if (message.properties.headers.rejected === undefined) {
    message.properties.headers.rejected = 0;
  }

  if (options && options.ack) {

    message.content.handle = {
      ack: function () { 
        channel.ack(message); 
      },
      acknowledge: function () { 
        channel.ack(message); 
      },
      reject: function () {

        var rejected = message.properties.headers.rejected + 1;

        if (rejected > maxRetries) {

          var errorQueueName = util.format('%s.error', message.fields.routingKey);

          log('sending message %s to error queue %s', message.content.cid, errorQueueName);

          channel.sendToQueue(errorQueueName, new Buffer(JSON.stringify(message.content)), extend(options, { headers: { rejected: rejected } }));
          channel.reject(message, false); 

        } else {

          log('retrying message %s', message.content.cid);

          message.properties.headers.rejected = rejected;

          channel.reject(message, false);

          if (options.queueType === 'queue') {
            channel.sendToQueue(message.fields.routingKey, new Buffer(JSON.stringify(message.content)), extend(options, { headers: { rejected: rejected } }));
          } else {
            channel.publish(message.fields.exchange, message.fields.routingKey, new Buffer(JSON.stringify(message.content)), extend(options, { headers: { rejected: rejected } }));
          }
          
        }

      }
    };

  }

  next(null, channel, message, options);
}

module.exports = function (options) {

  options = options || { localOnly: false };

  if (options.maxRetries) maxRetries = options.maxRetries;

  return {
    handleIncoming: options.localOnly ? retryLocal : retryDistributed
  };

};