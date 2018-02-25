DEBUG=servicebus*
RABBITMQ_URL=amqp://localhost:5672

test:
	RABBITMQ_URL=$(RABBITMQ_URL) DEBUG= ./node_modules/.bin/mocha -R spec --recursive

docker-test:
	rm -f .queues
	docker-compose -f docker-compose.tests.yml up -d rabbitmq
	sleep 10
	docker-compose -f docker-compose.tests.yml run --rm tests
	docker-compose -f docker-compose.tests.yml down --remove-orphans

test-debug:
	RABBITMQ_URL=$(RABBITMQ_URL) DEBUG=$(DEBUG) ./node_modules/.bin/mocha -R spec --recursive

.PHONY: test test-debug
