import { ExtractArgsFromOptions, OptionTypeMapping } from "../types/CommandTypings";
import { CommandInteraction, Message } from "discord.js";
import { CommandOption, OptionType } from "./Command";
import Interop from "./Interop";

export default class OptionParser {
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
                if (!required) {
                    return typeof option.defaultValue === "function"
                        ? option.defaultValue(interop)
                        : option.defaultValue;
                }
                return void 0;
            }

            let parsedValue;
            switch (type) {
                case "STRING":
                case "NUMBER":
                case "BOOLEAN":
                    parsedValue = optionValue;
                    break;
                case "USER":
                    parsedValue = interaction.guild?.members.cache.get(optionValue.toString());
                    break;
                case "TEXT_CHANNEL":
                case "VOICE_CHANNEL":
                    parsedValue = interaction.guild?.channels.cache.get(optionValue.toString());
                    break;
                default:
                    throw new Error(`Unsupported argument type: ${type}`);
            }

            if (validate) {
                const isValid = validate(parsedValue as OptionTypeMapping<OptionType>, interop);
                if (!isValid) {
                    throw new Error(`Validation failed for argument: ${name}`);
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

            if (option.required && !arg) {
                throw new Error(`Missing required argument: ${option.name}`);
            }

            if (!arg && !option.required) {
                const defaultValue = typeof option.defaultValue === "function"
                    ? option.defaultValue(interop)
                    : option.defaultValue;
                parsedArgs.push(defaultValue);
                continue;
            }

            if (option.type === 'STRING' && option.collect) {
                const collected = args.join(" ");

                if (collected.trim().length < 1 && option.required) {
                    throw new Error(`Argument ${option.name} requires input.`);
                }

                parsedArgs.push(collected);
                break;
            }

            let parsedValue;
            switch (option.type) {
                case "STRING":
                    parsedValue = arg;
                    break;
                case "NUMBER":
                    parsedValue = +arg;
                    if (isNaN(parsedValue)) {
                        throw new Error(`Invalid number for argument: ${option.name}`);
                    }
                    break;
                case "INTEGER":
                    parsedValue = parseInt(arg);
                    if (isNaN(parsedValue)) {
                        throw new Error(`Invalid number for argument: ${option.name}`);
                    }
                    break;
                case "BOOLEAN":
                    parsedValue = arg?.toLowerCase() === "true";
                    if (!["true", "false"].includes(arg?.toLowerCase())) {
                        throw new Error(`Invalid boolean for argument: ${option.name}`);
                    }
                    break;
                case "USER":
                    try {
                        parsedValue = await message.guild!.members.fetch(arg.replace(/[^0-9]/g, ""));
                        if (!parsedValue) {
                            throw new Error(`User not found for argument: ${option.name}`);
                        }
                    } catch {
                        throw new Error(`User not found for argument: ${option.name}`);
                    }
                    break;
                case "TEXT_CHANNEL":
                    try {
                        parsedValue = message.guild!.channels.cache.get(arg.replace(/[^0-9]/g, ""));
                        if (!parsedValue) {
                            throw new Error(`Channel not found for argument: ${option.name}`);
                        }
                        if (!parsedValue.isTextBased()) {
                            throw new Error(`Provided argument for ${option.name} is not a text channel.`);
                        }
                    } catch {
                        throw new Error(`Channel not found for argument: ${option.name}`);
                    }
                    break;
                case "VOICE_CHANNEL":
                    try {
                        parsedValue = message.guild!.channels.cache.get(arg.replace(/[^0-9]/g, ""));
                        if (!parsedValue) {
                            throw new Error(`Channel not found for argument: ${option.name}`);
                        }
                        if (!parsedValue.isVoiceBased()) {
                            throw new Error(`Provided argument for ${option.name} is not a voice channel.`);
                        }
                    } catch {
                        throw new Error(`Channel not found for argument: ${option.name}`);
                    }
                    break;
                default:
                    throw new Error(`Unsupported argument type: ${option.type}`);
            }

            if (option.validate) {
                const isValid = option.validate(parsedValue as OptionTypeMapping<OptionType>, interop);
                if (!isValid) {
                    throw new Error(`Validation failed for argument: ${option.name}`);
                }
            }

            args.shift();
            parsedArgs.push(parsedValue);
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
