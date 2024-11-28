import { GuildMember, PermissionResolvable, SlashCommandBooleanOption, SlashCommandChannelOption, SlashCommandIntegerOption, SlashCommandNumberOption, SlashCommandStringOption, SlashCommandUserOption, TextChannel, VoiceBasedChannel } from "discord.js";
import Interop from "../classes/Interop";
import Client from "../classes/Client";
import { PromiseOr } from "sussy-util";

export type OptionType = 'STRING' | 'NUMBER' | 'BOOLEAN' | 'USER' | 'TEXT_CHANNEL' | 'VOICE_CHANNEL' | 'INTEGER';
export type DefaultValueForOption<T extends OptionType> =
    OptionTypeMapping<T> | ((interopt: Interop) => OptionTypeMapping<T>);

export type ChoisesType<T extends OptionType> = T extends 'INTEGER' | 'STRING' | 'NUMBER' ? Array<{ name: string; value: OptionTypeMapping<T> }> : never;

export type CommandOptionProperties<T extends OptionType> = {
    readonly name: string;
    readonly description: string;
    readonly type: T;
    readonly choises?: ChoisesType<T>;
}

export type CommandOptionOptional<T extends OptionType> = CommandOptionProperties<T> & {
    readonly required: false;
    readonly defaultValue?: DefaultValueForOption<T>;
}

export type CommandOptionRequired<T extends OptionType> = CommandOptionProperties<T> & {
    readonly required: true;
    readonly collect?: boolean;
}

export type CommandOption<T extends OptionType> = CommandOptionOptional<T> | CommandOptionRequired<T>;

export type OptionTypeMapping<T extends OptionType> =
    T extends 'STRING' ? string :
    T extends 'NUMBER' | 'INTEGER' ? number :
    T extends 'BOOLEAN' ? boolean :
    T extends 'USER' ? GuildMember :
    T extends 'TEXT_CHANNEL' ? TextChannel :
    T extends 'VOICE_CHANNEL' ? VoiceBasedChannel :
    never;

export type ExtractArgsFromOptions<T extends CommandOption<OptionType>[] = []> = {
    [K in keyof T]: T[K] extends CommandOption<OptionType> ? OptionTypeMapping<T[K]['type']> : never;
};

export type CommandExecutor<T extends CommandOption<OptionType>[] = []> = (client: Client, interopt: Interop, args: ExtractArgsFromOptions<T>) => PromiseOr<void>;

export type CommandProps<T extends CommandOption<OptionType>[] = []> = {
    name: string;
    description: string;
    cooldown?: number;
    private?: boolean;
    options?: T;
    permissions?: PermissionResolvable[];
    execute: CommandExecutor<T>;
    inDM?: boolean;
}

export type CommandOptionType<K> =
    K extends 'STRING' ? SlashCommandStringOption :
    K extends 'NUMBER' ? SlashCommandNumberOption :
    K extends 'INTEGER' ? SlashCommandIntegerOption :
    K extends 'BOOLEAN' ? SlashCommandBooleanOption :
    K extends 'USER' ? SlashCommandUserOption :
    SlashCommandChannelOption;