# servicebus

  Simple service bus for sending events between processes using amqp. Allows for send/receive and publish/subscribe pattern messaging over RabbitMQ.  

## Configuration

## Sending and Receiving

  Servicebus allows simple sending and recieving of messages in a 1:1 sender:listener configuration. The following two processes will send an event message called 'my.event' every second from process A to process B via RabbitMQ and print out the sent event:

  Process A:
```js
var bus = require('servicebus').bus();
bus.listen('my.event', function (event) {
  console.log(event);
});
```
  Process B:
```js
var bus = require('servicebus').bus();

setInterval(function () {
  bus.send('my.event', { my: 'event' });
}, 1000);
```
## Round-Robin Load Distribution

  Simply running multiple versions of Process A, above, will cause servicebus to distribute sent messages evenly accross the list of listeners, in a round-robin pattern. 

## Message Acknowledgement

  (Note: message acking requires use of the https://github.com/mateodelnorte/servicebus-retry middleware)

  Servicebus integrates with RabbitMQ's message acknowledement functionality, which causes messages to queue instead of sending until the listening processes marks any previously received message as acknowledged or rejected. Messages can be acknowledged or rejected with the following syntax. To use ack and reject, it must be specified when defining the listening function: 

```js
bus.listen('my.event', { ack: true }, function (event) {
  event.handle.acknowledge(); // acknowledge a message
  event.handle.ack(); // short hand is also available
  event.handle.reject(); // reject a message
});
```

  Message acknowledgement is suited for use in load distribution scenarios. 

# Publish / Subscribe

  Servicebus can also send messages from 1:N processes in a fan-out architecture. In this pattern, one sender publishes a message and any number of subscribers can receive. The pattern for usage looks very similar to send/listen:

  Process A (can be run any number of times, all will receive the event):
```js
var bus = require('servicebus').bus();
bus.subscribe('my.event', function (event) {
  console.log(event);
});
```
  Process B:
```js    
var bus = require('servicebus').bus();

setInterval(function () {
  bus.publish('my.event', { my: 'event' });
}, 1000);
```    
# Topic Routing

  To use topic routing to accept multiple events in a single handler, use publish and subscribe and the following syntax:
  
  ```js
  bus.publish('event.one', { event: 'one' });
  bus.publish('event.two', { event: 'two' });
  ```
  and for the listener...
  ```js
  bus.subscribe('event.*', function (msg) ...
  ```

# Middleware

Servicebus allows for middleware packages to enact behavior at the time a message is sent or received. They are very similar to connect middleware in their usage: 

```js
  if ( ! process.env.RABBITMQ_URL)
    throw new Error('Tests require a RABBITMQ_URL environment variable to be set, pointing to the RabbiqMQ instance you wish to use.');

  var busUrl = process.env.RABBITMQ_URL

  var bus = require('../').bus({ url: busUrl });

  bus.use(bus.package());
  bus.use(bus.correlate());
  bus.use(bus.logger());

  module.exports.bus = bus;
```

 Middleware may define one or two functions to modify incoming or outgoing messages:

```js
...

  function logIncoming (queueName, message, next) {
    log('received ' + util.inspect(message));
    next(null, queueName, message);
  }

  function logOutgoing (message, headers, deliveryInfo, messageHandle, options, next) {    
    log('sending ' + util.inspect(message));
    next(null, message, headers, deliveryInfo, messageHandle, options);
  }

  return {
    handleIncoming: logIncoming,
    handleOutgoing: logOutgoing
  };
```

handleIncoming pipelines behavior to be enacted on an incoming message. handleOutgoing pipelines behavior to be enacted on an outgoing message. To say that the behavior is pipelined is to say that each middleware is called in succession, allowing each to enact its behavior before the next. (in from protocol->servicebus->middleware 1->middleware 2->servicebus->user code)

## Included Middleware

### Correlate

Correlate simply adds a .cid (Correlation Identity) property to any outgoing message that doesn't already have one. This is useful for following messages in logs across services.

### Logger

Logger ensures that incoming and outgoing messages are logged to stdout via the debug module. (Use this in non-high throughput scenarios, otherwise you'll have some very quickly growing logs)

### Package

Package repackages outgoing messages, encapsulating the original message as a .data property and adding additional properties for information like message type and datetime sent: 

```js
  // bus.publish('my:event', { my: 'event' });
  {
    my: 'event'
  };
```
becomes
```js
  {
    data: {
      my: 'event'
    }
    , datetime: 'Wed, 04 Sep 2013 19:31:11 GMT'
    , type: 'my:event'
  };
```

### Retry

https://github.com/mateodelnorte/servicebus-retry

Retry provides ability to specify a max number of times an erroring message will be retried before being placed on an error queue. The retry middleware requires the correlate middleware. 
