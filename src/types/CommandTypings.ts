import {
    GuildMember,
    PermissionResolvable,
    SlashCommandBooleanOption,
    SlashCommandChannelOption,
    SlashCommandIntegerOption,
    SlashCommandNumberOption,
    SlashCommandStringOption,
    SlashCommandUserOption,
    TextChannel,
    VoiceBasedChannel
} from "discord.js";
import Interop from "../classes/Interop";
import Command from "../classes/Command";
import Client from "../classes/Client";
import { PromiseOr } from "sussy-util";

/**
 * Supported option types for commands.
 */
export type OptionType = 'STRING' | 'NUMBER' | 'BOOLEAN' | 'USER' | 'TEXT_CHANNEL' | 'VOICE_CHANNEL' | 'INTEGER';

/**
 * Default value for a command option, either a static value or a function returning the value.
 * @template T - The type of the option.
 */
export type DefaultValueForOption<T extends OptionType> =
    OptionTypeMapping<T> | ((interopt: Interop) => OptionTypeMapping<T>);

/**
 * Choices for option types that support them (STRING, NUMBER, INTEGER).
 * @template T - The type of the option.
 */
export type ChoicesType<T extends OptionType> = T extends 'INTEGER' | 'STRING' | 'NUMBER' 
    ? Array<{ name: string; value: OptionTypeMapping<T> }> 
    : never;

/**
 * Properties required for all command options.
 * @template T - The type of the option.
 */
export type CommandOptionProperties<T extends OptionType> = {
    readonly name: string;
    readonly description: string;
    readonly type: T;
    readonly choices?: ChoicesType<T>;
    validate?: (value: OptionTypeMapping<T>, interop: Interop) => PromiseOr<boolean>;
} & (T extends 'STRING' ? { readonly collect?: boolean; } : { readonly collect?: never; })

/**
 * Represents an optional command option.
 * @template T - The type of the option.
 */
export type CommandOptionOptional<T extends OptionType> = CommandOptionProperties<T> & {
    readonly required: false;
    readonly defaultValue?: DefaultValueForOption<T>;
}

/**
 * Represents a required command option.
 * @template T - The type of the option.
 */
export type CommandOptionRequired<T extends OptionType> = CommandOptionProperties<T> & {
    readonly required: true;
}

/**
 * Represents a command option, which can be either required or optional.
 * @template T - The type of the option.
 */
export type CommandOption<T extends OptionType> = CommandOptionOptional<T> | CommandOptionRequired<T>;

/**
 * Maps option types to their corresponding JavaScript types.
 * @template T - The type of the option.
 */
export type OptionTypeMapping<T extends OptionType> =
    T extends 'STRING' ? string :
    T extends 'NUMBER' | 'INTEGER' ? number :
    T extends 'BOOLEAN' ? boolean :
    T extends 'USER' ? GuildMember :
    T extends 'TEXT_CHANNEL' ? TextChannel :
    T extends 'VOICE_CHANNEL' ? VoiceBasedChannel :
    never;

/**
 * Extracts arguments from a list of command options as a tuple.
 * @template T - The list of command options.
 */
export type ExtractArgsFromOptions<T extends CommandOption<OptionType>[] = []> = {
    [K in keyof T]: T[K] extends CommandOption<OptionType> ? OptionTypeMapping<T[K]['type']> : never;
};

/**
 * Function signature for executing a command.
 * @template T - The list of command options.
 */
export type CommandExecutor<T extends CommandOption<OptionType>[] = []> = (
    this: Command<T>,
    client: Client,
    interopt: Interop,
    args: ExtractArgsFromOptions<T>,
    pluginArgs?: Record<string, any>) => PromiseOr<void>;

/**
 * Properties required to define a command.
 * @template T - The list of command options.
 */
export type CommandProps<T extends CommandOption<OptionType>[] = []> = {
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
}

/**
 * Maps option types to their corresponding SlashCommandOption classes.
 * @template K - The option type.
 */
export type CommandOptionType<K> =
    K extends 'STRING' ? SlashCommandStringOption :
    K extends 'NUMBER' ? SlashCommandNumberOption :
    K extends 'INTEGER' ? SlashCommandIntegerOption :
    K extends 'BOOLEAN' ? SlashCommandBooleanOption :
    K extends 'USER' ? SlashCommandUserOption :
    SlashCommandChannelOption;
