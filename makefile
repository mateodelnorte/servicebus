DEBUG=servicebus*
RABBITMQ_URL=amqp://localhost:5672

test:
	RABBITMQ_URL=$(RABBITMQ_URL) DEBUG= ./node_modules/.bin/mocha -R spec --recursive

test-debug:
	RABBITMQ_URL=$(RABBITMQ_URL) DEBUG=$(DEBUG) ./node_modules/.bin/mocha -R spec --recursive

.PHONY: test test-debug
