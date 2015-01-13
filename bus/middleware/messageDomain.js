var domain = require('domain');

module.exports = function messageDomain (options) {

  return {

    handleIncoming: function json (channel, message, options, next) {
      
      var d = domain.create();

      d.run(function() {

        if (message.properties.correlationId) {
          d.correlationId = message.properties.correlationId;
        }

        next(null, channel, message, options);
        
      });

    },

  };
};