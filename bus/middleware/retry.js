var rejected = {}, maxRetries = 10;

function retry (message, headers, deliveryInfo, messageHandle, options, next) {
  
  if (options && options.ack) {
    message.handle = {
      ack: function () { messageHandle.acknowledge(); },
      acknowledge: function () { messageHandle.acknowledge(); },
      reject: function () {
        var msgRejected = rejected[message.cid] || 0;
        if (msgRejected >= maxRetries) {
          messageHandle.acknowledge();
          delete rejected[message.cid];
        } else {
          msgRejected++;
          rejected[message.cid] = msgRejected;
          messageHandle.reject(true);
        }
      }
    };
  }
  
  next(null, message, headers, deliveryInfo, messageHandle, options);
}

module.exports = function (options) {
  options = options || {};

  if (options.maxRetries) maxRetries = options.maxRetries;

  return {
    handleIncoming: retry
  };
} 