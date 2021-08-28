'use strict'

function createWrapCall (tracer, config) {
  return function wrapCall (call) {
    return function callWithTrace (actionName, params, opts) {
      const options = {
        service: config.service,
        resource: actionName,
        tags: {
          'span.kind': 'client'
        }
      }

      opts = arguments[2] = opts || {}
      opts.meta = opts.meta || {}

      arguments.length = Math.max(3, arguments.length)

      return tracer.trace('moleculer.call', options, () => {
        const span = tracer.scope().active()

        tracer.inject(span, 'text_map', opts.meta)

        const promise = call.apply(this, arguments)
        const service = promise.ctx.service || {}
        const action = promise.ctx.action || {}

        if (promise.ctx) {
          span.addTags({
            'moleculer.service': service.name,
            'moleculer.action': action.name,
            'moleculer.request_id': promise.ctx.requestID,
            'moleculer.node_id': promise.ctx.nodeID
          })
        }

        return promise
      })
    }
  }
}

module.exports = [
  {
    name: 'moleculer',
    versions: ['>=0.14'],
    patch ({ ServiceBroker }, tracer, config) {
      if (config.client === false) return

      config = Object.assign({}, config, config.client)

      this.wrap(ServiceBroker.prototype, 'call', createWrapCall(tracer, config))
    },
    unpatch ({ ServiceBroker }) {
      this.unwrap(ServiceBroker.prototype, 'call')
    }
  }
]
