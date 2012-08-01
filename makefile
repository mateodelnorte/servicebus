test:
	-rm .queues
	@./node_modules/.bin/mocha -R spec -t 10000

.PHONY: test
