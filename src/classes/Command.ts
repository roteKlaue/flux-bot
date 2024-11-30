import { ChannelType, InteractionContextType, PermissionResolvable, SlashCommandBuilder, SlashCommandChannelOption } from "discord.js";
import { CommandExecutor, CommandOption, CommandProps, OptionType } from "../types/CommandTypings";

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
    public readonly cooldown?: number;
    public readonly private?: boolean;
    public readonly options?: CommandOption<OptionType>[];
    public readonly permissions?: PermissionResolvable[];
    public readonly slashCommandConfig = new SlashCommandBuilder();

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
        this.private = props.private;
        this.options = this.validateOptions(props.options);
        this.permissions = props.permissions;
        this.execute = props.execute;

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
                    option.type === "VOICE_CHANNEL" ? ChannelType.GuildVoice : ChannelType.GuildText
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
    private static isChannelCommandOption(base: any): base is SlashCommandChannelOption {
        return base instanceof SlashCommandChannelOption;
    }
}

export {
    OptionType,
    CommandOption,
    Command
};

export default Command;
