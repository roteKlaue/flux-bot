# Middleware and MiddlewareContext

## 1. Middleware

The ``Middleware`` type represents a middleware function that processes a command execution context and optionally passes control to the next middleware in the chain.

```ts
type Middleware = (
    context: MiddlewareContext,
    next: () => PromiseOr<void>
) => PromiseOr<void>;
```

### Parameters:

- ``context``: The current execution context provided to the middleware.

    Type: MiddlewareContext.

- ``next``: A function that passes control to the next middleware in the chain.

    Type: ``() => PromiseOr<void>``.

- Returns:

    A ``PromiseOr<void>`` indicating when the middleware's logic is complete.

## 2. MiddlewareContext

The ``MiddlewareContext`` interface describes the context provided to each middleware function during command execution.

```ts
interface MiddlewareContext {
    command: Command;
    args: unknown[];
    interop: Interop;
    client: FluxClient;
}
```

### Properties:

- ``command: Command``

    The ``Command`` instance currently being executed.

- ``args: unknown[]``

    The arguments passed to the command.

- ``interop: Interop``

    An ``Interop`` instance providing context and utilities for the interaction or message triggering the command.

- ``client: FluxClient``

    The ``FluxClient`` instance managing the command execution.

## Example

### Creating a Middleware

```ts
const loggingMiddleware: Middleware = async (context, next) => {
    console.log(`[Middleware] Command: ${context.command.name}, Args: ${JSON.stringify(context.args)}`);
    await next();
};
```

### Registering Middleware in ``FluxClient``

```ts
client.registerPreExecutionMiddleware(loggingMiddleware);

client.registerPostExecutionMiddleware(async (context, next) => {
    console.log(`[Middleware] Command executed: ${context.command.name}`);
    await next();
});
```
