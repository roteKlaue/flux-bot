# flux-bot

flux-bot is an advanced extension for Discord.js that simplifies the process of handling commands, argument parsing, and interactions for both slash and text-based commands.

## Features

- Unified handling for slash and text-based commands.
- Argument parsing with validation and defaults.
- Permission and cooldown management.
- Dynamic command loading.
- Supports private and public commands.

## Installation

Install flux-bot via npm:

```bash
npm install flux-bot
```

## Usage

### Creating a Client

To create a HarmonyClient instance, use the following example:

```ts
import HarmonyClient from 'flux-bot';
import { IntentsBitField } from 'discord.js';

const client = new HarmonyClient({
    intents: [
        IntentsBitField.Flags.Guilds,
        IntentsBitField.Flags.GuildMessages,
    ],
    allowTextCommands: true,
    prefix: '!',
});

client.login('YOUR_BOT_TOKEN');
```

### Adding Commands

Commands are defined using the `Command` class. Here's an example of adding a command:

```ts
import Command from './Command';

client.loadCommands([
    new Command({
        name: 'ping',
        description: 'Replies with Pong!',
        execute: async (client, interop) => {
            await interop.followUp('Pong!');
        },
    }),
]);
```

### Events

HarmonyClient emits various events for handling errors and custom logic:

- commandNotFound
- argumentParsingError
- permissionDenied
- cooldownActive
- commandExecutionError

Example:

```ts
client.on('commandNotFound', ({ interaction, name }) => {
    console.error(`Command not found: ${name}`);
});
```

## Contributing

Contributions are welcome! Feel free to open an issue or submit a pull request.
