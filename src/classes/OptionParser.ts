import { ExtractArgsFromOptions } from "../types/CommandTypings";
import { CommandInteraction, Message } from "discord.js";
import { CommandOption, OptionType } from "./Command";
import Interop from "./Interop";

export default class OptionParser {
    /**
     * Extracts arguments from an interaction's options.
     * @param interaction - The interaction to extract arguments from.
     * @param options - The command options to match against.
     * @returns The extracted arguments.
     */
    private static extractArgsFromInteractionOptions<T extends CommandOption<OptionType>[]>(
        interaction: CommandInteraction,
        options: T,
        interop: Interop
    ): ExtractArgsFromOptions<T> {
        if (!options?.length) return [] as ExtractArgsFromOptions<T>;

        return options.map((option) => {
            const { type, name, required } = option;
            const optionValue = interaction.options.get(name, required);
            if (!optionValue || !optionValue.value) return void 0;

            if ((!optionValue || optionValue.value === void 0) && !required) {
                if (!required) {
                    return typeof option.defaultValue === "function"
                        ? option.defaultValue(interop)
                        : option.defaultValue;
                }
                return undefined;
            }

            switch (type) {
                case "STRING":
                case "NUMBER":
                case "BOOLEAN":
                    return optionValue?.value;
                case "USER":
                    return interaction.guild!.members.cache.get(optionValue.value + "");
                case "VOICE_CHANNEL":
                case "TEXT_CHANNEL":
                    return interaction.guild!.channels.cache.get(optionValue.value + "");
            }
        }) as ExtractArgsFromOptions<T>;
    };

    /**
     * Extracts arguments from a message's content.
     * @param message - The message to extract arguments from.
     * @param options - The command options to match against.
     * @param args - The arguments from the message content.
     * @returns The extracted arguments.
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

            if (option.required && option.collect) {
                parsedArgs.push(args.join(" "));
                break;
            }

            let parsedValue;
            switch (option.type) {
                case "STRING":
                    parsedValue = arg;
                    break;
                case "NUMBER":
                    parsedValue = parseFloat(arg);
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
                case "VOICE_CHANNEL":
                    try {
                        parsedValue = message.guild!.channels.cache.get(arg.replace(/[^0-9]/g, ""));
                        if (!parsedValue) {
                            throw new Error(`Channel not found for argument: ${option.name}`);
                        }
                    } catch {
                        throw new Error(`Channel not found for argument: ${option.name}`);
                    }
                    break;
                default:
                    throw new Error(`Unsupported argument type: ${option.type}`);
            }

            args.shift();
            parsedArgs.push(parsedValue);
        }

        return parsedArgs as ExtractArgsFromOptions<T>;
    }

    /**
     * Parses command options and resolves their values.
     * @param options - The options for the command.
     * @param args - The arguments provided (for messages).
     * @param source - The interaction or message source.
     * @returns The resolved arguments.
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
