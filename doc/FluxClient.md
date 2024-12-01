# FluxClient

The ``FluxClient`` is a custom extension of the Discord.js ``Client`` class, designed to handle text-based and slash commands efficiently. It includes features such as middleware, cooldown management, and command reloading.

## Type Parameters

- ``T``: Boolean indicating whether text commands are enabled.

## Properties

- ``cooldowns: Collection<string, Collection<string, number>>`` <br>
    Tracks command cooldowns for users.

- ``commands: Collection<string, Command<any>>`` <br>
    Stores all registered commands.

- ``prefix: T extends true ? string : undefined`` <br>
    The command prefix, available if text commands are enabled.

- ``logger?: FluxLogger``  <br>
    Optional logger for tracking events and errors.

- ``preExecutionMiddleware: Middleware[]`` <br>
    Middleware functions to run before command execution.

- ``postExecutionMiddleware: Middleware[]`` <br>
    Middleware functions to run after command execution.

## Constructor

```ts
constructor(options: FluxClientOptions<T>);
```

Initializes the ``FluxClient`` with the following options:

- ``allowTextCommands``: Enables text commands if true.
- ``reloadCommandsOnStartUp``: Reloads commands when the bot starts.
- ``logger``: Logger instance for debugging.
- ``prefix``: Command prefix (required if allowTextCommands is true).

## Methods

### Command Handling

- ``handleInteraction(interaction: Interaction): Promise<void>`` <br>
    Handles slash command interactions.

- ``handleMessageInteraction(message: Message): Promise<void>`` <br>
    Handles text-based command messages.

- ``commandHandler<T>(command: Command<T>, interop: Interop, args: ExtractArgsFromOptions<T>): Promise<void>`` <br>
    Executes commands after validating permissions, cooldowns, and running middleware.

### Middleware Management

- ``registerPreExecutionMiddleware(middleware: Middleware): void``  <br>
    Registers pre-execution middleware.

- ``registerPostExecutionMiddleware(middleware: Middleware): void`` <br>
    Registers post-execution middleware.

- ``executeMiddleware(middleware: Middleware[], context: MiddlewareContext): Promise<boolean>``  <br>
    Executes middleware functions sequentially. Returns ``true`` if all middleware passes.

### Command Loading and Reloading

- ``loadCommands(commands: Command<any>[]): void`` <br>
    Dynamically loads commands into the client.

- ``loadCommandsFolder(path: string): void`` <br>
    Loads command files from a specified folder.

- ``reloadCommands(): Promise<number>`` <br>
    Reloads all commands and updates Discord with the latest configurations.

## Usage

```ts
import { FluxClient } from "flux-bot";
import { IntentsBitField } from 'discord.js';

const client = new FluxClient({
    intents: [
        IntentsBitField.Flags.Guilds,
        IntentsBitField.Flags.GuildMessages,
    ],
    allowTextCommands: true,
    prefix: "!",
    reloadCommandsOnStartUp: true,
    logger: console,
});

client.once("ready", () => {
    console.log(`Logged in as ${client.user.tag}`);
});

client.loadCommandsFolder("./commands");

client.registerPreExecutionMiddleware(async (context, next) => {
    console.log(`Pre-execution for command: ${context.command.name}`);
    await next();
});

client.registerPostExecutionMiddleware(async (context, next) => {
    console.log(`Post-execution for command: ${context.command.name}`);
    await next();
});

client.login(process.env.TOKEN);
```

## Events

- ``commandNotFound`` Triggered when a command is not found.
- ``invalidArgumentsGiven`` Triggered when argument parsing fails (meaning the user gave invalid input).
- ``permissionDenied`` Triggered when a user lacks required permissions.
- ``cooldownActive`` Triggered when a command is on cooldown.
- ``middlewareError`` Triggered when middleware encounters an error.
- ``commandExecutionError`` Triggered when command execution fails.
- ``invalidContext`` Triggered when a guild only command is used in a DM.
