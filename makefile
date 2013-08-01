DEBUG=servicebus*
RABBITMQ_URL=amqp://localhost:5672

test:
	-rm .queues
	RABBITMQ_URL=$(RABBITMQ_URL) DEBUG= ./node_modules/.bin/mocha -R spec -t 10000 --recursive

test-debug:
	-rm .queues
	RABBITMQ_URL=$(RABBITMQ_URL) DEBUG=$(DEBUG) ./node_modules/.bin/mocha -R spec -t 10000 --recursive

.PHONY: test
