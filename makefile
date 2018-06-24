DEBUG=servicebus*
RABBITMQ_URL=amqp://localhost:5672

docker-test:
	rm -f .queues
	docker-compose up -d rabbitmq
	sleep 10
	make test

test:
	RABBITMQ_URL=$(RABBITMQ_URL) DEBUG= ./node_modules/.bin/mocha -R spec --recursive --exit

test-debug:
	RABBITMQ_URL=$(RABBITMQ_URL) DEBUG=$(DEBUG) ./node_modules/.bin/mocha -R spec --recursive --exit

.PHONY: test test-debug
