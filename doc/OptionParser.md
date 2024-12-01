# OptionParser

The ``OptionParser`` class handles parsing and extracting arguments from Discord interactions or messages, based on predefined command options. It supports various argument types and provides mechanisms for validation, default values, and resolving arguments.

## Static Methods

1. ``extractArgsFromInteractionOptions``

Parses arguments from a CommandInteraction.

```ts
private static extractArgsFromInteractionOptions<T extends CommandOption<OptionType>[]>(
    interaction: CommandInteraction,
    options: T,
    interop: Interop
): ExtractArgsFromOptions<T>;
```

- **Parameters**:
  - ``interaction``: The ``CommandInteraction`` containing the arguments.
  - ``options``: Array of command options describing expected arguments.
  - ``interop``: An ``Interop`` instance for shared utilities like resolving defaults.
- **Returns**:

    A mapped array of arguments matching the command options.

- **Throws**:
  - If an unsupported argument type is encountered.
  - If validation fails for an argument.

1. `extractArgsFromMessage`

Parses arguments from a ``Message``.

```ts
private static async extractArgsFromMessage<T extends CommandOption<OptionType>[]>(
    message: Message,
    options: T,
    interop: Interop,
    args: string[]
): Promise<ExtractArgsFromOptions<T>>;
```

- **Parameters**:

  - ``message``: The ``Message`` containing the command and arguments.
  - ``options``: Array of command options describing expected arguments.
  - ``interop``: An ``Interop`` instance for shared utilities like resolving defaults.
  - ``args``: Array of raw arguments extracted from the message content.

- **Returns**:

  A `Promise` resolving to a mapped array of arguments.

- **Throws**:
  - If required arguments are missing.
  - If invalid values are provided for an argument.
  - If validation fails for an argument.

1. `parseOptions`

Parses arguments from a CommandInteraction or Message.

```ts
public static async parseOptions<T extends CommandOption<OptionType>[]>(
    options: T,
    source: CommandInteraction | Message,
    interop: Interop,
    args: string[] = []
): Promise<ExtractArgsFromOptions<T>>;
```

- **Parameters**:

  - ``options``: Array of command options defining argument structure and types.
  - ``source``: The source of the command, either a ``CommandInteraction`` or ``Message``.
  - ``interop``: An ``Interop`` instance for shared utilities like resolving defaults.
  - ``args``: Optional array of raw arguments for text-based commands.

- **Returns**:

    A ``Promise`` resolving to the extracted arguments.

- **Throws**:
  - If the source type is unsupported.

## Error Handling

The ``OptionParser`` validates arguments based on their type and runs custom validations if provided. It throws descriptive errors for:

- Missing required arguments.
- Invalid values for specific types (e.g., non-numeric input for ``NUMBER``).
- Validation failures.
