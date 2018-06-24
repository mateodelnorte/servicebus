var getRabbitMQUrl = require('rabbitmq/bus').getRabbitMQUrl

describe('getRabbitMQUrl', function() {
  it('determines url based on options available', function() {
    var url = getRabbitMQUrl({ url: 'amqp://rabbitmq:5672' })
    expect(url).toBe('amqp://rabbitmq:5672')

    url = getRabbitMQUrl({ user: 'pat', password: 'test1234' })
    expect(url).toBe('amqp://pat:test1234@localhost:5672')

    url = getRabbitMQUrl({ user: 'pat', password: 'test1234', host: 'myhost', port: 5555 })
    expect(url).toBe('amqp://pat:test1234@myhost:5555')
  })
})