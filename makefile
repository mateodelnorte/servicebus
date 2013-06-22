DEBUG=servicebus*

test:
	-rm .queues
	DEBUG= ./node_modules/.bin/mocha -R spec -t 10000 --recursive

test-debug:
	-rm .queues
	DEBUG=$(DEBUG) ./node_modules/.bin/mocha -R spec -t 10000 --recursive

.PHONY: test
