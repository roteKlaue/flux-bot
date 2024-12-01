import { ChannelType, InteractionContextType, PermissionResolvable, SlashCommandBuilder, SlashCommandChannelOption } from "discord.js";
import { CommandExecutor, CommandOption, CommandProps, OptionType } from "../types/CommandTypings";
import { Builder } from "sussy-util";

class CommandBuilder implements Builder<Command> {
    private name?: string;
    private description?: string;
    private cooldown?: number;
    private category?: string;
    private private?: boolean;
    private options: CommandOption<OptionType>[] = [];
    private permissions?: PermissionResolvable[];
    private inDM: boolean = false;
    private execute?: CommandExecutor<any>;
    private aliases?: string[];

    setName(name: string): this {
        if (!name?.length) {
            throw new Error(`[CommandBuilder Error] Command name must be at least one character long.`);
        }
        this.name = name.toLowerCase();
        return this;
    }

    setCategory(category: string) {
        this.category = category;
        return this;
    }

    setDescription(description: string): this {
        if (!description?.length) {
            throw new Error(`[CommandBuilder Error] Command description must be at least one character long.`);
        }
        this.description = description;
        return this;
    }

    setAliases(aliases: string[]): this {
        this.aliases = aliases;
        return this;
    }

    addAlias(alias: string): this {
        if (!this.aliases) this.aliases = [];
        this.aliases.push(alias);
        return this;
    }

    setCooldown(cooldown: number): this {
        if (cooldown < 0) {
            throw new Error(`[CommandBuilder Error] Cooldown must be a non-negative number.`);
        }
        this.cooldown = cooldown;
        return this;
    }

    setPrivate(isPrivate: boolean): this {
        this.private = isPrivate;
        return this;
    }

    setPermissions(permissions: PermissionResolvable[]): this {
        this.permissions = permissions;
        return this;
    }

    addPermission(permission: PermissionResolvable): this {
        if (!permission) {
            throw new Error(`[CommandBuilder Error] Invalid permission.`);
        }

        if (!this.permissions) this.permissions = [];

        if (!this.permissions.includes(permission)) {
            this.permissions.push(permission);
        }
        return this;
    }

    setInDM(inDM: boolean): this {
        this.inDM = inDM;
        return this;
    }

    addOption(option: CommandOption<OptionType>): this {
        if (!option?.name || option?.name?.length < 1) {
            throw new Error(`[CommandBuilder Error] Option name must be at least one character long.`);
        }
        this.options.push({ ...option, name: option.name.toLowerCase() });
        return this;
    }

    setExecutor(executor: CommandExecutor<any>): this {
        this.execute = executor;
        return this;
    }

    build(): Command {
        if (!this.name || !this.description || !this.execute) {
            throw new Error(`[CommandBuilder Error] Missing required properties: name, description, or execute function.`);
        }

        return new Command({
            name: this.name,
            description: this.description,
            aliases: this.aliases,
            category: this.category,
            cooldown: this.cooldown,
            private: this.private,
            options: this.options,
            permissions: this.permissions,
            inDM: this.inDM,
            execute: this.execute,
        });
    }
}

const typeToMethodMap: {
    [K in OptionType]: (builder: SlashCommandBuilder, setup: (option: any) => any) => void;
} = {
    STRING: (builder, setup) => builder.addStringOption(setup),
    NUMBER: (builder, setup) => builder.addNumberOption(setup),
    INTEGER: (builder, setup) => builder.addIntegerOption(setup),
    BOOLEAN: (builder, setup) => builder.addBooleanOption(setup),
    USER: (builder, setup) => builder.addUserOption(setup),
    TEXT_CHANNEL: (builder, setup) => builder.addChannelOption(setup),
    VOICE_CHANNEL: (builder, setup) => builder.addChannelOption(setup),
};

/**
 * Class representing a Discord command with both slash and text command capabilities.
 * @template T - The type of the command's options.
 */
class Command<T extends CommandOption<OptionType>[] = []> {
    public readonly name: string;
    public readonly description: string;
    public readonly aliases?: string[];
    public readonly category: string;
    public readonly cooldown?: number;
    public readonly private?: boolean;
    public readonly options?: CommandOption<OptionType>[];
    public readonly permissions?: PermissionResolvable[];
    public readonly slashCommandConfig = new SlashCommandBuilder();
    public readonly inDM: boolean;

    public readonly execute: CommandExecutor<T>;

    /**
     * Initializes a new Command instance.
     * @param props - The properties defining the command.
     * @throws {Error} If the command name is invalid or any option has an invalid name or type.
     */
    constructor(props: CommandProps<T>) {
        this.name = props.name.toLowerCase();

        if (this.name.length < 1)
            throw new Error(`[Command Error] Command name must be at least one character long. Affected command: ${JSON.stringify(props)}`);

        this.description = props.description;
        this.cooldown = props.cooldown;
        this.aliases = props.aliases;
        this.category = props.category ?? "Miscellaneous";
        this.private = props.private;
        this.options = this.validateOptions(props.options);
        this.permissions = props.permissions;
        this.execute = props.execute.bind(this);
        this.inDM = props.inDM ?? false;

        this.configureSlashCommand(props);
    }

    /**
     * Validates and normalizes the options for the command.
     * @param options - The options to validate.
     * @returns The validated and normalized options.
     * @throws {Error} If any option has an invalid name.
     */
    private validateOptions(options?: T): T {
        if (!options) return [] as unknown as T;

        return options.map(option => {
            if (!option.name || option.name.length < 1) {
                throw new Error(`[Command Error] Option name must be at least one character long. Affected option: ${option.name}`);
            }

            return { ...option, name: option.name.toLowerCase() };
        }) as T;
    }

    /**
     * Computes the permissions for the command as a single bitfield value.
     * @param permissions - The list of permissions required for the command.
     * @returns The computed bitfield value.
     */
    private computePermissions(permissions?: PermissionResolvable[]): bigint {
        if (!permissions || permissions.length === 0) return BigInt(0);

        return permissions
            .map(p => BigInt(p as any))
            .reduce((acc, perm) => acc | perm, BigInt(0));
    }

    /**
     * Configures the SlashCommandBuilder for the command.
     * @param props - The properties defining the command.
     * @throws {Error} If a channel option is invalid in DM contexts.
     */
    private configureSlashCommand(props: CommandProps<T>): void {
        this.slashCommandConfig
            .setName(this.name)
            .setDescription(this.description)
            .setDefaultMemberPermissions(this.computePermissions(props.permissions))
            .setContexts(
                props.inDM
                    ? [InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel]
                    : [InteractionContextType.Guild]
            );

        if (props.options) {
            props.options.forEach(option => this.addOptionToBuilder(option, props.inDM ?? false));
        }
    }

    /**
     * Adds an option to the SlashCommandBuilder.
     * @param option - The option to add.
     * @param inDM - Whether the command is available in DMs.
     * @throws {Error} If the option type is invalid or choices are misconfigured.
     */
    private addOptionToBuilder(option: CommandOption<OptionType>, inDM: boolean): void {
        const method = typeToMethodMap[option.type];
        if (!method) {
            throw new Error(`[Command Error] Invalid option type for command: ${this.name}, Option: ${option.name}`);
        }

        method(this.slashCommandConfig, settings => {
            settings.setName(option.name.toLowerCase())
                .setDescription(option.description)
                .setRequired(option.required);

            if (Command.isChannelCommandOption(settings)) {
                if (inDM) {
                    throw new Error(`[Command Error] Channel options are guild-only. Command: ${this.name}, Option: ${option.name}`);
                }

                settings.addChannelTypes(
                    option.type === "VOICE_CHANNEL"
                        ? ChannelType.GuildVoice
                        : ChannelType.GuildText
                );
            }

            if (option.choises) {
                if (["STRING", "INTEGER", "NUMBER"].includes(option.type)) {
                    settings.addChoices(...option.choises);
                } else {
                    throw new Error(`[Command Error] Choices are only valid for STRING, INTEGER, or NUMBER types. Command: ${this.name}, Option: ${option.name}`);
                }
            }

            return settings;
        });
    }

    /**
     * Type guard to determine if an option is a channel option.
     * @param base - The base object to check.
     * @returns True if the base is a channel option, false otherwise.
     */
    private static isChannelCommandOption(base: unknown): base is SlashCommandChannelOption {
        return base instanceof SlashCommandChannelOption;
    }
}

export {
    OptionType,
    CommandOption,
    Command,
    CommandBuilder
};

export default Command;
