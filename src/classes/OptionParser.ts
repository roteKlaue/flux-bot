import { CommandInteraction, Message, TextChannel, VoiceBasedChannel } from "discord.js";
import { ExtractArgsFromOptions, OptionTypeMapping } from "../types/CommandTypings";
import { ArgumentError } from "./errors/ArgumentError";
import { CommandOption, OptionType } from "./Command";
import { PromiseOr, PromiseUtil } from "sussy-util";
import Interop from "./Interop";

type TypeParser = (arg: string, message: Message) => PromiseOr<OptionTypeMapping<OptionType>>;

export default class OptionParser {
    public static readonly optionTypeParsers = new Map<OptionType, TypeParser>([
        ["STRING", arg => arg],
        ["NUMBER", arg => {
            const num = +arg;
            if (isNaN(num)) throw new Error("Invalid number");
            return num;
        }],
        ['INTEGER', arg => {
            const int = parseInt(arg, 10);
            if (isNaN(int)) throw new Error('Invalid integer');
            return int;
        },
        ],
        ['BOOLEAN', arg => {
            if (arg.toLowerCase() === 'true') return true;
            if (arg.toLowerCase() === 'false') return false;
            throw new Error('Invalid boolean');
        },
        ],
        ['TEXT_CHANNEL', (arg, message) => {
            const channel = message.guild!.channels.cache.get(arg.replace(/[^0-9]/g, ""));
            if (!channel) throw new Error("Channel not found.");
            if (!channel.isTextBased()) throw new Error(`Provided channel is not a Text Channel.`);
            return channel as TextChannel;
        }],
        ['VOICE_CHANNEL', (arg, message) => {
            const channel = message.guild!.channels.cache.get(arg.replace(/[^0-9]/g, ""));
            if (!channel) throw new Error("Channel not found.");
            if (!channel.isTextBased()) throw new Error(`Provided channel is not a Voice Channel.`);
            return channel as VoiceBasedChannel;
        }],
        ['USER', async (arg, message) => {
            const value = await message.guild!.members.fetch(arg.replace(/[^0-9]/g, ""));
            if (!value) throw new Error("User not found.");
            return value;
        }]
    ]);

    /**
     * Extracts arguments from the options provided in a Discord command interaction.
     * @template T - The type of the command options.
     * @param interaction - The interaction from which to extract arguments.
     * @param options - The command options describing the expected arguments.
     * @param interop - An instance of the Interop class, used for resolving defaults or other shared functionality.
     * @returns An array of extracted arguments mapped to the corresponding options.
     */
    private static extractArgsFromInteractionOptions<T extends CommandOption<OptionType>[]>(
        interaction: CommandInteraction,
        options: T,
        interop: Interop
    ): ExtractArgsFromOptions<T> {
        if (!options?.length) return [] as ExtractArgsFromOptions<T>;

        return options.map((option) => {
            const { type, name, required, validate } = option;
            const optionValue = interaction.options.get(name, required);
            if (!optionValue || !optionValue.value) return void 0;

            if ((!optionValue || optionValue.value === void 0) && !required) {
                return typeof option.defaultValue === "function"
                    ? option.defaultValue(interop)
                    : option.defaultValue;
            }

            let parsedValue;
            switch (type) {
                case "STRING":
                case "NUMBER":
                case "BOOLEAN":
                    parsedValue = optionValue.value;
                    break;
                case "USER":
                    parsedValue = interaction.guild?.members.cache.get(optionValue.value.toString());
                    break;
                case "TEXT_CHANNEL":
                case "VOICE_CHANNEL":
                    parsedValue = interaction.guild?.channels.cache.get(optionValue.value.toString());
                    break;
                default:
                    throw new ArgumentError(name, `Unsupported argument type: ${type}`);
            }

            if (validate) {
                const isValid = validate(parsedValue as OptionTypeMapping<OptionType>, interop);
                if (!isValid) {
                    throw new ArgumentError(name, "Validation failed.");
                }
            }

            return parsedValue;
        }) as ExtractArgsFromOptions<T>;
    };

    /**
     * Extracts arguments from a message's content based on the command's options.
     * @template T - The type of the command options.
     * @param message - The Discord message containing the command and its arguments.
     * @param options - The command options describing the expected arguments.
     * @param interop - An instance of the Interop class, used for resolving defaults or other shared functionality.
     * @param args - The raw arguments extracted from the message content.
     * @returns A promise that resolves to an array of extracted arguments.
     * @throws An error if required arguments are missing or invalid values are provided.
     */
    private static async extractArgsFromMessage<T extends CommandOption<OptionType>[]>(
        message: Message,
        options: T,
        interop: Interop,
        args: string[]
    ): Promise<ExtractArgsFromOptions<T>> {
        const parsedArgs: any[] = [];

        for (let i = 0; i < options.length; i++) {
            const option = options[i];
            const arg = args[0];

            if (!arg && !option.required) {
                const defaultValue = typeof option.defaultValue === "function"
                    ? option.defaultValue(interop)
                    : option.defaultValue;
                parsedArgs.push(defaultValue);
                continue;
            }

            if (option.required && !arg) {
                throw ArgumentError.missingArgument(option.name);
            }

            if (option.type === 'STRING' && option.collect) {
                const collected = args.join(" ");

                if (collected.trim().length < 1 && option.required) {
                    throw ArgumentError.missingArgument(option.name);
                }

                parsedArgs.push(collected.trim());
                break;
            }

            const parser = OptionParser.optionTypeParsers.get(option.type);
            if (!parser) throw new ArgumentError(option.name, `Unsupported type: ${option.type}`);
            const [parsedValue, error] = await PromiseUtil.handler(parser(arg, message));

            if (error) throw new ArgumentError(option.name, error.message);

            if (option.validate) {
                const isValid = option.validate(parsedValue as OptionTypeMapping<OptionType>, interop);
                if (!isValid) {
                    throw new ArgumentError(option.name, "Validation failed.");
                }
            }
        }

        return parsedArgs as ExtractArgsFromOptions<T>;
    }

    /**
     * Parses and resolves command options from either a message or an interaction.
     * @template T - The type of the command options.
     * @param options - The options defining the structure and types of arguments for the command.
     * @param source - The source of the command, either a Discord interaction or message.
     * @param interop - An instance of the Interop class, used for resolving defaults or other shared functionality.
     * @param args - An optional array of arguments, used for message-based commands.
     * @returns A promise resolving to the extracted arguments matching the command options.
     * @throws An error if the source type is unsupported.
     */
    public static async parseOptions<T extends CommandOption<OptionType>[]>(
        options: T,
        source: CommandInteraction | Message,
        interop: Interop,
        args: string[] = []
    ): Promise<ExtractArgsFromOptions<T>> {
        if (source instanceof CommandInteraction) {
            return this.extractArgsFromInteractionOptions<T>(source, options, interop);
        }

        if (source instanceof Message) {
            return this.extractArgsFromMessage<T>(source, options, interop, args);
        }

        throw new Error("Unsupported source type for argument parsing.");
    }
}
