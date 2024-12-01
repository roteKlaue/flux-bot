# Command

The ``Command`` class represents a Discord command. It integrates both text-based and slash command capabilities.

## Properties

- ``name``: string <br>
    The command's name.

- ``description``: string <br>
    A brief description of the command.

- ``aliases``?: string[] <br>
    Alternative names for the command.

- ``category``: string <br>
    The command's category (default: "Miscellaneous").

- ``cooldown``?: number <br>
    The cooldown in seconds.

- ``private``?: boolean <br>
    Whether the command is private.

- ``options``?: CommandOption<OptionType\>[] <br>
    List of options for the command.

- ``permissions``?: PermissionResolvable[] <br>
    Required permissions for the command.

- ``slashCommandConfig``: SlashCommandBuilder <br>
    Slash command configuration.

- ``inDM``: boolean <br>
    Whether the command can be used in DMs.

- ``execute``: CommandExecutor<T\> <br>
    Function executed when the command is run.

## Constructor

```ts
constructor(props: CommandProps<T>);
```

Initializes a new ``Command`` instance.
**Throws**: If the name or options are invalid.

## Methods

- ``validateOptions(options?: T): T``
    Ensures options are valid. <br>
    **Throws**: If an option name is invalid.

- ``computePermissions(permissions?: PermissionResolvable[]): bigint`` <br>
    Computes a permissions bitfield from the list of permissions.

- ``configureSlashCommand(props: CommandProps<T>): void`` <br>
    Configures the SlashCommandBuilder for the command. <br>
    **Throws**: If a channel option is used in DM contexts.

- ``addOptionToBuilder(option: CommandOption<OptionType>, inDM: boolean): void`` <br>
    Adds an option to the SlashCommandBuilder. <br>
    **Throws**: If the option type or choices are invalid.

## Utility: typeToMethodMap

A mapping of ``OptionType`` to methods for adding options to a ``SlashCommandBuilder``. This ensures the correct method is called based on the option type.

Supported option types:

- ``STRING``
- ``NUMBER``
- ``INTEGER``
- ``BOOLEAN``
- ``USER``
- ``TEXT_CHANNEL``
- ``VOICE_CHANNEL``
