import { CommandOption, ExtractArgsFromOptions, OptionType } from "../types/CommandTypings";
import { Client, ClientOptions, Collection, Interaction, Message } from "discord.js";
import Command from "./Command";
import Interop from "./Interop";

type HarmonyClientOptions<T extends boolean = boolean> = ClientOptions & {
    allow_text_commands: T;
} & (T extends true ? { prefix: string } : { prefix?: never });


/**
 * Custom Discord.js Client for handling commands and interactions.
 */
export default class HarmonyClient<
    T extends boolean = boolean, 
    Ready extends boolean = boolean
> extends Client<Ready> {
    public readonly cooldowns = new Collection<string, Collection<string, number>>();
    public readonly commands = new Collection<string, Command>();
    public readonly prefix: T extends true ? string : undefined;

    private constructor(options: HarmonyClientOptions<T>) {
        super(options);

        if (options.allow_text_commands) {
            this.prefix = options.prefix as T extends true ? string : undefined;
            this.on("messageCreate", this.handleMessageInteraction.bind(this));
        } else {
            this.prefix = void 0 as T extends true ? string : undefined;
        }
        this.on("interactionCreate", this.handleInteraction.bind(this));
    }

    /**
     * Handles slash command interactions.
     * @param interaction - The Discord interaction to process.
     */
    private async handleInteraction(interaction: Interaction) {
        if (!interaction.isCommand()) return;

        const command = this.commands.get(interaction.commandName);
        if (!command) return;

        const interop = new Interop(interaction, false);
        const args = this.resolveCommandArguments(command.options ?? [], interop);

        try {
            await command.execute(this, interop, args);
        } catch (error) {
            this.emit("commandError", {
                commandName: command.name,
                error,
                context: { interaction },
            });
        }
    }

    /**
     * Resolves command arguments from the options.
     * @param options - The options for the command.
     * @param interop - The interaction or message handler.
     * @returns The resolved arguments.
     */
    private resolveCommandArguments<T extends CommandOption<OptionType>[]>(
        options: T,
        interop: Interop
    ): ExtractArgsFromOptions<T> {
        const args: Record<string, any> = {};
        options.forEach((option) => {
            const value = interop.getOptionValue(option.name);
            args[option.name] = value ?? option.defaultValue;
        });
        return args as ExtractArgsFromOptions<T>;
    }

    /**
     * Handles message-based commands for text commands.
     * @param message - The message to process.
     */
    private handleMessageInteraction(message: Message) {
        if (
            !this.prefix ||
            message.author.bot ||
            !message.content.trim().startsWith(this.prefix)
        )
            return;

        const args = message.content.slice(this.prefix.length).trim().split(/\s+/);
        const commandName = args.shift()?.toLowerCase();

        if (!commandName) return;
        const command = this.commands.get(commandName);
        if (!command) return;

        const interop = new Interop(message, false);
        const resolvedArgs = this.resolveCommandArguments(command.options ?? [], interop);

        try {
            command.execute(this, interop, resolvedArgs);
        } catch (error) {
            this.emit("commandError", {
                commandName: command.name,
                error,
                context: { message },
            });
        }
    }
}
