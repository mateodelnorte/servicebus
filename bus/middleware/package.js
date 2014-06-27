function packageMessage (queueName, message, next) {
  var newMessage = {
      data: message
    , datetime: message.datetime || new Date().toUTCString()
    , type: message.type || queueName
  };

  next(null, queueName, newMessage);

}

module.exports = function () {
  return {
    handleOutgoing: packageMessage
  };
} 