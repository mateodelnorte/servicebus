var newId = require('node-uuid');

function addCorrelationId (queueName, message, next) {
  if ( ! message.cid) {
    message.cid = newId();
  }
  
  next(null, queueName, message);
}

module.exports = function () {
  return {
    handleOutgoing: addCorrelationId
  };
} 