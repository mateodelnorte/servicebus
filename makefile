DEBUG=servicebus*
RABBITMQ_URL=amqp://localhost:5672

test:
	RABBITMQ_URL=$(RABBITMQ_URL) DEBUG= ./node_modules/.bin/mocha -R spec --recursive --exit

docker-test:
	rm -f .queues
	docker-compose up -d rabbitmq
	sleep 10
	docker-compose run --rm tests
	docker-compose down --remove-orphans

test-debug:
	RABBITMQ_URL=$(RABBITMQ_URL) DEBUG=$(DEBUG) ./node_modules/.bin/mocha -R spec --recursive --exit

.PHONY: test test-debug
