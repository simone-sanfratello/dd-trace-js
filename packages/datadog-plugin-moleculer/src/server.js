'use strict'

function createWrapRegisterMiddlewares (tracer, config) {
  return function wrapRegisterMiddlewares (registerMiddlewares) {
    return function registerMiddlewaresWithTrace (userMiddlewares) {
      if (this.middlewares && this.middlewares.add) {
        this.middlewares.add(createMiddleware(tracer, config))
      }

      return registerMiddlewares.apply(this, arguments)
    }
  }
}

function createMiddleware (tracer, config) {
  return {
    name: 'Datadog',

    localAction (next, action) {
      const broker = this

      return function datadogMiddleware (ctx) {
        const childOf = tracer.extract('text_map', ctx.meta)
        const service = ctx.service || {}
        const action = ctx.action || {}
        const options = {
          service: config.service,
          resource: action.name,
          type: 'web',
          tags: {
            'span.kind': 'server',
            'moleculer.context.action': action.name,
            'moleculer.context.node_id': ctx.nodeID,
            'moleculer.context.request_id': ctx.requestID,
            'moleculer.context.service': service.name,
            'moleculer.namespace': broker.namespace,
            'moleculer.node_id': broker.nodeID
          }
        }

        if (childOf) {
          options.childOf = childOf
        }

        return tracer.trace('moleculer.action', options, () => next(ctx))
      }
    }
  }
}

module.exports = [
  {
    name: 'moleculer',
    versions: ['>=0.14'],
    patch ({ ServiceBroker }, tracer, config) {
      if (config.server === false) return

      config = Object.assign({}, config, config.server)

      this.wrap(ServiceBroker.prototype, 'registerMiddlewares', createWrapRegisterMiddlewares(tracer, config))
    },
    unpatch ({ ServiceBroker }) {
      this.unwrap(ServiceBroker.prototype, 'registerMiddlewares')
    }
  }
]
