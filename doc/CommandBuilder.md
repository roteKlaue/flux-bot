# CommandBuilder

The CommandBuilder class is a builder pattern implementation for defining commands. It ensures commands are built with valid properties and simplifies their creation.

## Methods

- ``setName(name: string): this`` <br>
    Sets the command's name. <br>
    **Throws**: If the name is invalid.

- ``setCategory(category: string): this`` <br>
    Assigns the command to a category.

- ``setDescription(description: string): this`` <br>
    Sets the command's description. <br>
    **Throws**: If the description is invalid.

- ``setAliases(aliases: string[]): this`` <br>
    Sets multiple aliases for the command.

- ``addAlias(alias: string): this`` <br>
    Adds a single alias.

- ``setCooldown(cooldown: number): this`` <br>
    Sets the cooldown in seconds. <br>
    **Throws**: If the cooldown is negative.

- ``setPrivate(isPrivate: boolean): this`` <br>
    Marks the command as private.

- ``setPermissions(permissions: PermissionResolvable[]): this`` <br>
    Sets the required permissions for the command.

- ``addPermission(permission: PermissionResolvable): this`` <br>
    Adds a single permission to the command. <br>
    **Throws**: If the permission is invalid.

- ``setInDM(inDM: boolean): this`` <br>
    Marks whether the command can be used in DMs.

- ``addOption(option: CommandOption<OptionType\>): thi``s <br>
    Adds an option to the command. <br>
    **Throws**: If the option name or type is invalid.

- ``setExecutor(executor: CommandExecutor<any\>): thi``s <br>
    Sets the function to execute when the command is run.

- ``build(): Command`` <br>
    Constructs the ``Command`` instance. <br>
    **Throws**: If required properties (name, description, or execute) are missing.

## Usage Example

### Defining a Command with the Builder

```ts
import { CommandBuilder } from "flux-bot";

const pingCommand = new CommandBuilder()
    .setName("ping")
    .setDescription("Checks the bot's latency.")
    .setCategory("Utility")
    .setCooldown(5)
    .setExecutor(async (client, interop, args) => {
        await interop.reply("Pong!");
    })
    .build();
```
