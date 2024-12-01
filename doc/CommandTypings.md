# CommandTypings

## Overview

The types and interfaces are structured to enable the definition of command options with specific types, validation, and execution logic. The system supports various Discord-specific option types like text channels, voice channels, and more.

### Supported Option Types

The OptionType defines the supported types for command options:

- `'STRING'`
- `'NUMBER'`
- `'INTEGER'`
- `'BOOLEAN'`
- `'USER'`
- `'TEXT_CHANNEL'`
- `'VOICE_CHANNEL'`

### Default Value for Options

```ts
type DefaultValueForOption<T extends OptionType> =
    OptionTypeMapping<T> | ((interop: Interop) => OptionTypeMapping<T>);
```

Represents the default value for a command option. It can be:

- A static value.
- A function returning a value based with Interop instance.

### Choices for Options

```ts
type ChoisesType<T extends OptionType> = T extends 'INTEGER' | 'STRING' | 'NUMBER' 
    ? Array<{ name: string; value: OptionTypeMapping<T> }> 
    : never;
```

Choices are available for:

- `STRING`
- `NUMBER`
- `INTEGER`

### Command Option Properties

#### Common Properties

```ts
type CommandOptionProperties<T extends OptionType> = {
    readonly name: string;
    readonly description: string;
    readonly type: T;
    readonly choises?: ChoisesType<T>;
    validate?: (value: OptionTypeMapping<T>, interop: Interop) => PromiseOr<boolean>;
} & (T extends 'STRING' ? { readonly collect?: boolean; } : { readonly collect?: never; });
```

All command options must include:

- `name`: The option's name.
- `description`: A brief description.
- `type`: The option type.
- `choises` (optional): Valid choices for options supporting them.
- `validate` (optional): A function to validate the option's value.

#### Required and Optional Options

#### Optional Options

```ts
type CommandOptionOptional<T extends OptionType> = CommandOptionProperties<T> & {
    readonly required: false;
    readonly defaultValue?: DefaultValueForOption<T>;
};
```

Optional options include:

- `required`: Set to false.
- `defaultValue` (optional): Default value for the option.

#### Required Options

```ts
type CommandOptionRequired<T extends OptionType> = CommandOptionProperties<T> & {
    readonly required: true;
};
```

Required options include:

- `required`: Set to true.

#### Command Options

```ts
type CommandOption<T extends OptionType> = CommandOptionOptional<T> | CommandOptionRequired<T>;
```

Represents a command option, which can be either required or optional.

### Option Type Mapping

```ts
type OptionTypeMapping<T extends OptionType> =
    T extends 'STRING' ? string :
    T extends 'NUMBER' | 'INTEGER' ? number :
    T extends 'BOOLEAN' ? boolean :
    T extends 'USER' ? GuildMember :
    T extends 'TEXT_CHANNEL' ? TextChannel :
    T extends 'VOICE_CHANNEL' ? VoiceBasedChannel :
    never;
```

Maps each option type to its corresponding JavaScript type:

- 'STRING' → string
- 'NUMBER' / 'INTEGER' → number
- 'BOOLEAN' → boolean
- 'USER' → GuildMember
- 'TEXT_CHANNEL' → TextChannel
- 'VOICE_CHANNEL' → VoiceBasedChannel

### Extracting Arguments

```ts
type ExtractArgsFromOptions<T extends CommandOption<OptionType>[] = []> = {
    [K in keyof T]: T[K] extends CommandOption<OptionType> ? OptionTypeMapping<T[K]['type']> : never;
};
```

Extracts arguments from a list of command options as a tuple.

### Command Execution

```ts
type CommandExecutor<T extends CommandOption<OptionType>[] = []> = (
    this: Command<T>,
    client: Client,
    interop: Interop,
    args: ExtractArgsFromOptions<T>
) => PromiseOr<void>;
```

Defines the signature for the execute function of a command.

### Command Properties

```ts
type CommandProps<T extends CommandOption<OptionType>[] = []> = {
    name: string;
    description: string;
    aliases?: string[];
    category?: string;
    cooldown?: number;
    private?: boolean;
    options?: T;
    permissions?: PermissionResolvable[];
    execute: CommandExecutor<T>;
    inDM?: boolean;
};
```

Properties required to define a command:

- ``name``: Command name.
- ``description``: Command description.
- ``aliases`` (optional): Alternative command names.
- ``category`` (optional): Command category.
- ``cooldown`` (optional): Cooldown time in seconds.
- ``private`` (optional): If true, hides the command from general use.
- ``options`` (optional): Array of command options.
- ``permissions`` (optional): Required permissions for the command.
- ``execute``: Function executed when the command is run.
- ``inDM`` (optional): Whether the command can be used in DMs.

### Slash Command Option Classes

```ts
type CommandOptionType<K> =
    K extends 'STRING' ? SlashCommandStringOption :
    K extends 'NUMBER' ? SlashCommandNumberOption :
    K extends 'INTEGER' ? SlashCommandIntegerOption :
    K extends 'BOOLEAN' ? SlashCommandBooleanOption :
    K extends 'USER' ? SlashCommandUserOption :
    SlashCommandChannelOption;
```

Maps option types to their corresponding discord.js SlashCommandOption classes.
