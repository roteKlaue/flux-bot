import { Middleware } from "./FluxMiddleware";
import FluxClient from "../classes/Client";
import Interop from "../classes/Interop";
import Command from "../classes/Command";
import { PromiseOr } from "sussy-util";

/**
 * Interface defining the structure of a plugin for FluxClient.
 */
export interface Plugin {
    /**
     * The unique name of the plugin.
     * Used for identification and registration within the client.
     */
    name: string;
    /**
     * The version of the plugin, typically following semantic versioning.
     * Useful for managing plugin updates and compatibility.
     */
    version: string;

    /**
     * Optional dependencies that this plugin requires.
     * Used for ensuring compatibility with other plugins.
     */
    dependencies?: { name: string, version: string }[];

    /**
     * An optional array of commands provided by the plugin.
     * These commands are registered and made available within the client.
     */
    commands?: Command<any>[];
    /**
     * An optional array of middleware functions to be executed before command execution.
     * These middleware functions are registered with the client during plugin initialization.
     */
    preExecutionMiddleware?: Middleware[];
    /**
     * An optional array of middleware functions to be executed after command execution.
     * These middleware functions are registered with the client during plugin initialization.
     */
    postExecutionMiddleware?: Middleware[];

    /**
     * A required function that initializes the plugin.
     * Called when the plugin is registered with the client.
     * @param client - The FluxClient instance to which the plugin is being added.
     * @returns A promise or void.
     */
    init: (client: FluxClient) => PromiseOr<void>;

    /**
     * An optional function that is called when the plugin is unloaded.
     * Used for cleanup, such as releasing resources or unregistering event listeners.
     * @returns A promise or void.
     */
    destroy?: () => PromiseOr<void>;

    /**
     * An optional function that is triggered whenever a command is executed.
     * Can be used for plugin-specific behavior during command handling.
     * @param interop - The interop object representing the interaction or message context.
     * @returns A promise or void.
     */
    onCommandCall?: (interop: Interop) => PromiseOr<void>;

    /**
     * An optional function to provide additional arguments for commands.
     * This can be used to inject plugin-specific context or data into command execution.
     * @param interop - The interop object representing the interaction or message context.
     * @param command - The command being executed.
     * @returns A promise or an object containing additional arguments.
     */
    provideCommandArguments?: (interop: Interop, command: Command<any>) => PromiseOr<Record<string, any>>;
}
