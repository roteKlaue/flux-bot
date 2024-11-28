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

class Command<T extends CommandOption<OptionType>[] = []> {
    public readonly name: string;
    public readonly description: string;
    public readonly cooldown?: number;
    public readonly private?: boolean;
    public readonly options?: CommandOption<OptionType>[];
    public readonly permissions?: PermissionResolvable[];
    public readonly slashCommandConfig = new SlashCommandBuilder();

    public readonly execute: CommandExecutor<T>;

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

    private validateOptions(options?: T): T {
        if (!options) return [] as unknown as T;

        return options.map(option => {
            if (!option.name || option.name.length < 1) {
                throw new Error(`[Command Error] Option name must be at least one character long. Affected option: ${option.name}`);
            }

            return { ...option, name: option.name.toLowerCase() };
        }) as T;
    }

    private computePermissions(permissions?: PermissionResolvable[]): bigint | null {
        if (!permissions || permissions.length === 0) return null;

        return permissions
            .map(p => BigInt(p as any))
            .reduce((acc, perm) => acc | perm, BigInt(0));
    }

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
