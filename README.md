# servicebus

  Simple service bus for sending events between processes using amqp. Allows for send/receive and publish/subscribe pattern messaging over RabbitMQ.  

## Configuration

## Sending and Receiving

  Servicebus allows simple sending and recieving of messages in a 1:1 sender:listener configuration. The following two processes will send an event message called 'my.event' every second from process A to process B via RabbitMQ and print out the sent event:

  Process A:
    
    var bus = require('servicebus').bus();
    bus.listen('my.event', function (event) {
      console.log(event);
    });

  Process B:
    
    var bus = require('servicebus').bus();
    
    setInterval(function () {
      bus.send('my.event', { my: 'event' });
    }, 1000);
  
## Round-Robin Load Distribution

  Simply running multiple versions of Process B, above, will cause servicebus to distribute sent messages evenly accross the list of listeners, in a round-robin pattern. 

## Message Acknowledgement

  Servicebus integrates with RabbitMQ's message acknowledement functionality, which causes messages to queue instead of sending until the listening processes marks any previously received message as acknowledged or rejected. Messages can be acknowledged or rejected with the following syntax. To use ack and reject, it must be specified when defining the listening function: 

    bus.listen('my.event', { ack: true }, function (event, handle) {
      handle.acknowledge(); // acknowledge a message
      handle.ack(); // short hand is also available
      handle.reject(); // reject a message
    });

  Message acknowledgement is suited for use in load distribution scenarios. 

# Publish / Subscribe

  Servicebus can also send messages from 1:N processes in a fan-out architecture. In this pattern, one sender publishes a message and any number of subscribers can receive. The pattern for usage looks very similar to send/listen:

  Process A (can be run any number of times, all will receive the event):
    
    var bus = require('servicebus').bus();
    bus.subscribe('my.event', function (event) {
      console.log(event);
    });

  Process B:
    
    var bus = require('servicebus').bus();
    
    setInterval(function () {
      bus.publish('my.event', { my: 'event' });
    }, 1000);