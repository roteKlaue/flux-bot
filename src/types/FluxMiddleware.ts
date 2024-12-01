import { PromiseOr } from "sussy-util";
import FluxClient from "../classes/Client";
import Command from "../classes/Command";
import Interop from "../classes/Interop";

/**
 * Represents a middleware function that can process a command execution context.
 * Middleware functions can perform custom logic and optionally pass control to the next middleware in the chain.
 * 
 * @param context - The context of the current command execution, including the command, arguments, interop, and client.
 * @param next - A function that passes control to the next middleware in the chain.
 * @returns A promise that resolves when the middleware logic is complete.
 */
type Middleware = (context: MiddlewareContext, next: () => PromiseOr<void>) => PromiseOr<void>;

/**
 * Represents the context provided to each middleware function during command execution.
 */
interface MiddlewareContext {
    command: Command<any>;
    args: unknown[];
    interop: Interop;
    client: FluxClient;
}

export {
    Middleware,
    MiddlewareContext
}