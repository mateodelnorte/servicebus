module.exports = function (options) {

  return {

    handleIncoming: function json (channel, message, options, next) {
      try {
        message.content = JSON.parse(message.content.toString());
      } catch (err) {
        console.log(typeof message.content, err)
        console.trace()
        process.exit()
        return next(err)
      }

      next(null, channel, message, options);
    },

    handleOutgoing: function json (queueName, message, next) { 
      next(null, queueName, message);
    }

  }
}